import { z } from "zod";
import { ORDER_STATUSES, ORDER_TABS } from "@/lib/constants/order-status";

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const orderTabSchema = z.enum(ORDER_TABS.map((t) => t.id) as [string, ...string[]]);

/** Row in GET /api/v1/orders/user/me — ORD-11/ORD-12. */
export const orderSummarySchema = z.object({
  id: z.string(),
  orderNumber: z.number().int(),
  gigTitle: z.string(),
  counterpartyName: z.string(),
  status: orderStatusSchema,
  priceCents: z.number().int(),
  deadline: z.string().nullable(),
  revisionDeadline: z.string().nullable(),
  isLate: z.boolean(),
  isStarred: z.boolean(),
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;

export const orderListSchema = z.object({
  counts: z.record(z.number().int()),
  orders: z.array(orderSummarySchema),
});
export type OrderList = z.infer<typeof orderListSchema>;

/** POST /orders/:id/revision — T-07 requires feedback ≥ 20 chars. */
export const revisionRequestSchema = z.object({
  feedback: z.string().trim().min(20, "Please give at least 20 characters of feedback"),
});

/** POST /orders/:id/dispute — T-09 requires reason ≥ 50 chars. */
export const disputeSchema = z.object({
  reason: z.string().trim().min(50, "Please describe the issue in at least 50 characters"),
});

/** POST /orders/:id/review — REV-01. */
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(500).optional(),
});
