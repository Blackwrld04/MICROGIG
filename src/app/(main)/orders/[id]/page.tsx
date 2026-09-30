import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderWorkspace } from "@/components/order/order-workspace";
import { requireUser } from "@/modules/auth/session";
import { getOrder } from "@/modules/orders/queries";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return { title: `Order #${params.id}` };
}

/** Order workspace — ORD-03, PRD §16.4. Non-participants get a 404 (IDOR guard, §13.3). */
export default async function OrderWorkspacePage({ params }: { params: { id: string } }) {
  const user = await requireUser({ next: `/orders/${params.id}` });
  const now = Date.now();
  const result = await getOrder(params.id, user, now);
  if (!result) notFound();
  return <OrderWorkspace initial={result.order} serverNow={now} readOnly={result.readOnly} />;
}
