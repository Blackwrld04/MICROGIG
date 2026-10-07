import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { db, lockConnection } from "../db/connection.js";
import { orders, orderEvents, ledgerAccounts, ledgerEntries } from "../db/schema/index.js";
import { eq, lte, gt, and, sql, isNull, inArray } from "drizzle-orm";
import { env } from "../env.js";
import { platformFeeCents, assertZeroSum } from "./money.js";
import { createAndDispatchNotification, dispatchPendingEmails } from "../modules/notifications/notifications.service.js";
import { purgeExpiredIdempotencyKeys } from "./idempotency.js";
import { slaThresholdsReached, slaDedupeKey } from "./sla.js";

const runningJobs = new Set<string>();

/**
 * Runs `job` unless it is already running, here or on another API instance (Postgres
 * advisory lock), so scaling the API to several instances never double-processes anything.
 */
export async function withJobLock(name: string, log: FastifyBaseLogger, job: () => Promise<void>) {
  if (runningJobs.has(name)) return;
  runningJobs.add(name);
  const key = `microgig:${name}`;
  let locked = false;
  try {
    const [row] = await lockConnection<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(hashtext(${key})) AS locked`;
    locked = Boolean(row?.locked);
    if (locked) await job();
  } catch (err) {
    log.error({ err }, `${name} job failed`);
  } finally {
    if (locked) await lockConnection`SELECT pg_advisory_unlock(hashtext(${key}))`.catch(() => undefined);
    runningJobs.delete(name);
  }
}

export async function autoCompleteDeliveredOrders(log: FastifyBaseLogger) {
  const now = new Date();
  const overdue = await db
    .select({
      id:          orders.id,
      orderNumber: orders.orderNumber,
      buyerId:     orders.buyerId,
      sellerId:    orders.sellerId,
      priceCents:  orders.priceCents,
      feeRateBps:  orders.feeRateBps,
    })
    .from(orders)
    .where(and(eq(orders.status, "DELIVERED"), lte(orders.autoCompleteAt, now)));

  for (const order of overdue) {
    await db.transaction(async (tx) => {
      const result = await tx
        .update(orders)
        .set({ status: "COMPLETED", completedAt: now, autoCompleteAt: null, updatedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "DELIVERED")))
        .returning({ id: orders.id });
      if (result.length === 0) return;

      await settleOrderCompletion(tx, order);
      await tx.insert(orderEvents).values({
        orderId: order.id,
        label:   "Auto-completed",
        actor:   "System",
        detail:  `${env.AUTO_COMPLETE_DELAY_HOURS}-hour review window elapsed`,
      });
      await createAndDispatchNotification({
        userId:  order.buyerId,
        type:    "ORDER_COMPLETED",
        orderId: order.id,
        message: `Order #${order.orderNumber} was auto-completed. Leave a review!`,
        tx,
      });
      await createAndDispatchNotification({
        userId:  order.sellerId,
        type:    "ORDER_COMPLETED",
        orderId: order.id,
        message: `Order #${order.orderNumber} was auto-completed. Your earnings are now clearing.`,
        tx,
      });
      log.info({ orderId: order.id }, "Auto-completed order");
    });
  }
}

