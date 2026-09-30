import "server-only";
import { MOCK_LIFETIME_EARNINGS_CENTS, MOCK_PENDING_CENTS, mockWalletActivity } from "@/mocks/account";
import { buildMockOrders } from "@/mocks/orders";
import type { WalletSummary } from "./contracts";

/*
 * Wallet reads — PRD §11.6.
 * TODO(ledger owner): SUM(amount) per ledger account; keep the return shape.
 */

export async function getWallet(nowMs: number) {
  const activity = mockWalletActivity(nowMs);
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
