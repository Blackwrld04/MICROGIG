/** Order statuses — PRD Appendix B `OrderStatus`. */
export const ORDER_STATUSES = [
  "PENDING_REQUIREMENTS",
  "IN_PROGRESS",
  "DELIVERED",
  "IN_REVISION",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Label + AA-contrast badge classes. Status is always conveyed by text, never colour alone. */
export const ORDER_STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  PENDING_REQUIREMENTS: { label: "Awaiting requirements", className: "bg-amber-50 text-amber-800" },
  IN_PROGRESS: { label: "In progress", className: "bg-blue-50 text-blue-800" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-50 text-emerald-800" },
  IN_REVISION: { label: "In revision", className: "bg-orange-50 text-orange-800" },
  COMPLETED: { label: "Completed", className: "bg-surface text-heading" },
  CANCELLED: { label: "Cancelled", className: "bg-surface text-muted-foreground" },
  DISPUTED: { label: "Disputed", className: "bg-purple-50 text-purple-800" },
};

/** Manage Orders tabs — ORD-12. */
export const ORDER_TABS = [
  { id: "priority", label: "Priority" },
  { id: "active", label: "Active" },
  { id: "late", label: "Late" },
  { id: "delivered", label: "Delivered" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "starred", label: "Starred" },
] as const;

export type OrderTab = (typeof ORDER_TABS)[number]["id"];
