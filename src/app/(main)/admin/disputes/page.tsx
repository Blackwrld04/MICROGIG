import type { Metadata } from "next";
import { DisputeResolver } from "@/components/admin/dispute-resolver";
import { listDisputedOrders } from "@/modules/orders/queries";

export const metadata: Metadata = { title: "Disputes" };

/** Admin dispute triage — ORD-14. */
export default async function AdminDisputesPage() {
  const disputes = await listDisputedOrders(Date.now());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disputes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Decide each dispute: full refund to the buyer, full release to the seller, or a custom split.
        </p>
      </div>
      {disputes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No open disputes.</p>
      ) : (
        disputes.map((o) => <DisputeResolver key={o.id} order={o} />)
      )}
    </div>
  );
}
