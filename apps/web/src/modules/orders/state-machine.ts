import { DAY_MS, HOUR_MS } from "@/lib/time";
import type { OrderDelivery, OrderDetail, ViewerRole } from "./types";

/**
 * Client-side view of the PRD §10.1 transition matrix. The server remains the
 * authority (it re-checks every guard and returns 409 on races); this only decides
 * which buttons to show and powers demo mode.
 */
export type OrderAction =
  | "SUBMIT_REQUIREMENTS" // T-02
  | "CANCEL_UNSTARTED" // T-03
  | "DELIVER" // T-04, T-08
  | "ACCEPT" // T-05
  | "REQUEST_REVISION" // T-07
  | "OPEN_DISPUTE" // T-09
  | "LATE_CANCEL" // T-13 (ORD-15)
  | "REQUEST_MUTUAL_CANCEL" // T-14 proposal (ORD-10)
  | "ACCEPT_MUTUAL_CANCEL" // T-14 counterparty approval
  | "LEAVE_REVIEW"; // REV-01

export const AUTO_COMPLETE_HOURS = 72;
export const REVISION_DEADLINE_HOURS = 24;
export const LATE_REMEDY_HOURS = 24;
export const REVIEW_WINDOW_DAYS = 14;

/** The SLA clock that currently applies (§10.3): revision deadline while IN_REVISION. */
export function activeDeadline(order: Pick<OrderDetail, "status" | "deadline" | "revisionDeadline">): string | null {
  if (order.status === "IN_PROGRESS") return order.deadline;
  if (order.status === "IN_REVISION") return order.revisionDeadline;
  return null;
}

export function isLateRemedyAvailable(order: OrderDetail, nowMs: number): boolean {
  const due = activeDeadline(order);
  return due !== null && nowMs > new Date(due).getTime() + LATE_REMEDY_HOURS * HOUR_MS;
}

export function availableActions(order: OrderDetail, role: ViewerRole, nowMs: number): OrderAction[] {
  const actions: OrderAction[] = [];
  const otherPartyAsked = order.mutualCancelRequestedBy !== null && order.mutualCancelRequestedBy !== role;

  switch (order.status) {
    case "PENDING_REQUIREMENTS":
      if (role === "buyer") actions.push("SUBMIT_REQUIREMENTS", "CANCEL_UNSTARTED");
      break;
    case "IN_PROGRESS":
      if (role === "seller") actions.push("DELIVER");
      if (role === "buyer" && isLateRemedyAvailable(order, nowMs)) actions.push("LATE_CANCEL");
      actions.push(otherPartyAsked ? "ACCEPT_MUTUAL_CANCEL" : "REQUEST_MUTUAL_CANCEL");
      actions.push("OPEN_DISPUTE");
      break;
    case "IN_REVISION":
      if (role === "seller") actions.push("DELIVER");
      if (role === "buyer" && isLateRemedyAvailable(order, nowMs)) actions.push("LATE_CANCEL");
      break;
    case "DELIVERED":
      if (role === "buyer") {
        actions.push("ACCEPT");
        if (order.revisionsUsed < order.revisionsIncluded) actions.push("REQUEST_REVISION");
      }
      actions.push("OPEN_DISPUTE");
      break;
    case "COMPLETED":
      if (
        role === "buyer" &&
        !order.review &&
        order.completedAt &&
        nowMs < new Date(order.completedAt).getTime() + REVIEW_WINDOW_DAYS * DAY_MS
      ) {
        actions.push("LEAVE_REVIEW");
      }
      break;
    default:
      break;
  }
  return actions;
}

