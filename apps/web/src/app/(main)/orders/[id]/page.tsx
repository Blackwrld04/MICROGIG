import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { OrderWorkspace } from "@/components/order/order-workspace";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { requireUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return { title: `Order #${params.id}` };
}

/** Order workspace — ORD-03, PRD §16.4. Non-participants get a 404 (IDOR guard, §13.3). */
export default async function OrderWorkspacePage({ params }: { params: { id: string } }) {
  await requireUser({ next: `/orders/${params.id}` });
  const result = await serverData.order(params.id);
  if (!result) notFound();
  const queryClient = getQueryClient();
  queryClient.setQueryData(queries.order(params.id).queryKey, result);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderWorkspace orderId={params.id} serverNow={Date.now()} />
    </HydrationBoundary>
  );
}