export async function clearMaturedFunds(log: FastifyBaseLogger) {
  const clearingCutoff = new Date(Date.now() - env.CLEARING_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const toSettle = await db.execute(sql`
    SELECT o.id AS order_id, o.seller_id
    FROM orders o
    WHERE o.status = 'COMPLETED'
      AND o.completed_at <= ${clearingCutoff.toISOString()}
      AND NOT EXISTS (
        SELECT 1
        FROM ledger_entries le
        JOIN ledger_accounts la ON la.id = le.account_id
        WHERE la.user_id    = o.seller_id
          AND le.entry_type = 'CLEARING'
          AND le.order_id   = o.id
      )
    LIMIT 50
  `);

  for (const row of toSettle as unknown as { order_id: string; seller_id: string }[]) {
    // The actual amount credited to the seller's pending balance (split rulings credit less).
    const [pendingCredit] = await db
      .select({ totalCredited: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)` })
      .from(ledgerEntries)
      .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId))
      .where(
        and(
          eq(ledgerAccounts.userId, row.seller_id),
          eq(ledgerAccounts.kind, "USER_PENDING"),
          eq(ledgerEntries.orderId, row.order_id),
          sql`${ledgerEntries.amountCents} > 0`,
        ),
      );

    const amountToClear = Number(pendingCredit?.totalCredited ?? 0);
    if (amountToClear > 0) {
      await postClearingEntry(row.order_id, row.seller_id, amountToClear);
      log.info({ orderId: row.order_id, amountToClear }, "Funds cleared to seller");
    }
  }
}

/** NOT-01 (7): late-delivery warnings at 50% and 90% of the SLA, and once it is overdue. */
export async function sendSlaWarnings() {
  const now = Date.now();
  const active = await db
    .select({
      id:               orders.id,
      orderNumber:      orders.orderNumber,
      buyerId:          orders.buyerId,
      sellerId:         orders.sellerId,
      status:           orders.status,
      deadline:         orders.deadline,
      revisionDeadline: orders.revisionDeadline,
      turnaroundHours:  orders.turnaroundHours,
    })
    .from(orders)
    .where(inArray(orders.status, ["IN_PROGRESS", "IN_REVISION"]));

  for (const order of active) {
    const due = slaThresholdsReached(order, env.REVISION_DEADLINE_HOURS, now);
    if (!due) continue;
    const what = order.status === "IN_REVISION" ? "revision" : "delivery";
    for (const threshold of due.thresholds) {
      const key = slaDedupeKey(order.id, due.deadline, threshold);
      if (threshold === 100) {
        await createAndDispatchNotification({ userId: order.sellerId, type: "LATE_WARNING", orderId: order.id, dedupeKey: key, message: `Your ${what} for order #${order.orderNumber} is overdue.` });
        await createAndDispatchNotification({ userId: order.buyerId, type: "LATE_WARNING", orderId: order.id, dedupeKey: key, message: `Order #${order.orderNumber} is past its ${what} deadline. After 24 more hours you can cancel for a full refund.` });
      } else {
        await createAndDispatchNotification({
          userId: order.sellerId,
          type: "LATE_WARNING",
          orderId: order.id,
          dedupeKey: key,
          message: `${threshold}% of the ${what} time for order #${order.orderNumber} has passed. It's due ${due.deadline.toUTCString()}.`,
        });
      }
    }
  }
}

/** ORD-06: remind the buyer 24 hours before a delivery auto-completes. */
export async function sendAutoCompleteWarnings(log: FastifyBaseLogger) {
  const now = new Date();
  const warningWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const approaching = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, buyerId: orders.buyerId, autoCompleteAt: orders.autoCompleteAt })
    .from(orders)
    .where(and(eq(orders.status, "DELIVERED"), lte(orders.autoCompleteAt, warningWindow), gt(orders.autoCompleteAt, now)));

  for (const order of approaching) {
    const sent = await createAndDispatchNotification({
      userId: order.buyerId,
      type: "AUTO_COMPLETE_WARNING",
      orderId: order.id,
      dedupeKey: `autocomplete:${order.id}:${order.autoCompleteAt!.toISOString()}`,
      message: `Order #${order.orderNumber} will be automatically accepted in less than 24 hours. Please review the deliverable!`,
    });
    if (sent) log.info({ orderId: order.id }, "Dispatched 24-hour auto-complete warning");
  }
}

/** Review reminder: 24 hours after completion, if the buyer hasn't reviewed (REV-01 window). */
export async function sendReviewReminders() {
  const rows = (await db.execute(sql`
    SELECT o.id, o.order_number, o.buyer_id
    FROM orders o
    WHERE o.status = 'COMPLETED'
      AND o.completed_at <= now() - interval '24 hours'
      AND o.completed_at >  now() - interval '14 days'
      AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_id = o.id)
    LIMIT 200
  `)) as unknown as { id: string; order_number: number; buyer_id: string }[];

  for (const o of rows) {
    await createAndDispatchNotification({
      userId: o.buyer_id,
      type: "REVIEW_REMINDER",
      orderId: o.id,
      dedupeKey: `review-reminder:${o.id}`,
      message: `How did order #${o.order_number} go? You have until 14 days after completion to leave a review.`,
    });
  }
}

