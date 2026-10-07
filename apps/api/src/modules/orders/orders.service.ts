import { db } from "../../db/connection.js";
import {
  orders, orderEvents, orderStars, deliveries, messages,
  reviews, disputes, gigs, users, sellerProfiles,
  notifications, ledgerAccounts, ledgerEntries,
} from "../../db/schema/index.js";
import { eq, and, sql, desc, or, inArray, isNull } from "drizzle-orm";
import {
  ApiError, notFound, forbidden, conflict, unprocessable, paymentRequired,
} from "../../errors.js";
import { platformFeeCents, sellerNetCents, splitEscrow, assertZeroSum } from "../../lib/money.js";
import { detectContactLeakage, LEAKAGE_WARNING } from "../../lib/leakage.js";
import { settleOrderCompletion, getOrCreateLedgerAccount } from "../../lib/cron.js";
import { createAndDispatchNotification } from "../notifications/notifications.service.js";
import { inspectDeliveryObject, createWatermarkedPreview, canDownloadDelivery } from "../storage/storage.service.js";
import { env } from "../../env.js";
import type { AuthUser } from "../../types/auth.js";

const HOUR_MS                 = 60 * 60 * 1000;
const AUTO_COMPLETE_HOURS     = env.AUTO_COMPLETE_DELAY_HOURS;
const REVISION_DEADLINE_HOURS = env.REVISION_DEADLINE_HOURS;
const LATE_REMEDY_HOURS       = 24;
const REVIEW_WINDOW_DAYS      = 14; // REV-01

/** The deadline that applies right now: the revision deadline while IN_REVISION. */
export function activeDeadline(order: { status: string; deadline: Date | null; revisionDeadline: Date | null }) {
  return order.status === "IN_REVISION" ? order.revisionDeadline : order.deadline;
}

export function isOrderLate(order: { status: string; deadline: Date | null; revisionDeadline: Date | null }, now = Date.now()) {
  if (order.status === "IN_PROGRESS" && order.deadline)          return now > order.deadline.getTime();
  if (order.status === "IN_REVISION" && order.revisionDeadline)  return now > order.revisionDeadline.getTime();
  return false;
}

// ── Place Order ───────────────────────────────────────────────────────────────

export async function placeOrder(buyerId: string, gigId: string) {
  const [gig] = await db
    .select({
      id: gigs.id,
      title: gigs.title,
      priceCents: gigs.priceCents,
      turnaroundHours: gigs.turnaroundHours,
      revisionsIncluded: gigs.revisionsIncluded,
      requirementsPrompt: gigs.requirementsPrompt,
      sellerId: gigs.sellerId,
      status: gigs.status,
    })
    .from(gigs)
    .where(and(eq(gigs.id, gigId), eq(gigs.status, "PUBLISHED")))
    .limit(1);
  if (!gig) throw notFound("Gig not found or is no longer available.");

  const [sellerProfile] = await db.select({ userId: sellerProfiles.userId, idVerified: sellerProfiles.idVerified }).from(sellerProfiles).where(eq(sellerProfiles.id, gig.sellerId)).limit(1);
  if (!sellerProfile) throw notFound("Seller profile not found");
  if (sellerProfile.userId === buyerId) throw forbidden("You cannot order your own gig.");
  // SEL-02: gigs of unverified sellers are hidden, so they can't be ordered either.
  if (!sellerProfile.idVerified) throw notFound("Gig not found or is no longer available.");

  const [buyerUser]  = await db.select().from(users).where(eq(users.id, buyerId)).limit(1);
  const orderId = crypto.randomUUID();
  const txnId   = crypto.randomUUID();

  await db.transaction(async (tx) => {
    const buyerAccount  = await getOrCreateLedgerAccount(tx, buyerId,      "USER_AVAILABLE");
    const escrowAccount = await getOrCreateLedgerAccount(tx, "PLATFORM",   "ESCROW");

    const [lockedBuyerAccount] = await tx
      .select({ id: ledgerAccounts.id, balanceCents: ledgerAccounts.balanceCents })
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.id, buyerAccount.id))
      .for("update");

    const currentBalance = lockedBuyerAccount?.balanceCents ?? buyerAccount.balanceCents;
    if (currentBalance < gig.priceCents) {
      throw paymentRequired(`Insufficient balance. Order total is $${(gig.priceCents / 100).toFixed(2)}, available is $${(currentBalance / 100).toFixed(2)}.`);
    }

    const legs = [
      { accountId: buyerAccount.id,  amountCents: -gig.priceCents, entryType: "ORDER_PLACED" as const },
      { accountId: escrowAccount.id, amountCents:  gig.priceCents, entryType: "ORDER_PLACED" as const },
    ];
    assertZeroSum(legs);

    await tx.insert(ledgerEntries).values(legs.map((l) => ({ ...l, txnId, orderId, description: `Order escrow hold for "${gig.title}"` })));
    await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents - ${gig.priceCents}` }).where(eq(ledgerAccounts.id, buyerAccount.id));
    await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents + ${gig.priceCents}` }).where(eq(ledgerAccounts.id, escrowAccount.id));

    await tx.insert(orders).values({
      id: orderId, gigId: gig.id, buyerId, sellerId: sellerProfile.userId,
      status: "PENDING_REQUIREMENTS", priceCents: gig.priceCents, feeRateBps: env.PLATFORM_FEE_BPS,
      turnaroundHours: gig.turnaroundHours, revisionsIncluded: gig.revisionsIncluded,
      revisionsUsed: 0, requirementsPrompt: gig.requirementsPrompt,
    });

    await tx.insert(orderEvents).values({ orderId, label: "Order placed", actor: buyerUser.fullName, detail: `Escrow hold of $${(gig.priceCents / 100).toFixed(2)} secured` });
    await createAndDispatchNotification({
      userId: sellerProfile.userId,
      type: "ORDER_PLACED",
      orderId,
      message: `New order received from ${buyerUser.fullName}!`,
      tx,
    });
  });

  return getOrderWorkspace({ id: buyerId, isAdmin: false, accountType: "CLIENT", email: "", fullName: "", isSeller: false, sessionId: "" }, orderId);
}

