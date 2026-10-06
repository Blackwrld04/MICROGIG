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
    case "DELIVER": {
      const d = payload.delivery as unknown as { storageKey?: string; fileKey?: string };
      return api(`${base}/deliveries`, {
        method: "POST",
        body: {
          fileName: payload.delivery.fileName,
          notes: payload.delivery.notes,
          fileSize: payload.delivery.fileSize,
          sha256: payload.delivery.sha256,
          kind: payload.delivery.kind,
          storageKey: d.storageKey || d.fileKey || `pending-upload/${orderId}/${payload.delivery.fileName}`,
          fileKey: d.fileKey || d.storageKey || `pending-upload/${orderId}/${payload.delivery.fileName}`,
          fileTree: payload.delivery.fileTree ?? undefined,
        },
      });
    }
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

/**
 * POST /api/v1/orders/:id/messages (MSG-01). The backend requires non-empty text and stores the
 * attachment's file name only (no attachment upload endpoint yet). Returns the backend's
 * off-platform warning (MSG-03), if its own check flagged the message.
 */
export async function postOrderMessage(orderId: string, message: { body: string; attachmentName: string | null }): Promise<string | null> {
  const res = await api<{ leakageWarning?: string | null } | null>(`/orders/${encodeURIComponent(orderId)}/messages`, {
    method: "POST",
    body: { body: message.body, ...(message.attachmentName ? { attachmentName: message.attachmentName } : {}) },
  });
  return res?.leakageWarning ?? null;
}
