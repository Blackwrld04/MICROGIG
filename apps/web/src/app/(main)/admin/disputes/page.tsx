import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { DisputeList } from "@/components/admin/dispute-resolver";

export const metadata: Metadata = { title: "Disputes" };

/** Admin dispute triage — ORD-14. */
export default async function AdminDisputesPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.disputes(), queryFn: () => serverData.disputes() });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disputes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Decide each dispute: full refund to the buyer, full release to the seller, or a custom split.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DisputeList />
      </HydrationBoundary>
    </div>
  );
}