// ── List User Orders ──────────────────────────────────────────────────────────

export async function listUserOrders(user: AuthUser, tab = "active", search?: string) {
  const isSeller     = user.accountType === "FREELANCER";
  const userCondition = isSeller ? eq(orders.sellerId, user.id) : eq(orders.buyerId, user.id);

  const allOrders = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, priceCents: orders.priceCents, deadline: orders.deadline, revisionDeadline: orders.revisionDeadline, autoCompleteAt: orders.autoCompleteAt, gigTitle: gigs.title, buyerName: users.fullName, sellerId: orders.sellerId, buyerId: orders.buyerId })
    .from(orders)
    .innerJoin(gigs, eq(orders.gigId, gigs.id))
    .innerJoin(users, eq(orders.buyerId, users.id))
    .where(userCondition)
    .orderBy(desc(orders.createdAt));

  const stars = await db.select({ orderId: orderStars.orderId }).from(orderStars).where(eq(orderStars.userId, user.id));
  const starredSet = new Set(stars.map((s) => s.orderId));

  const sellerIds = [...new Set(allOrders.map((o) => o.sellerId))];
  const sellers   = sellerIds.length > 0
    ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, sellerIds))
    : [];
  const sellerNameMap = new Map(sellers.map((s) => [s.id, s.fullName]));

  const now = Date.now();
  const enriched = allOrders.map((o) => {
    const isLate    = isOrderLate(o, now);
    const isStarred = starredSet.has(o.id);
    const counterpartyName = isSeller ? o.buyerName : (sellerNameMap.get(o.sellerId) ?? "Seller");
    const dueAt = o.status === "DELIVERED" ? o.autoCompleteAt : activeDeadline(o);
    const lateRemedyAvailable = isLate && dueAt !== null && now > dueAt.getTime() + LATE_REMEDY_HOURS * HOUR_MS;

    return {
      id: o.id, orderNumber: o.orderNumber, gigTitle: o.gigTitle, counterpartyName,
      status: o.status, priceCents: o.priceCents,
      dueAt: ["COMPLETED", "CANCELLED", "DISPUTED", "PENDING_REQUIREMENTS"].includes(o.status) ? null : dueAt?.toISOString() ?? null,
      isLate, lateRemedyAvailable, isStarred,
    };
  });

  const searched = search?.trim() ? enriched.filter((o) => o.gigTitle.toLowerCase().includes(search.trim().toLowerCase()) || String(o.orderNumber).includes(search.trim())) : enriched;

  const counts: Record<string, number> = {
    priority:  enriched.filter((o) => o.isLate || o.status === "DELIVERED").length,
    active:    enriched.filter((o) => ["PENDING_REQUIREMENTS", "IN_PROGRESS", "IN_REVISION", "DISPUTED"].includes(o.status)).length,
    late:      enriched.filter((o) => o.isLate).length,
    delivered: enriched.filter((o) => o.status === "DELIVERED").length,
    completed: enriched.filter((o) => o.status === "COMPLETED").length,
    cancelled: enriched.filter((o) => o.status === "CANCELLED").length,
    starred:   enriched.filter((o) => o.isStarred).length,
  };

  const filtered = searched.filter((o) => {
    switch (tab) {
      case "priority":  return o.isLate || o.status === "DELIVERED";
      case "active":    return ["PENDING_REQUIREMENTS", "IN_PROGRESS", "IN_REVISION", "DISPUTED"].includes(o.status);
      case "late":      return o.isLate;
      case "delivered": return o.status === "DELIVERED";
      case "completed": return o.status === "COMPLETED";
      case "cancelled": return o.status === "CANCELLED";
      case "starred":   return o.isStarred;
      default:          return true;
    }
  });

  return { counts, orders: filtered };
}

