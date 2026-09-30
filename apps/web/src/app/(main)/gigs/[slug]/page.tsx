import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { GigDetailView, type GigViewer } from "@/components/gig/gig-detail-view";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { getCurrentUser } from "@/modules/auth/session";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const gig = await serverData.gig(params.slug);
  return { title: gig?.title ?? "Gig not found", description: gig?.description.slice(0, 160) };
}

/** Gig details & order entry — PRD §16.3, GIG-07 / GIG-10 / GIG-11. */
export default async function GigDetailPage({ params }: { params: { slug: string } }) {
  const gig = await serverData.gig(params.slug);
  if (!gig) notFound();
  const queryClient = getQueryClient();
  queryClient.setQueryData(queries.gig(params.slug).queryKey, gig);

  const user = await getCurrentUser();
  const viewer: GigViewer = !user
    ? "guest"
    : user.isAdmin
      ? "admin"
      : user.accountType === "CLIENT"
        ? "client"
        : user.fullName === gig.sellerCard.displayName
          ? "own"
          : "freelancer";

  await Promise.all([
    queryClient.prefetchQuery({ ...queries.moreFromSeller(gig.id), queryFn: () => serverData.moreFromSeller(gig.id) }),
    viewer === "client" ? queryClient.prefetchQuery({ ...queries.wallet(), queryFn: () => serverData.wallet() }) : null,
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GigDetailView slug={params.slug} viewer={viewer} serverNow={Date.now()} />
    </HydrationBoundary>
  );
}
