import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderWorkspace } from "@/components/order/order-workspace";
import { getOrder } from "@/modules/orders/queries";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return { title: `Order #${params.id}` };
}

/** Order workspace — ORD-03, PRD §16.4. */
export default async function OrderWorkspacePage({ params }: { params: { id: string } }) {
  const now = Date.now();
  const order = await getOrder(params.id, now);
  if (!order) notFound();
  return <OrderWorkspace initial={order} serverNow={now} />;
}