// ── Order Workspace ───────────────────────────────────────────────────────────

export async function getOrderWorkspace(user: AuthUser, orderId: string) {
  const [detail] = await loadOrderDetails(user, [orderId]);
  if (!detail) throw notFound("Order not found");

  const isBuyer  = detail.raw.buyerId  === user.id;
  const isSeller = detail.raw.sellerId === user.id;
  if (!isBuyer && !isSeller && !user.isAdmin) throw forbidden("You are not a participant in this order workspace.");

  return { order: detail.order, readOnly: user.isAdmin && !isBuyer && !isSeller };
}

/**
 * Builds the order workspace payload for several orders with a fixed number of queries
 * (no per-order round trips). Callers must check that `viewer` may see each order.
 */
export async function loadOrderDetails(viewer: AuthUser, orderIds: string[]) {
  if (orderIds.length === 0) return [];

  const rows = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, gigId: orders.gigId, buyerId: orders.buyerId, sellerId: orders.sellerId, status: orders.status, priceCents: orders.priceCents, feeRateBps: orders.feeRateBps, turnaroundHours: orders.turnaroundHours, revisionsIncluded: orders.revisionsIncluded, revisionsUsed: orders.revisionsUsed, requirementsPrompt: orders.requirementsPrompt, requirementsAnswers: orders.requirementsAnswers, deadline: orders.deadline, revisionDeadline: orders.revisionDeadline, autoCompleteAt: orders.autoCompleteAt, completedAt: orders.completedAt, disputedAt: orders.disputedAt, mutualCancelRequestedBy: orders.mutualCancelRequestedBy, createdAt: orders.createdAt, gigSlug: gigs.slug, gigTitle: gigs.title })
    .from(orders).innerJoin(gigs, eq(orders.gigId, gigs.id)).where(inArray(orders.id, orderIds));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const userIds = [...new Set(rows.flatMap((r) => [r.buyerId, r.sellerId]))];
  const [people, allEvents, allDeliveries, allMessages, allReviews, stars] = await Promise.all([
    db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, userIds)),
    db.select().from(orderEvents).where(inArray(orderEvents.orderId, ids)).orderBy(orderEvents.createdAt),
    db.select().from(deliveries).where(inArray(deliveries.orderId, ids)).orderBy(deliveries.sequenceNo),
    db.select().from(messages).where(inArray(messages.orderId, ids)).orderBy(messages.createdAt),
    db.select({ orderId: reviews.orderId, rating: reviews.rating, body: reviews.body }).from(reviews).where(inArray(reviews.orderId, ids)),
    db.select({ orderId: orderStars.orderId }).from(orderStars).where(and(inArray(orderStars.orderId, ids), eq(orderStars.userId, viewer.id))),
  ]);

  const nameOf = new Map(people.map((p) => [p.id, p.fullName]));
  const group = <T extends { orderId: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const item of list) m.set(item.orderId, [...(m.get(item.orderId) ?? []), item]);
    return m;
  };
  const eventsBy = group(allEvents);
  const deliveriesBy = group(allDeliveries);
  const messagesBy = group(allMessages);
  const reviewBy = new Map(allReviews.map((r) => [r.orderId, r]));
  const starred = new Set(stars.map((s) => s.orderId));

  return rows.map((order) => {
    const viewerRole: "buyer" | "seller" = order.sellerId === viewer.id ? "seller" : "buyer";
    const buyerName = nameOf.get(order.buyerId) ?? "Buyer";
    const sellerName = nameOf.get(order.sellerId) ?? "Seller";
    // DEL-07: the buyer only learns the storage key (and so can download) once COMPLETED.
    const mayDownload = canDownloadDelivery(viewer, order);
    const review = reviewBy.get(order.id);

    return {
      raw: order,
      order: {
        id: order.id, orderNumber: order.orderNumber, status: order.status, viewerRole,
        gig:    { slug: order.gigSlug, title: order.gigTitle },
        buyer:  { name: buyerName },
        seller: { name: sellerName },
        priceCents: order.priceCents, feeRateBps: order.feeRateBps,
        revisionsIncluded: order.revisionsIncluded, revisionsUsed: order.revisionsUsed,
        turnaroundHours: order.turnaroundHours as 24 | 48,
        requirementsPrompt: order.requirementsPrompt, requirementsAnswers: order.requirementsAnswers,
        createdAt:               order.createdAt.toISOString(),
        deadline:                order.deadline?.toISOString()          ?? null,
        revisionDeadline:        order.revisionDeadline?.toISOString()  ?? null,
        autoCompleteAt:          order.autoCompleteAt?.toISOString()     ?? null,
        completedAt:             order.completedAt?.toISOString()        ?? null,
        disputedAt:              order.disputedAt?.toISOString()         ?? null,
        mutualCancelRequestedBy: order.mutualCancelRequestedBy as "buyer" | "seller" | null,
        isStarred: starred.has(order.id),
        review:    review ? { rating: review.rating, body: review.body } : null,
        deliveries: (deliveriesBy.get(order.id) ?? []).map((d) => ({
          id: d.id, sequenceNo: d.sequenceNo, fileName: d.fileName, fileSize: d.fileSize, sha256: d.sha256, kind: d.kind,
          fileTree: d.fileTree, notes: d.notes, createdAt: d.createdAt.toISOString(),
          storageKey: mayDownload ? d.storageKey : null,
          previewUrl: d.previewKey ? `/api/v1/deliveries/${d.id}/preview` : null,
        })),
        messages: (messagesBy.get(order.id) ?? []).map((m) => ({ id: m.id, senderRole: m.senderRole as "buyer" | "seller", senderName: m.senderRole === "buyer" ? buyerName : sellerName, body: m.body, attachmentName: m.attachmentName, createdAt: m.createdAt.toISOString() })),
        events: (eventsBy.get(order.id) ?? []).map((e) => ({ id: e.id, label: e.label, actor: e.actor, detail: e.detail, createdAt: e.createdAt.toISOString() })),
      },
    };
  });
}