export function startReconcilerCron(log: FastifyBaseLogger) {
  log.info("Starting reconciler cron jobs...");

  // Each job takes a Postgres advisory lock, so running several API instances is safe.
  cron.schedule("*/5 * * * *", () => withJobLock("auto-complete", log, () => autoCompleteDeliveredOrders(log)));
  cron.schedule("*/10 * * * *", () => withJobLock("clearing", log, () => clearMaturedFunds(log)));
  cron.schedule("*/10 * * * *", () => withJobLock("sla-warnings", log, sendSlaWarnings));
  cron.schedule("*/15 * * * *", () => withJobLock("auto-complete-warnings", log, () => sendAutoCompleteWarnings(log)));
  cron.schedule("30 * * * *", () => withJobLock("review-reminders", log, sendReviewReminders));
  // Email outbox fallback; normally emails go out within seconds of the commit.
  cron.schedule("* * * * *", () => withJobLock("email-dispatch", log, async () => { await dispatchPendingEmails(); }));
  cron.schedule("0 0 * * *", () => withJobLock("ledger-audit", log, async () => { await runLedgerAudit(log); }), { timezone: "UTC" });
  cron.schedule("15 3 * * *", () => withJobLock("idempotency-purge", log, purgeExpiredIdempotencyKeys), { timezone: "UTC" });

  log.info("Reconciler cron jobs initialized");
}

export async function runLedgerAudit(log?: FastifyBaseLogger) {
  const logger = log ?? console;
  logger.info("Executing ledger integrity audit...");

  // Invariant 1: Sum of ledger entries per account equals account balance
  const accountAudits = await db.execute(sql`
    SELECT
      la.id AS account_id,
      la.kind,
      la.user_id,
      la.balance_cents,
      COALESCE(SUM(le.amount_cents), 0)::bigint AS computed_balance_cents
    FROM ledger_accounts la
    LEFT JOIN ledger_entries le ON le.account_id = la.id
    GROUP BY la.id, la.kind, la.user_id, la.balance_cents
    HAVING la.balance_cents != COALESCE(SUM(le.amount_cents), 0)::bigint
  `);

  const invariant1Violations = accountAudits as any[];
  if (invariant1Violations.length > 0) {
    logger.error(
      { violations: invariant1Violations },
      "CRITICAL: Ledger Invariant 1 Violated! Account balances do not match entry sums!",
    );
  }

  // Invariant 2: Across the entire system, entries must sum to 0
  const totalEntriesRes = await db.execute(sql`
    SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total_cents
    FROM ledger_entries
  `);
  const totalCents = Number((totalEntriesRes as any)[0]?.total_cents ?? 0);
  if (totalCents !== 0) {
    logger.error(
      { totalCents },
      "CRITICAL: Ledger Invariant 2 Violated! Entire ledger entries do not sum to 0!",
    );
  }

  // Invariant 3: Escrow account balance must match total price of active orders
  const escrowBalRes = await db.execute(sql`
    SELECT COALESCE(SUM(balance_cents), 0)::bigint AS escrow_total_cents
    FROM ledger_accounts
    WHERE kind = 'ESCROW'
  `);
  const escrowTotal = Number((escrowBalRes as any)[0]?.escrow_total_cents ?? 0);

  const activeOrdersRes = await db.execute(sql`
    SELECT COALESCE(SUM(price_cents), 0)::bigint AS active_orders_cents
    FROM orders
    WHERE status IN ('PENDING_REQUIREMENTS', 'IN_PROGRESS', 'IN_REVISION', 'DELIVERED')
  `);
  const activeOrdersCents = Number((activeOrdersRes as any)[0]?.active_orders_cents ?? 0);

  if (escrowTotal !== activeOrdersCents) {
    logger.error(
      { escrowTotal, activeOrdersCents, discrepancy: escrowTotal - activeOrdersCents },
      "CRITICAL: Ledger Invariant 3 Violated! Escrow balance does not match active orders sum!",
    );
  }

  const passed = invariant1Violations.length === 0 && totalCents === 0 && escrowTotal === activeOrdersCents;
  if (passed) {
    logger.info("Ledger integrity audit passed successfully. All invariants hold.");
  }

  return {
    passed,
    discrepancies: {
      accountBalanceMismatches: invariant1Violations,
      systemNonZeroSum: totalCents,
      escrowVsActiveOrders: {
        escrowTotal,
        activeOrdersCents,
        discrepancy: escrowTotal - activeOrdersCents,
      },
    },
  };
}

