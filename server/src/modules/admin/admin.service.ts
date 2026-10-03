import { db } from "../../db/connection.js";
import { sellerProfiles, users, orders, disputes, gigs, ledgerAccounts, ledgerEntries, orderEvents } from "../../db/schema/index.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { notFound, conflict } from "../../errors.js";
import { platformFeeCents, splitEscrow, assertZeroSum } from "../../lib/money.js";
import { getOrCreateLedgerAccount } from "../../lib/cron.js";

export async function listPendingVerifications() {
  const rows = await db
    .select({ id: sellerProfiles.id, sellerName: users.fullName, email: users.email, country: sellerProfiles.country, idDocumentType: sellerProfiles.idDocumentType, documentReference: sellerProfiles.documentReference, submittedAt: sellerProfiles.verificationSubmittedAt })
    .from(sellerProfiles)
    .innerJoin(users, eq(sellerProfiles.userId, users.id))
    .where(eq(sellerProfiles.verificationStatus, "PENDING_VERIFICATION"))
    .orderBy(desc(sellerProfiles.verificationSubmittedAt));

  return rows.map((r) => ({
    id:                r.id,
    sellerName:        r.sellerName,
    email:             r.email,
    country:           r.country,
    idDocumentType:    r.idDocumentType ?? "PASSPORT",
    documentReference: r.documentReference ?? "N/A",
    submittedAt:       r.submittedAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function resolveVerification(profileId: string, status: "APPROVED" | "REJECTED") {
  const [profile] = await db.select({ id: sellerProfiles.id }).from(sellerProfiles).where(eq(sellerProfiles.id, profileId)).limit(1);
  if (!profile) throw notFound("Seller profile not found");

  await db.update(sellerProfiles).set({ verificationStatus: status, idVerified: status === "APPROVED", updatedAt: new Date() }).where(eq(sellerProfiles.id, profileId));
  return { ok: true, status };
}

export async function listDisputedOrders() {
  const rows = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, priceCents: orders.priceCents, feeRateBps: orders.feeRateBps, gigTitle: gigs.title, disputeId: disputes.id, reason: disputes.reason, openedAt: disputes.createdAt })
    .from(orders)
    .innerJoin(gigs, eq(orders.gigId, gigs.id))
    .innerJoin(disputes, eq(orders.id, disputes.orderId))
    .where(eq(orders.status, "DISPUTED"))
    .orderBy(desc(disputes.createdAt));

  return rows.map((r) => ({ id: r.id, orderNumber: r.orderNumber, gigTitle: r.gigTitle, priceCents: r.priceCents, reason: r.reason, openedAt: r.openedAt.toISOString() }));
}

export async function resolveDispute(orderId: string, input: { ruling: "BUYER" | "SELLER" | "SPLIT"; buyerRefundBps?: number; resolutionNotes?: string }) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.status !== "DISPUTED") throw conflict("Order is not disputed");

  const txnId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    const escrow       = await getOrCreateLedgerAccount(tx, "PLATFORM",     "ESCROW");
    const buyerAvail   = await getOrCreateLedgerAccount(tx, order.buyerId,  "USER_AVAILABLE");
    const sellerPending = await getOrCreateLedgerAccount(tx, order.sellerId, "USER_PENDING");
    const platformRev  = await getOrCreateLedgerAccount(tx, "PLATFORM",     "PLATFORM_REVENUE");

    let newStatus: "COMPLETED" | "CANCELLED" = "COMPLETED";
    let legs: { accountId: string; amountCents: number; entryType: "ORDER_REFUNDED" | "ORDER_COMPLETED" | "DISPUTE_ADJUSTMENT" }[] = [];
    let descStr = "";

    if (input.ruling === "BUYER") {
      newStatus = "CANCELLED";
      legs = [
        { accountId: escrow.id,      amountCents: -order.priceCents, entryType: "ORDER_REFUNDED" },
        { accountId: buyerAvail.id,  amountCents:  order.priceCents, entryType: "ORDER_REFUNDED" },
      ];
      descStr = "Admin dispute resolution: 100% buyer refund";
    } else if (input.ruling === "SELLER") {
      const fee = platformFeeCents(order.priceCents, order.feeRateBps);
      const net = order.priceCents - fee;
      legs = [
        { accountId: escrow.id,       amountCents: -order.priceCents, entryType: "ORDER_COMPLETED" },
        { accountId: sellerPending.id, amountCents:  net,              entryType: "ORDER_COMPLETED" },
        { accountId: platformRev.id,  amountCents:  fee,              entryType: "ORDER_COMPLETED" },
      ];
      descStr = "Admin dispute resolution: full release to seller";
    } else {
      const refundBps = Math.min(10000, Math.max(0, input.buyerRefundBps ?? 5000));
      const { buyer, seller, platform } = splitEscrow(order.priceCents, order.feeRateBps, refundBps);
      legs = [
        { accountId: escrow.id,       amountCents: -order.priceCents, entryType: "DISPUTE_ADJUSTMENT" },
        { accountId: buyerAvail.id,   amountCents:  buyer,            entryType: "DISPUTE_ADJUSTMENT" },
        { accountId: sellerPending.id, amountCents:  seller,           entryType: "DISPUTE_ADJUSTMENT" },
        { accountId: platformRev.id,  amountCents:  platform,         entryType: "DISPUTE_ADJUSTMENT" },
      ];
      descStr = `Admin dispute resolution: ${refundBps / 100}% to buyer`;
    }

    assertZeroSum(legs);
    await tx.insert(ledgerEntries).values(legs.map((l) => ({ ...l, txnId, orderId, description: descStr })));

    for (const leg of legs) {
      await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents + ${leg.amountCents}` }).where(eq(ledgerAccounts.id, leg.accountId));
    }

    await tx.update(orders).set({ status: newStatus, completedAt: newStatus === "COMPLETED" ? new Date() : null, updatedAt: new Date() }).where(eq(orders.id, orderId));
    await tx.update(disputes).set({ status: "RESOLVED", resolution: input.resolutionNotes ?? `Resolved as ${input.ruling}`, resolvedAt: new Date() }).where(eq(disputes.orderId, orderId));
    await tx.insert(orderEvents).values({ orderId, label: `Dispute resolved: ${input.ruling}`, actor: "Admin", detail: input.resolutionNotes ?? null });
  });

  return { ok: true };
}
