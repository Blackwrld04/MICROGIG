import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderDetail } from "@/modules/orders/types";

const STEPS = ["Placed", "Requirements", "In progress", "Delivered", "Completed"] as const;

/** Index of the current step; steps before it are complete. STEPS.length = all done. */
function currentIndex(order: OrderDetail): number {
  switch (order.status) {
    case "PENDING_REQUIREMENTS":
      return 1;
    case "IN_PROGRESS":
    case "IN_REVISION":
      return 2;
    case "DELIVERED":
      return 3;
    case "COMPLETED":
      return STEPS.length;
    default:
      // CANCELLED / DISPUTED: freeze at the furthest step reached.
      return order.deliveries.length > 0 ? 3 : order.requirementsAnswers ? 2 : 1;
  }
}

/** Order status stepper — ORD-03, §16.4. IN_REVISION loops back to "In progress". */
export function OrderStepper({ order }: { order: OrderDetail }) {
  const current = currentIndex(order);
  const frozen = order.status === "CANCELLED" || order.status === "DISPUTED";

  return (
    <ol className="flex items-center gap-2 overflow-x-auto text-sm" aria-label="Order progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current && !frozen;
        const text =
          label === "In progress" && order.status === "IN_REVISION"
            ? `Revision ${order.revisionsUsed} of ${order.revisionsIncluded}`
            : label;
        return (
          <li key={label} className="flex shrink-0 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold",
                done && "border-heading bg-heading text-white",
                active && "border-heading bg-primary text-primary-foreground",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn(done || active ? "font-semibold text-heading" : "text-muted-foreground")}>
              {text}
              <span className="sr-only">{done ? " (done)" : active ? " (current)" : ""}</span>
            </span>
            {i < STEPS.length - 1 ? <span aria-hidden className="h-px w-6 bg-border md:w-10" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
