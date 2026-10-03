import { db } from "../../db/connection.js";
import { ledgerAccounts, ledgerEntries, orders } from "../../db/schema/index.js";
import { eq, and, sql } from "drizzle-orm";
import { assertZeroSum, assertSufficientBalance } from "../../lib/money.js";
import { getOrCreateLedgerAccount } from "../../lib/cron.js";
import type { AuthUser } from "../../types/auth.js";

export async function getWalletData(user: AuthUser) {
  const isFreelancer  = user.accountType === "FREELANCER";
  const availableAcct = await getOrCreateLedgerAccount(db, user.id, "USER_AVAILABLE");

  const userAccounts = await db.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(eq(ledgerAccounts.userId, user.id));

  const rawEntries = userAccounts.length > 0
    ? await db
        .select({ txnId: ledgerEntries.txnId, createdAt: ledgerEntries.createdAt, description: ledgerEntries.description, type: ledgerEntries.entryType, amountCents: ledgerEntries.amountCents })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.accountId, availableAcct.id))
        .orderBy(ledgerEntries.createdAt)
    : [];

  let running = 0;
  const activity = rawEntries.map((e) => {
    running += e.amountCents;
    return { txnId: e.txnId, createdAt: e.createdAt.toISOString(), description: e.description, type: e.type, amountCents: e.amountCents, balanceCents: running };
  }).reverse();

  if (isFreelancer) {
    const pendingAcct = await getOrCreateLedgerAccount(db, user.id, "USER_PENDING");

    const activeOrders = await db
      .select({ priceCents: orders.priceCents })
      .from(orders)
      .where(and(eq(orders.sellerId, user.id), sql`${orders.status} IN ('IN_PROGRESS', 'IN_REVISION', 'DELIVERED')`));
    const inActiveOrders = activeOrders.reduce((acc, o) => acc + o.priceCents, 0);

    const [lifetimeRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(amount_cents), 0)::int` })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.accountId, pendingAcct.id), sql`${ledgerEntries.amountCents} > 0`));

    return {
      accountType: "FREELANCER" as const,
      summary: { available: availableAcct.balanceCents, pending: pendingAcct.balanceCents, inActiveOrders, lifetimeEarnings: lifetimeRes?.total ?? 0 },
      activity,
    };
  }

  const clientActiveOrders = await db
    .select({ priceCents: orders.priceCents })
    .from(orders)
    .where(and(eq(orders.buyerId, user.id), sql`${orders.status} IN ('PENDING_REQUIREMENTS', 'IN_PROGRESS', 'IN_REVISION', 'DELIVERED')`));
  const inEscrow = clientActiveOrders.reduce((acc, o) => acc + o.priceCents, 0);

  const [spentRes] = await db
    .select({ total: sql<number>`COALESCE(SUM(ABS(amount_cents)), 0)::int` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.accountId, availableAcct.id), eq(ledgerEntries.entryType, "ORDER_PLACED")));

  return {
    accountType: "CLIENT" as const,
    summary: { available: availableAcct.balanceCents, inEscrow, totalSpent: spentRes?.total ?? 0 },
    activity,
  };
}

export async function topUpWallet(userId: string, amountCents: number) {
  const txnId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    const funding   = await getOrCreateLedgerAccount(tx, userId, "BUYER_FUNDING");
    const available = await getOrCreateLedgerAccount(tx, userId, "USER_AVAILABLE");

    const legs = [
      { accountId: funding.id,   amountCents: -amountCents, entryType: "TOP_UP" as const },
      { accountId: available.id, amountCents:  amountCents, entryType: "TOP_UP" as const },
    ];
    assertZeroSum(legs);
    await tx.insert(ledgerEntries).values(legs.map((l) => ({ ...l, txnId, description: `Virtual wallet top-up of $${(amountCents / 100).toFixed(2)}` })));
    await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents - ${amountCents}` }).where(eq(ledgerAccounts.id, funding.id));
    await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents + ${amountCents}` }).where(eq(ledgerAccounts.id, available.id));
  });

  const [updated] = await db.select({ balanceCents: ledgerAccounts.balanceCents }).from(ledgerAccounts).where(and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.kind, "USER_AVAILABLE"))).limit(1);
  return { balanceCents: updated?.balanceCents ?? 0 };
}

export async function withdrawWallet(userId: string, amountCents: number) {
  const txnId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    const available = await getOrCreateLedgerAccount(tx, userId, "USER_AVAILABLE");
    const funding   = await getOrCreateLedgerAccount(tx, userId, "BUYER_FUNDING");

    assertSufficientBalance(available.balanceCents, amountCents);

    const legs = [
      { accountId: available.id, amountCents: -amountCents, entryType: "WITHDRAWAL" as const },
      { accountId: funding.id,   amountCents:  amountCents, entryType: "WITHDRAWAL" as const },
    ];
    assertZeroSum(legs);
    await tx.insert(ledgerEntries).values(legs.map((l) => ({ ...l, txnId, description: `Simulated payout of $${(amountCents / 100).toFixed(2)}` })));
    await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents - ${amountCents}` }).where(eq(ledgerAccounts.id, available.id));
    await tx.update(ledgerAccounts).set({ balanceCents: sql`balance_cents + ${amountCents}` }).where(eq(ledgerAccounts.id, funding.id));
  });

  const [updated] = await db.select({ balanceCents: ledgerAccounts.balanceCents }).from(ledgerAccounts).where(and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.kind, "USER_AVAILABLE"))).limit(1);
  return { balanceCents: updated?.balanceCents ?? 0 };
}
