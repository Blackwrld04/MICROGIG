import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { WalletView } from "@/components/wallet/wallet-view";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Wallet" };
export const dynamic = "force-dynamic"; // personal financial data: never cache

/**
 * Wallet — PRD §11.6 / §16.7. Freelancers see earnings and can withdraw; clients see their
 * spending balance and top up. The response says which (client XOR freelancer).
 */
export default async function WalletPage() {
  const user = await requireUser({ next: "/wallet" });
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.wallet(), queryFn: () => serverData.wallet() });

  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold">{user.accountType === "FREELANCER" ? "Earnings" : "Wallet"}</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <WalletView />
      </HydrationBoundary>
    </div>
  );
}