// ── Submit Requirements ───────────────────────────────────────────────────────

export async function submitRequirements(user: AuthUser, orderId: string, answers: string[]) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.buyerId !== user.id) throw forbidden("Only the buyer can submit requirements.");
  if (order.status !== "PENDING_REQUIREMENTS") throw conflict("Order is not awaiting requirements.");

  const deadline = new Date(Date.now() + order.turnaroundHours * HOUR_MS);

  await db.transaction(async (tx) => {
    const res = await tx.update(orders).set({ status: "IN_PROGRESS", requirementsAnswers: answers, deadline, updatedAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.status, "PENDING_REQUIREMENTS"))).returning({ id: orders.id });
    if (res.length === 0) throw conflict("State changed concurrently.");

    await tx.insert(orderEvents).values({ orderId, label: "Requirements submitted", actor: user.fullName, detail: `Delivery deadline set for ${deadline.toLocaleDateString()}` });
    await createAndDispatchNotification({
      userId: order.sellerId,
      type: "REQUIREMENTS_SUBMITTED",
      orderId,
      message: `${user.fullName} submitted project requirements. Countdown started!`,
      tx,
    });
  });

  return getOrderWorkspace(user, orderId);
}

// ── Submit Delivery ───────────────────────────────────────────────────────────

export async function submitDelivery(
  user: AuthUser,
  orderId: string,
  deliveryData: {
    fileName: string;
    fileSize?: number;
    sha256?: string;
    storageKey?: string;
    fileKey?: string;
    kind?: "image" | "archive" | "document";
    fileTree?: string[] | null;
    notes?: string;
  },
) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.sellerId !== user.id) throw forbidden("Only the assigned freelancer can submit work.");
  if (!["IN_PROGRESS", "IN_REVISION"].includes(order.status)) throw conflict("Cannot deliver when order is not in progress or in revision.");

  const existing    = await db.select({ sequenceNo: deliveries.sequenceNo }).from(deliveries).where(eq(deliveries.orderId, orderId));
  const sequenceNo  = existing.length + 1;
  const autoCompleteAt = new Date(Date.now() + AUTO_COMPLETE_HOURS * HOUR_MS);

  const storageKey = deliveryData.storageKey || deliveryData.fileKey;
  if (!storageKey || !storageKey.startsWith(`deliveries/${orderId}/`) || storageKey.includes("..")) {
    throw unprocessable(`storageKey must begin with deliveries/${orderId}/`);
  }
  if (!deliveryData.fileName || typeof deliveryData.fileName !== "string") {
    throw unprocessable("fileName is required");
  }
  const [reused] = await db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.storageKey, storageKey)).limit(1);
  if (reused) throw conflict("This file was already delivered. Upload a new file.");

  // Never trust the client's size, hash or type: read the object back and check it (DEL-03/07).
  const inspected = await inspectDeliveryObject(storageKey);
  if (deliveryData.fileSize !== undefined && deliveryData.fileSize !== inspected.size) {
    throw unprocessable("The uploaded file's size doesn't match. Please upload it again.");
  }
  if (deliveryData.sha256 && deliveryData.sha256.toLowerCase() !== inspected.sha256) {
    throw unprocessable("The uploaded file's SHA-256 checksum doesn't match. Please upload it again.");
  }
  const kind = inspected.kind;
  const previewKey = kind === "image"
    ? await createWatermarkedPreview(storageKey, inspected.body, order.orderNumber).catch((err) => {
        console.error("[Watermark] preview generation failed:", err);
        return null;
      })
    : null;

  await db.transaction(async (tx) => {
    const res = await tx.update(orders).set({ status: "DELIVERED", autoCompleteAt, updatedAt: new Date() }).where(and(eq(orders.id, orderId), or(eq(orders.status, "IN_PROGRESS"), eq(orders.status, "IN_REVISION")))).returning({ id: orders.id });
    if (res.length === 0) throw conflict("State changed concurrently.");

    await tx.insert(deliveries).values({
      orderId,
      sequenceNo,
      fileName: deliveryData.fileName,
      fileSize: inspected.size,
      sha256: inspected.sha256,
      storageKey,
      kind,
      fileTree: inspected.fileTree,
      previewKey,
      notes: deliveryData.notes ?? "",
    });
    await tx.insert(orderEvents).values({ orderId, label: `Delivery #${sequenceNo} submitted`, actor: user.fullName, detail: deliveryData.fileName });
    await createAndDispatchNotification({
      userId: order.buyerId,
      type: "DELIVERABLE_UPLOADED",
      orderId,
      message: `${user.fullName} uploaded delivery #${sequenceNo}. Please review!`,
      tx,
    });
  });

  return getOrderWorkspace(user, orderId);
}

