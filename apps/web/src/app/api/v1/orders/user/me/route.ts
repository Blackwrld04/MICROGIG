import { ORDER_TABS, type OrderTab } from "@/lib/constants/order-status";
import { serverData } from "@/lib/api/server-data";
import { demoJson } from "@/app/api/v1/demo-route";

export const dynamic = "force-dynamic";

/** GET /api/v1/orders/user/me?tab=&q= — ORD-12 (demo). */
export function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const tabParam = sp.get("tab");
  const tab: OrderTab = ORDER_TABS.some((t) => t.id === tabParam) ? (tabParam as OrderTab) : "priority";
  return demoJson(() => serverData.orders(tab, sp.get("q") ?? undefined));
}
