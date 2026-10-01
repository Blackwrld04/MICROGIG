import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { DashboardView } from "@/components/seller/dashboard-view";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Seller dashboard" };
export const dynamic = "force-dynamic";

/** Seller dashboard & onboarding — PRD §16.6, SEL-02. Freelancer accounts only. */
export default async function SellerDashboardPage() {
  await requireUser({ next: "/seller/dashboard", accountType: "FREELANCER" });
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.dashboard(), queryFn: () => serverData.dashboard() });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView />
    </HydrationBoundary>
  );
}