// ── Accept Delivery ───────────────────────────────────────────────────────────

export async function acceptDelivery(user: AuthUser, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.buyerId !== user.id) throw forbidden("Only the buyer can accept the delivery.");
  if (order.status !== "DELIVERED") throw conflict("Order is not in delivered status.");

  await db.transaction(async (tx) => {
    const res = await tx.update(orders).set({ status: "COMPLETED", completedAt: new Date(), autoCompleteAt: null, updatedAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.status, "DELIVERED"))).returning({ id: orders.id });
    if (res.length === 0) throw conflict("State changed concurrently.");

    await settleOrderCompletion(tx, order);
    await tx.insert(orderEvents).values({ orderId, label: "Delivery accepted", actor: user.fullName, detail: "Escrow funds released to freelancer pending clearance" });
    await createAndDispatchNotification({
      userId: order.sellerId,
      type: "ORDER_COMPLETED",
      orderId,
      message: `${user.fullName} accepted delivery! Escrow has been released.`,
      tx,
    });
  });

  return getOrderWorkspace(user, orderId);
}

// ── Request Revision ──────────────────────────────────────────────────────────

export async function requestRevision(user: AuthUser, orderId: string, feedback: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.buyerId !== user.id) throw forbidden("Only the buyer can request revisions.");
  if (order.status !== "DELIVERED") throw conflict("Order is not in delivered status.");
  if (order.revisionsUsed >= order.revisionsIncluded) throw unprocessable("Revision quota exhausted.");

  const revisionDeadline = new Date(Date.now() + REVISION_DEADLINE_HOURS * HOUR_MS);

  await db.transaction(async (tx) => {
    // The quota check lives in the WHERE clause so two quick requests can't both pass it.
    const res = await tx
      .update(orders)
      .set({ status: "IN_REVISION", revisionsUsed: sql`${orders.revisionsUsed} + 1`, revisionDeadline, autoCompleteAt: null, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, "DELIVERED"), sql`${orders.revisionsUsed} < ${orders.revisionsIncluded}`))
      .returning({ revisionsUsed: orders.revisionsUsed });
    if (res.length === 0) throw conflict("The order changed or no revisions are left. Please refresh.");

    await tx.insert(orderEvents).values({ orderId, label: `Revision ${res[0].revisionsUsed} of ${order.revisionsIncluded} requested`, actor: user.fullName, detail: feedback });
    await createAndDispatchNotification({
      userId: order.sellerId,
      type: "REVISION_REQUESTED",
      orderId,
      message: `${user.fullName} requested a revision on order #${order.orderNumber}.`,
      tx,
    });
  });

  return getOrderWorkspace(user, orderId);
}

