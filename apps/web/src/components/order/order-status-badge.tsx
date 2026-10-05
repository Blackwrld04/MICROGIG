import { AlertTriangle } from "lucide-react";
import { ORDER_STATUS_META, type OrderStatus } from "@/lib/constants/order-status";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-300", meta.className, className)}>
      {meta.label}
    </span>
  );
}

/** Red "Late" warning badge — ORD-11. */
export function LateBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      <AlertTriangle className="h-3 w-3" aria-hidden />
      Late
    </span>
  );
}
