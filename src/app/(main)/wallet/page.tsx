import type { Metadata } from "next";
import { WalletView } from "@/components/wallet/wallet-view";
import { requireUser } from "@/modules/auth/session";
import { getClientWallet, getFreelancerWallet } from "@/modules/ledger/queries";

export const metadata: Metadata = { title: "Wallet" };
export const dynamic = "force-dynamic"; // personal financial data: never cache

/**
 * Wallet — PRD §11.6 / §16.7. Freelancers see earnings (available, pending clearance,
 * in active orders, lifetime) and can withdraw; clients see their spending balance and top up.
 */
export default async function WalletPage() {
  const user = await requireUser({ next: "/wallet" });
  const now = Date.now();

  if (user.accountType === "FREELANCER") {
    const { summary, activity } = await getFreelancerWallet(now);
    return (
      <div className="container space-y-6 py-8">
        <h1 className="text-2xl font-bold">Earnings</h1>
        <WalletView
          mode="FREELANCER"
          initialAvailable={summary.available}
          cards={[
            { label: "Available for withdrawal", value: summary.available, note: "Withdraw any time" },
            { label: "Pending clearance", value: summary.pending, note: "3-day hold after completion" },
            { label: "In active orders", value: summary.inActiveOrders, note: "Held in escrow" },
            { label: "Earnings to date", value: summary.lifetimeEarnings, note: "Before withdrawals" },
          ]}
          initialActivity={activity}
        />
      </div>
    );
  }

  const { summary, activity } = await getClientWallet(now);
  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <WalletView
        mode="CLIENT"
        initialAvailable={summary.available}
        cards={[
          { label: "Available balance", value: summary.available, note: "Spend on new orders" },
          { label: "In escrow", value: summary.inEscrow, note: "Released when you accept delivery" },
          { label: "Total spent", value: summary.totalSpent, note: "Completed orders" },
        ]}
        initialActivity={activity}
      />
    </div>
  );
}
