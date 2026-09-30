import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { OrdersView } from "@/components/order/orders-view";
import { serverData } from "@/lib/api/server-data";
import { ORDER_TABS, type OrderTab } from "@/lib/constants/order-status";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Manage orders" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Manage Orders — PRD §16.5. The side shown (buying or selling) comes from the account type. */
export default async function ManageOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser({ next: "/orders" });
  const tabParam = one(searchParams.tab);
  const tab: OrderTab = ORDER_TABS.some((t) => t.id === tabParam) ? (tabParam as OrderTab) : "priority";
  const q = one(searchParams.q)?.trim() || undefined;

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.orders(tab, q), queryFn: () => serverData.orders(tab, q) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersView role={user.accountType === "FREELANCER" ? "seller" : "buyer"} tab={tab} q={q} serverNow={Date.now()} />
    </HydrationBoundary>
  );
}
