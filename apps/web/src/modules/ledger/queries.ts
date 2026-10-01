import "server-only";
import { MOCK_LIFETIME_EARNINGS_CENTS, MOCK_PENDING_CENTS, mockWalletActivity } from "@/mocks/account";
import { buildMockOrders } from "@/mocks/orders";
import type { AccountType } from "@/modules/auth/contracts";
import type { ClientWalletSummary, WalletSummary } from "./contracts";

/*
 * Wallet reads — PRD §11.6.
 * TODO(ledger owner): SUM(amount) per ledger account; keep the return shapes.
 */

const IN_ESCROW = ["PENDING_REQUIREMENTS", "IN_PROGRESS", "DELIVERED", "IN_REVISION", "DISPUTED"];

/** Freelancer wallet: the four §11.6 earnings cards. */
export async function getFreelancerWallet(nowMs: number) {
  const activity = mockWalletActivity("FREELANCER", nowMs);
  const inActiveOrders = buildMockOrders(nowMs)
    .filter((o) => o.viewerRole === "seller" && ["IN_PROGRESS", "DELIVERED", "IN_REVISION"].includes(o.status))
    .reduce((sum, o) => sum + o.priceCents, 0);
  const summary: WalletSummary = {
    available: activity.at(-1)?.balanceCents ?? 0,
    pending: MOCK_PENDING_CENTS,
    inActiveOrders,
    lifetimeEarnings: MOCK_LIFETIME_EARNINGS_CENTS,
  };
  return { summary, activity: [...activity].reverse() };
}

/** Client wallet: spendable balance, money held in escrow for open orders, total spent. */
export async function getClientWallet(nowMs: number) {
  const activity = mockWalletActivity("CLIENT", nowMs);
  const buyerOrders = buildMockOrders(nowMs).filter((o) => o.viewerRole === "buyer");
  const summary: ClientWalletSummary = {
    available: activity.at(-1)?.balanceCents ?? 0,
    inEscrow: buyerOrders.filter((o) => IN_ESCROW.includes(o.status)).reduce((s, o) => s + o.priceCents, 0),
    totalSpent: buyerOrders.filter((o) => o.status === "COMPLETED").reduce((s, o) => s + o.priceCents, 0),
  };
  return { summary, activity: [...activity].reverse() };
}

/** Spendable balance for checkout (clients only). */
export async function getAvailableBalance(accountType: AccountType, nowMs: number): Promise<number> {
  return accountType === "CLIENT" ? (await getClientWallet(nowMs)).summary.available : 0;
}
