import { formatDateTime } from "@/lib/time";
import type { OrderEvent } from "@/modules/orders/types";

/** Immutable order_events audit trail — ORD-03 "Activity Audit". */
export function ActivityLog({ events }: { events: OrderEvent[] }) {
  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-heading" />
          <p className="text-sm font-semibold text-heading">{e.label}</p>
          <p className="text-xs text-muted-foreground">
            {e.actor} · <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
          </p>
          {e.detail ? <p className="mt-1 text-sm">{e.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
