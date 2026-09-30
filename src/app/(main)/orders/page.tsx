import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Star } from "lucide-react";
import { LateBadge, OrderStatusBadge } from "@/components/order/order-status-badge";
import { ORDER_TABS, type OrderTab } from "@/lib/constants/order-status";
import { formatCents } from "@/lib/money";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { listOrders, roleFor, type OrderRow } from "@/modules/orders/queries";
import type { ViewerRole } from "@/modules/orders/types";

export const metadata: Metadata = { title: "Manage orders" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function href(tab: OrderTab, q?: string) {
  const p = new URLSearchParams({ tab });
  if (q) p.set("q", q);
  return `/orders?${p.toString()}`;
}

function DueCell({ row, role, now }: { row: OrderRow; role: ViewerRole; now: number }) {
  if (!row.dueAt) return <span className="text-muted-foreground">—</span>;
  if (row.status === "DELIVERED") {
    return <span>Auto-completes {formatRelative(row.dueAt, now).toLowerCase()}</span>;
  }
  return (
    <span className={cn(row.isLate && "font-semibold text-red-700")}>
      {row.isLate ? `Overdue ${formatRelative(row.dueAt, now).replace(" ago", "")}` : formatRelative(row.dueAt, now)}
      {row.lateRemedyAvailable && role === "buyer" ? (
        <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-3 w-3" aria-hidden /> 24h past deadline: cancel &amp; refund available
        </span>
      ) : null}
    </span>
  );
}

/** Manage Orders — PRD §16.5, ORD-11 / ORD-12 / ORD-16. */
export default async function ManageOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser({ next: "/orders" });
  const role: ViewerRole = roleFor(user.accountType);
  const tabParam = one(searchParams.tab);
  const tab: OrderTab = ORDER_TABS.some((t) => t.id === tabParam) ? (tabParam as OrderTab) : "priority";
  const q = one(searchParams.q)?.trim() || undefined;
  const now = Date.now();
  const { counts, orders } = await listOrders(role, tab, q, now);
  const counterpartyLabel = role === "buyer" ? "Seller" : "Buyer";

  return (
    <div className="container space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{role === "buyer" ? "My orders" : "Orders to deliver"}</h1>
        <p className="text-sm text-muted-foreground">
          {role === "buyer" ? "Gigs you've ordered" : "Orders from your clients"}
        </p>
      </div>

      <nav aria-label="Order tabs" className="flex overflow-x-auto border-b border-border">
        {ORDER_TABS.map((t) => (
          <Link
            key={t.id}
            href={href(t.id, q)}
            aria-current={t.id === tab ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold",
              t.id === tab ? "border-primary text-heading" : "border-transparent text-muted-foreground hover:text-heading",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs", t.id === "late" && counts.late > 0 ? "bg-red-50 text-red-700" : "bg-surface")}>
              {counts[t.id]}
            </span>
          </Link>
        ))}
      </nav>

      <form action="/orders" method="get" role="search" className="max-w-md">
                <input type="hidden" name="tab" value={tab} />
        <label htmlFor="order-search" className="sr-only">
          Search orders
        </label>
        <input
          id="order-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search orders by number or gig title…"
          className="h-10 w-full rounded-md border border-input px-3 text-sm text-heading placeholder:text-muted-foreground"
        />
      </form>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="font-semibold text-heading">No orders here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === "buyer" ? (
              <>
                Find something to order in the{" "}
                <Link href="/gigs" className="font-semibold text-heading underline">
                  catalog
                </Link>
                .
              </>
            ) : (
              <>
                Beginnings are exciting! Share your gigs or{" "}
                <Link href="/gigs/new" className="font-semibold text-heading underline">
                  create a new one
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-left text-sm md:table">
            <caption className="sr-only">
              {ORDER_TABS.find((t) => t.id === tab)?.label} orders
            </caption>
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="py-3 pr-4 font-semibold">Order</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Gig</th>
                <th scope="col" className="py-3 pr-4 font-semibold">{counterpartyLabel}</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Due</th>
                <th scope="col" className="py-3 pr-4 text-right font-semibold">Total</th>
                <th scope="col" className="py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="align-top hover:bg-surface">
                  <td className="py-3 pr-4">
                    <Link href={`/orders/${o.id}`} className="font-semibold text-heading underline">
                      #{o.orderNumber}
                    </Link>
                    {o.isStarred ? <Star className="ml-1 inline h-3.5 w-3.5 fill-heading text-heading" aria-label="Starred" /> : null}
                  </td>
                  <td className="max-w-xs py-3 pr-4">{o.gigTitle}</td>
                  <td className="py-3 pr-4">{o.counterpartyName}</td>
                  <td className="py-3 pr-4">
                    <DueCell row={o} role={role} now={now} />
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-heading">{formatCents(o.priceCents)}</td>
                  <td className="space-x-1 py-3">
                    <OrderStatusBadge status={o.status} />
                    {o.isLate ? <LateBadge /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="block space-y-2 rounded-lg border border-border p-4 hover:bg-surface">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-heading">#{o.orderNumber}</span>
                    <span className="font-semibold text-heading">{formatCents(o.priceCents)}</span>
                  </div>
                  <p className="text-sm">{o.gigTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {counterpartyLabel}: {o.counterpartyName}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <OrderStatusBadge status={o.status} />
                    {o.isLate ? <LateBadge /> : null}
                  </div>
                  <p className="text-xs">
                    <DueCell row={o} role={role} now={now} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