export async function getOrCreateLedgerAccount(
  tx: any,
  userId: string | null,
  kind: "USER_AVAILABLE" | "USER_PENDING" | "ESCROW" | "PLATFORM_REVENUE" | "BUYER_FUNDING",
) {
  const isPlatform = userId === "PLATFORM" || userId === null;
  const targetUserId = isPlatform ? null : userId;

  const condition = targetUserId
    ? and(eq(ledgerAccounts.userId, targetUserId), eq(ledgerAccounts.kind, kind))
    : and(isNull(ledgerAccounts.userId), eq(ledgerAccounts.kind, kind));

  const [existing] = await tx
    .select({ id: ledgerAccounts.id, balanceCents: ledgerAccounts.balanceCents })
    .from(ledgerAccounts)
    .where(condition)
    .limit(1);

  if (existing) return existing;

  const [created] = await tx
    .insert(ledgerAccounts)
    .values({ userId: targetUserId, kind, balanceCents: 0 })
    .returning({ id: ledgerAccounts.id, balanceCents: ledgerAccounts.balanceCents });

  return created;
}

export async function settleOrderCompletion(
  tx: any,
  order: { id: string; sellerId: string; priceCents: number; feeRateBps: number },
) {
  const fee = platformFeeCents(order.priceCents, order.feeRateBps);
  const net = order.priceCents - fee;
  const txnId = crypto.randomUUID();

  const escrowAccount = await getOrCreateLedgerAccount(tx, "PLATFORM", "ESCROW");
  const sellerPending = await getOrCreateLedgerAccount(tx, order.sellerId, "USER_PENDING");
  const platformRevenue = await getOrCreateLedgerAccount(tx, "PLATFORM", "PLATFORM_REVENUE");

  const legs = [
    { accountId: escrowAccount.id,   amountCents: -order.priceCents, entryType: "ORDER_COMPLETED" as const },
    { accountId: sellerPending.id,   amountCents: net,               entryType: "ORDER_COMPLETED" as const },
    { accountId: platformRevenue.id, amountCents: fee,               entryType: "ORDER_COMPLETED" as const },
  ];

  assertZeroSum(legs);

  await tx.insert(ledgerEntries).values(
    legs.map((l) => ({
      ...l,
      txnId,
      orderId:     order.id,
      description: `Order #${order.id} completion settlement`,
    })),
  );

  await tx
    .update(ledgerAccounts)
    .set({ balanceCents: sql`balance_cents - ${order.priceCents}` })
    .where(eq(ledgerAccounts.id, escrowAccount.id));
  await tx
    .update(ledgerAccounts)
    .set({ balanceCents: sql`balance_cents + ${net}` })
    .where(eq(ledgerAccounts.id, sellerPending.id));
  await tx
    .update(ledgerAccounts)
    .set({ balanceCents: sql`balance_cents + ${fee}` })
    .where(eq(ledgerAccounts.id, platformRevenue.id));
}

async function postClearingEntry(orderId: string, sellerId: string, netCents: number) {
  const txnId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    const pending = await getOrCreateLedgerAccount(tx, sellerId, "USER_PENDING");
    const available = await getOrCreateLedgerAccount(tx, sellerId, "USER_AVAILABLE");

    const legs = [
      { accountId: pending.id,   amountCents: -netCents, entryType: "CLEARING" as const },
      { accountId: available.id, amountCents: netCents,  entryType: "CLEARING" as const },
    ];

    assertZeroSum(legs);

    await tx.insert(ledgerEntries).values(
      legs.map((l) => ({
        ...l,
        txnId,
        orderId,
        description: `Funds cleared for order #${orderId}`,
      })),
    );

    await tx
      .update(ledgerAccounts)
      .set({ balanceCents: sql`balance_cents - ${netCents}` })
      .where(eq(ledgerAccounts.id, pending.id));
    await tx
      .update(ledgerAccounts)
      .set({ balanceCents: sql`balance_cents + ${netCents}` })
      .where(eq(ledgerAccounts.id, available.id));
  });
}
