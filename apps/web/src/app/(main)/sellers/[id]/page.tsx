import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { SellerView } from "@/components/seller/seller-view";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const page = await serverData.seller(params.id);
  return { title: page?.seller.displayName ?? "Seller not found" };
}

/** Public seller page — SEL-03 (seller card, bio, skills, gigs, reviews). */
export default async function SellerPage({ params }: { params: { id: string } }) {
  const page = await serverData.seller(params.id);
  if (!page) notFound();
  const queryClient = getQueryClient();
  queryClient.setQueryData(queries.seller(params.id).queryKey, page);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SellerView id={params.id} serverNow={Date.now()} />
    </HydrationBoundary>
  );
}
