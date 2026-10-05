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
      // TODO(delivery owner): presign → PUT to S3 → send the server-issued storage key (§14.1).
      // Until storage exists the backend records metadata only, under a placeholder key.
      return api(`${base}/deliveries`, {
        method: "POST",
        body: {
          fileName: payload.delivery.fileName,
          fileSize: payload.delivery.fileSize,
          sha256: payload.delivery.sha256,
          storageKey: `pending-upload/${orderId}/${payload.delivery.fileName}`,
          kind: payload.delivery.kind,
          fileTree: payload.delivery.fileTree ?? undefined,
          notes: payload.delivery.notes,
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
      // The backend's /cancel proposes a mutual cancel, or accepts the other party's proposal.
      return api(`${base}/cancel`, { method: "POST", body: {} });
    case "LEAVE_REVIEW":
      return api(`${base}/review`, { method: "POST", body: { rating: payload.rating, body: payload.body ?? undefined } });
  }
}