// ── Cancel Order ──────────────────────────────────────────────────────────────

export async function cancelOrder(user: AuthUser, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");

  const isBuyer  = order.buyerId  === user.id;
  const isSeller = order.sellerId === user.id;
  if (!isBuyer && !isSeller) throw forbidden("Not an order participant.");

  if (["COMPLETED", "CANCELLED", "DISPUTED"].includes(order.status)) {
    throw conflict(`Cannot cancel an order that is already ${order.status.toLowerCase()}.`);
  }

  const now              = Date.now();
  const due              = activeDeadline(order);
  const isLateRemedy     = isBuyer && (order.status === "IN_PROGRESS" || order.status === "IN_REVISION") && due !== null && now > due.getTime() + LATE_REMEDY_HOURS * HOUR_MS;
  const isUnstarted      = isBuyer && order.status === "PENDING_REQUIREMENTS";

  // `allowed` is re-checked in the UPDATE, so a concurrent transition makes this a 409.
  const fullRefundCancel = async (label: string, allowed: ("PENDING_REQUIREMENTS" | "IN_PROGRESS" | "IN_REVISION")[], extra?: ReturnType<typeof eq>) => {
    await db.transaction(async (tx) => {
      const res = await tx
        .update(orders)
        .set({ status: "CANCELLED", mutualCancelRequestedBy: null, updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), inArray(orders.status, allowed), extra))
        .returning({ id: orders.id });
      if (res.length === 0) throw conflict("State changed concurrently or order cannot be cancelled.");

      const escrow    = await getOrCreateLedgerAccount(tx, "PLATFORM", "ESCROW");
      const buyerAvail = await getOrCreateLedgerAccount(tx, order.buyerId, "USER_AVAILABLE");

      const legs = [
        { accountId: escrow.id,      amountCents: -order.priceCents, entryType: "ORDER_REFUNDED" as const },
        { accountId: buyerAvail.id,  amountCents:  order.priceCents, entryType: "ORDER_REFUNDED" as const },
      ];
      assertZeroSum(legs);

      const txnId = crypto.randomUUID();
      await tx.insert(ledgerEntries).values(legs.map((l) => ({ ...l, txnId, orderId, description: label })));
      await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents - ${order.priceCents}` }).where(eq(ledgerAccounts.id, escrow.id));
      await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents + ${order.priceCents}` }).where(eq(ledgerAccounts.id, buyerAvail.id));
      await tx.insert(orderEvents).values({ orderId, label, actor: user.fullName, detail: "100% refund returned to buyer wallet balance" });
      await createAndDispatchNotification({
        userId: isBuyer ? order.sellerId : order.buyerId,
        type: "ORDER_CANCELLED",
        orderId,
        message: `Order #${order.orderNumber} was cancelled (${label.toLowerCase()}). The buyer was refunded in full.`,
        tx,
      });
    });
  };

  if (isUnstarted)  { await fullRefundCancel("Order cancelled", ["PENDING_REQUIREMENTS"]);                    return getOrderWorkspace(user, orderId); }
  if (isLateRemedy) { await fullRefundCancel("Cancelled for late delivery", ["IN_PROGRESS", "IN_REVISION"]); return getOrderWorkspace(user, orderId); }

  // Mutual cancellation (ORD-10 / T-14): only while IN_PROGRESS.
  if (order.status !== "IN_PROGRESS") {
    throw conflict("Mutual cancellation is only possible while the order is in progress. Open a dispute instead.");
  }
  const myRole    = isBuyer ? "buyer" : "seller";
  const otherRole = isBuyer ? "seller" : "buyer";
  if (order.mutualCancelRequestedBy === otherRole) {
    await fullRefundCancel("Mutual cancellation accepted", ["IN_PROGRESS"], eq(orders.mutualCancelRequestedBy, otherRole));
  } else if (order.mutualCancelRequestedBy === myRole) {
    throw conflict("You already proposed cancelling this order. Waiting for the other party.");
  } else {
    await db.transaction(async (tx) => {
      const res = await tx
        .update(orders)
        .set({ mutualCancelRequestedBy: myRole, updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.status, "IN_PROGRESS"), isNull(orders.mutualCancelRequestedBy)))
        .returning({ id: orders.id });
      if (res.length === 0) throw conflict("The order changed. Please refresh.");
      await tx.insert(orderEvents).values({ orderId, label: "Mutual cancellation proposed", actor: user.fullName, detail: "Awaiting counterparty response" });
      await createAndDispatchNotification({
        userId: isBuyer ? order.sellerId : order.buyerId,
        type: "ORDER_CANCELLED",
        orderId,
        message: `${user.fullName} proposed cancelling order #${order.orderNumber}. Accept to refund the buyer in full.`,
        tx,
      });
    });
  }

  return getOrderWorkspace(user, orderId);
}

