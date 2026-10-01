import { ORDER_TABS, type OrderTab } from "@/lib/constants/order-status";
import { isLate } from "@/lib/time";
import type { OrderDetail } from "./types";

type TabInput = Pick<OrderDetail, "status" | "deadline" | "revisionDeadline" | "isStarred">;

/** Manage Orders tab membership — ORD-12. */
export function inTab(order: TabInput, tab: OrderTab, nowMs: number): boolean {
  const late = isLate(order, nowMs);
  switch (tab) {
    case "priority":
      return late || order.status === "DELIVERED"; // Late + Delivered awaiting buyer action
    case "active":
      return ["PENDING_REQUIREMENTS", "IN_PROGRESS", "IN_REVISION", "DISPUTED"].includes(order.status);
    case "late":
      return late;
    case "delivered":
      return order.status === "DELIVERED";
    case "completed":
      return order.status === "COMPLETED";
    case "cancelled":
      return order.status === "CANCELLED";
    case "starred":
      return order.isStarred;
  }
}

export function tabCounts(orders: TabInput[], nowMs: number): Record<OrderTab, number> {
  return Object.fromEntries(
    ORDER_TABS.map((t) => [t.id, orders.filter((o) => inTab(o, t.id, nowMs)).length]),
  ) as Record<OrderTab, number>;
}
