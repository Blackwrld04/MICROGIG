import type { Metadata } from "next";
import { WalletView } from "@/components/wallet/wallet-view";
import { getWallet } from "@/modules/ledger/queries";

export const metadata: Metadata = { title: "Wallet" };
export const dynamic = "force-dynamic"; // personal financial data: never cache

/** Wallet & earnings — PRD §11.6 / §16.7. */
export default async function WalletPage() {
  const { summary, activity } = await getWallet(Date.now());
  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold">Wallet &amp; earnings</h1>
      <WalletView initialSummary={summary} initialActivity={activity} />
    </div>
  );
}