// ── Open Dispute ──────────────────────────────────────────────────────────────

export async function openDispute(user: AuthUser, orderId: string, reason: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.buyerId !== user.id && order.sellerId !== user.id) throw forbidden("Not an order participant.");

  const allowedDisputeStates = ["IN_PROGRESS", "IN_REVISION", "DELIVERED"];
  if (!allowedDisputeStates.includes(order.status)) {
    throw conflict(`Disputes can only be opened on active or delivered orders (current status: ${order.status}).`);
  }

  await db.transaction(async (tx) => {
    const res = await tx
      .update(orders)
      .set({ status: "DISPUTED", disputedAt: new Date(), autoCompleteAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(orders.id, orderId),
          inArray(orders.status, ["IN_PROGRESS", "IN_REVISION", "DELIVERED"]),
        ),
      )
      .returning({ id: orders.id });
    if (res.length === 0) throw conflict("State changed concurrently.");
    await tx.insert(disputes).values({ orderId, reason });
    await tx.insert(orderEvents).values({ orderId, label: "Dispute opened", actor: user.fullName, detail: reason });
    const recipientId = user.id === order.buyerId ? order.sellerId : order.buyerId;
    await createAndDispatchNotification({
      userId: recipientId,
      type: "DISPUTE_OPENED",
      orderId,
      message: `${user.fullName} opened a dispute on order #${order.orderNumber}: "${reason}"`,
      tx,
    });
  });

  return getOrderWorkspace(user, orderId);
}

