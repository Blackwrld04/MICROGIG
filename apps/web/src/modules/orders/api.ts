import { api, newIdempotencyKey } from "@/lib/api/client";
import type { ActionPayload } from "./state-machine";

/**
 * Real-mode order actions → PRD §12.4 / §12.5 endpoints (same-origin, proxied to the backend).
 * In demo mode the workspace applies actions locally with the state machine instead.
 */
export async function sendOrderAction(orderId: string, payload: ActionPayload): Promise<void> {
  const base = `/orders/${encodeURIComponent(orderId)}`;
  switch (payload.type) {
    case "SUBMIT_REQUIREMENTS":
      return api(`${base}/requirements`, { method: "POST", body: { answers: payload.answers } });
    case "CANCEL_UNSTARTED":
      return api(`${base}/cancel`, { method: "POST", body: {} });
    case "LATE_CANCEL":
      return api(`${base}/cancel`, { method: "POST", body: { reason: "LATE_DELIVERY_24H" } });
    case "DELIVER":
      return api(`${base}/deliveries`, {
        method: "POST",
        body: {
          fileName: payload.delivery.fileName,
          notes: payload.delivery.notes,
          fileSize: payload.delivery.fileSize,
          sha256: payload.delivery.sha256,
          kind: payload.delivery.kind,
          storageKey: (payload.delivery as any).storageKey || (payload.delivery as any).fileKey,
          fileKey: (payload.delivery as any).fileKey || (payload.delivery as any).storageKey,
          fileTree: payload.delivery.fileTree,
        },
      });
    case "ACCEPT":
      return api(`${base}/complete`, { method: "POST", body: {}, idempotencyKey: newIdempotencyKey() });
    case "REQUEST_REVISION":
      return api(`${base}/revision`, { method: "POST", body: { feedback: payload.feedback } });
    case "OPEN_DISPUTE":
      return api(`${base}/dispute`, { method: "POST", body: { reason: payload.reason }, idempotencyKey: newIdempotencyKey() });
    case "REQUEST_MUTUAL_CANCEL":
    case "ACCEPT_MUTUAL_CANCEL":
      // Not in PRD §12: agree the path with the backend owner.
      return api(`${base}/mutual-cancel`, { method: "POST", body: { accept: payload.type === "ACCEPT_MUTUAL_CANCEL" } });
    case "LEAVE_REVIEW":
      return api(`${base}/review`, { method: "POST", body: { rating: payload.rating, body: payload.body } });
  }
}
