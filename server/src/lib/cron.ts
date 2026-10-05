import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/connection.js";
import { orders, orderEvents, notifications, ledgerAccounts, ledgerEntries } from "../db/schema/index.js";
import { eq, lte, and, sql, isNull } from "drizzle-orm";
import { env } from "../env.js";
import { platformFeeCents, sellerNetCents, assertZeroSum } from "./money.js";
import { createAndDispatchNotification } from "../modules/notifications/notifications.service.js";

export function startReconcilerCron(log: FastifyBaseLogger) {
  log.info("Starting reconciler cron jobs...");

  // ── Every 5 minutes: auto-complete overdue DELIVERED orders ──────────────
  cron.schedule("*/5 * * * *", async () => {
    try {
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
        .where(
          and(
            eq(orders.status, "DELIVERED"),
            lte(orders.autoCompleteAt, now),
          ),
        );

      for (const order of overdue) {
        await db.transaction(async (tx) => {
          const result = await tx
            .update(orders)
            .set({ status: "COMPLETED", completedAt: now, updatedAt: now })
            .where(and(eq(orders.id, order.id), eq(orders.status, "DELIVERED")))
            .returning({ id: orders.id });

          if (result.length === 0) return;

          await settleOrderCompletion(tx, order);

          await tx.insert(orderEvents).values({
            orderId: order.id,
            label:   "Auto-completed",
            actor:   "System",
            detail:  "72-hour review window elapsed",
          });

          await createAndDispatchNotification({
            userId:  order.buyerId,
            type:    "ORDER_COMPLETED",
            orderId: order.id,
            message: `Order #${order.orderNumber} was auto-completed. Leave a review!`,
            tx,
          });

          log.info({ orderId: order.id }, "Auto-completed order");
        });
      }
    } catch (err) {
      log.error({ err }, "Auto-complete cron failed");
    }
  });

  // ── Every 10 minutes: clear USER_PENDING → USER_AVAILABLE (3-day hold) ──
  cron.schedule("*/10 * * * *", async () => {
    try {
      const clearingCutoff = new Date(
        Date.now() - env.CLEARING_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      );

      const toSettle = await db.execute(sql`
        SELECT
          o.id          AS order_id,
          o.seller_id,
          o.price_cents,
          o.fee_rate_bps
        FROM orders o
        WHERE o.status = 'COMPLETED'
          AND o.completed_at <= ${clearingCutoff.toISOString()}
          AND NOT EXISTS (
            SELECT 1
            FROM ledger_entries le
            JOIN ledger_accounts la ON la.id = le.account_id
            WHERE la.user_id   = o.seller_id
              AND le.entry_type = 'CLEARING'
              AND le.order_id   = o.id
          )
        LIMIT 50
      `);

      for (const row of (toSettle as any[])) {
        await postClearingEntry(
          row.order_id,
          row.seller_id,
          sellerNetCents(Number(row.price_cents), Number(row.fee_rate_bps)),
        );
        log.info({ orderId: row.order_id }, "Funds cleared to seller");
      }
    } catch (err) {
      log.error({ err }, "Clearing cron failed");
    }
  });

  // ── Hourly: emit LATE_WARNING notifications for overdue orders ────────────
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const lateOrders = await db
        .select({
          id:          orders.id,
          buyerId:     orders.buyerId,
          sellerId:    orders.sellerId,
          orderNumber: orders.orderNumber,
        })
        .from(orders)
        .where(
          and(
            sql`${orders.status} IN ('IN_PROGRESS', 'IN_REVISION')`,
            lte(orders.deadline, now),
          ),
        );

      for (const order of lateOrders) {
        const existing = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.orderId, order.id),
              eq(notifications.type, "LATE_WARNING"),
            ),
          )
          .limit(1);

        if (existing.length > 0) continue;

        await createAndDispatchNotification({
          userId:  order.buyerId,
          type:    "LATE_WARNING",
          orderId: order.id,
          message: `Order #${order.orderNumber} is past its delivery deadline.`,
        });
        await createAndDispatchNotification({
          userId:  order.sellerId,
          type:    "LATE_WARNING",
          orderId: order.id,
          message: `Your delivery for order #${order.orderNumber} is overdue.`,
        });
      }
    } catch (err) {
      log.error({ err }, "Late-warning cron failed");
    }
  });

  // ── Hourly: 24-hour reminder before auto-completion (ORD-06) ─────────────
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const warningWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const approaching = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          buyerId: orders.buyerId,
          autoCompleteAt: orders.autoCompleteAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.status, "DELIVERED"),
            lte(orders.autoCompleteAt, warningWindow),
            sql`${orders.autoCompleteAt} > ${now}`,
          ),
        );

      for (const order of approaching) {
        const existing = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.orderId, order.id),
              eq(notifications.type, "AUTO_COMPLETE_WARNING"),
            ),
          )
          .limit(1);

        if (existing.length > 0) continue;

        await createAndDispatchNotification({
          userId: order.buyerId,
          type: "AUTO_COMPLETE_WARNING",
          orderId: order.id,
          message: `Order #${order.orderNumber} will be automatically accepted in less than 24 hours. Please review the deliverable!`,
        });
        log.info({ orderId: order.id }, "Dispatched 24-hour auto-complete warning");
      }
    } catch (err) {
      log.error({ err }, "Auto-complete warning cron failed");
    }
  });

  // ── Midnight UTC: Ledger Invariant Audit Job (PRD Appendix E) ─────────────
  cron.schedule("0 0 * * *", async () => {
    try {
      await runLedgerAudit(log);
    } catch (err) {
      log.error({ err }, "Ledger audit cron failed");
    }
  }, {
    timezone: "UTC",
  });

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