// ── Submit Review ─────────────────────────────────────────────────────────────

export async function submitReview(user: AuthUser, orderId: string, rating: number, body?: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.buyerId !== user.id) throw forbidden("Only the buyer can review.");
  if (order.status !== "COMPLETED") throw conflict("Order is not completed.");
  const completedAt = order.completedAt?.getTime() ?? 0;
  if (Date.now() > completedAt + REVIEW_WINDOW_DAYS * 24 * HOUR_MS) {
    throw conflict(`Reviews can only be left within ${REVIEW_WINDOW_DAYS} days of completion.`);
  }

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(reviews)
      .values({ orderId, gigId: order.gigId, buyerId: user.id, rating, body: body ?? null })
      .onConflictDoNothing({ target: reviews.orderId })
      .returning({ id: reviews.id });
    if (inserted.length === 0) throw conflict("You've already reviewed this order.");

    const [stats] = await tx
      .select({ avg: sql<number>`AVG(${reviews.rating})::real`, count: sql<number>`COUNT(*)::int` })
      .from(reviews).where(eq(reviews.gigId, order.gigId));

    await tx.update(gigs).set({
      avgRating:   stats?.avg   != null ? Number(stats.avg)   : rating,
      reviewCount: stats?.count != null ? Number(stats.count) : 1,
    }).where(eq(gigs.id, order.gigId));

    await tx.insert(orderEvents).values({ orderId, label: `Left a ${rating}-star review`, actor: user.fullName, detail: body ?? null });
  });

  return getOrderWorkspace(user, orderId);
}

// ── Toggle Order Star ─────────────────────────────────────────────────────────

export async function toggleOrderStar(userId: string, orderId: string) {
  const [order] = await db.select({ buyerId: orders.buyerId, sellerId: orders.sellerId }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.buyerId !== userId && order.sellerId !== userId) throw forbidden("Not an order participant.");
  const [existing] = await db.select().from(orderStars).where(and(eq(orderStars.userId, userId), eq(orderStars.orderId, orderId))).limit(1);
  if (existing) {
    await db.delete(orderStars).where(and(eq(orderStars.userId, userId), eq(orderStars.orderId, orderId)));
    return { isStarred: false };
  }
  await db.insert(orderStars).values({ userId, orderId });
  return { isStarred: true };
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listOrderMessages(userId: string, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.buyerId !== userId && order.sellerId !== userId) throw forbidden("Not an order participant.");

  const [buyerUser]  = await db.select().from(users).where(eq(users.id, order.buyerId)).limit(1);
  const [sellerUser] = await db.select().from(users).where(eq(users.id, order.sellerId)).limit(1);

  const raw = await db.select().from(messages).where(eq(messages.orderId, orderId)).orderBy(messages.createdAt);
  return raw.map((m) => ({
    id: m.id, senderRole: m.senderRole as "buyer" | "seller",
    senderName: m.senderRole === "buyer" ? (buyerUser?.fullName ?? "Buyer") : (sellerUser?.fullName ?? "Seller"),
    body: m.body, attachmentName: m.attachmentName, createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendOrderMessage(user: AuthUser, orderId: string, body: string, attachmentName?: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.buyerId !== user.id && order.sellerId !== user.id) throw forbidden("Not an order participant.");

  const hasLeakage   = detectContactLeakage(body);
  const senderRole   = order.sellerId === user.id ? "seller" : "buyer";
  const recipientId  = order.sellerId === user.id ? order.buyerId : order.sellerId;

  const [msg] = await db.insert(messages).values({ orderId, senderId: user.id, senderRole, body, attachmentName: attachmentName ?? null, hasLeakage }).returning();

  await createAndDispatchNotification({
    userId: recipientId,
    type: "NEW_MESSAGE",
    orderId,
    message: `New message from ${user.fullName} on order #${order.orderNumber}`,
  });

  return {
    message: { id: msg.id, senderRole: msg.senderRole as "buyer" | "seller", senderName: user.fullName, body: msg.body, attachmentName: msg.attachmentName, createdAt: msg.createdAt.toISOString() },
    leakageWarning: hasLeakage ? LEAKAGE_WARNING : null,
  };
}
