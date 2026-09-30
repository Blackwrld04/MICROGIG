import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { VerificationQueue } from "@/components/admin/verification-queue";

export const metadata: Metadata = { title: "ID verifications" };

/** Admin ID verification queue — SEL-02, §19 risk #5. */
export default async function AdminVerificationsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.verifications(), queryFn: () => serverData.verifications() });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ID verifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve sellers so their gigs become visible in the catalog.</p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <VerificationQueue />
      </HydrationBoundary>
    </div>
  );
}