export type ActionPayload =
  | { type: "SUBMIT_REQUIREMENTS"; answers: string[] }
  | { type: "CANCEL_UNSTARTED" }
  | { type: "DELIVER"; delivery: Omit<OrderDelivery, "id" | "sequenceNo" | "createdAt"> }
  | { type: "ACCEPT" }
  | { type: "REQUEST_REVISION"; feedback: string }
  | { type: "OPEN_DISPUTE"; reason: string }
  | { type: "LATE_CANCEL" }
  | { type: "REQUEST_MUTUAL_CANCEL" }
  | { type: "ACCEPT_MUTUAL_CANCEL" }
  | { type: "LEAVE_REVIEW"; rating: number; body: string | null };

const iso = (ms: number) => new Date(ms).toISOString();

/** Applies one action to a local copy of the order (demo mode / optimistic UI). */
export function applyAction(order: OrderDetail, payload: ActionPayload, role: ViewerRole, nowMs: number): OrderDetail {
  if (!availableActions(order, role, nowMs).includes(payload.type)) {
    throw new Error(`Action ${payload.type} is not allowed for ${role} while ${order.status}`);
  }
  const actor = role === "buyer" ? order.buyer.name : order.seller.name;
  const event = (label: string, detail: string | null = null) => ({
    id: `evt-${nowMs}-${order.events.length}`,
    label,
    actor,
    detail,
    createdAt: iso(nowMs),
  });
  const next: OrderDetail = { ...order };

  switch (payload.type) {
    case "SUBMIT_REQUIREMENTS":
      next.status = "IN_PROGRESS";
      next.requirementsAnswers = payload.answers;
      next.deadline = iso(nowMs + order.turnaroundHours * HOUR_MS);
      next.events = [...order.events, event("Requirements submitted")];
      break;
    case "CANCEL_UNSTARTED":
      next.status = "CANCELLED";
      next.events = [...order.events, event("Order cancelled", "Full refund to buyer wallet")];
      break;
    case "DELIVER": {
      const delivery: OrderDelivery = {
        ...payload.delivery,
        id: `del-${nowMs}`,
        sequenceNo: order.deliveries.length + 1,
        createdAt: iso(nowMs),
      };
      next.status = "DELIVERED";
      next.deliveries = [...order.deliveries, delivery];
      next.autoCompleteAt = iso(nowMs + AUTO_COMPLETE_HOURS * HOUR_MS);
      next.events = [...order.events, event(`Delivery #${delivery.sequenceNo} submitted`, delivery.fileName)];
      break;
    }
    case "ACCEPT":
      next.status = "COMPLETED";
      next.completedAt = iso(nowMs);
      next.autoCompleteAt = null;
      next.events = [...order.events, event("Delivery accepted", "Escrow released to seller")];
      break;
    case "REQUEST_REVISION":
      next.status = "IN_REVISION";
      next.revisionsUsed = order.revisionsUsed + 1;
      next.revisionDeadline = iso(nowMs + REVISION_DEADLINE_HOURS * HOUR_MS);
      next.autoCompleteAt = null;
      next.events = [...order.events, event(`Revision ${next.revisionsUsed} of ${order.revisionsIncluded} requested`, payload.feedback)];
      break;
    case "OPEN_DISPUTE":
      next.status = "DISPUTED";
      next.disputedAt = iso(nowMs);
      next.autoCompleteAt = null;
      next.events = [...order.events, event("Dispute opened", payload.reason)];
      break;
    case "LATE_CANCEL":
      next.status = "CANCELLED";
      next.events = [...order.events, event("Cancelled for late delivery", "Full refund to buyer wallet")];
      break;
    case "REQUEST_MUTUAL_CANCEL":
      next.mutualCancelRequestedBy = role;
      next.events = [...order.events, event("Mutual cancellation requested")];
      break;
    case "ACCEPT_MUTUAL_CANCEL":
      next.status = "CANCELLED";
      next.mutualCancelRequestedBy = null;
      next.events = [...order.events, event("Mutual cancellation accepted", "Full refund to buyer wallet")];
      break;
    case "LEAVE_REVIEW":
      next.review = { rating: payload.rating, body: payload.body };
      next.events = [...order.events, event(`Left a ${payload.rating}-star review`)];
      break;
  }
  return next;
}
