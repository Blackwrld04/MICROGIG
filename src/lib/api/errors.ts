/**
 * Typed API errors for the status codes PRD §12 / Appendix D use.
 * The PRD does not define an error body shape, so parsing is tolerant; tighten
 * `extractMessage` once the backend envelope is agreed.
 */
export type ApiErrorKind =
  | "unauthorized" // 401 — session expired or revoked
  | "payment_required" // 402 — insufficient wallet balance (prompt virtual top-up)
  | "forbidden" // 403 — not a participant (IDOR guard)
  | "not_found" // 404
  | "conflict" // 409 — optimistic lock lost; refetch and re-render
  | "unprocessable" // 422 — validation / revision quota exhausted
  | "rate_limited" // 429
  | "server" // 5xx
  | "network"; // fetch threw

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    message: string,
    readonly body?: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const KIND_BY_STATUS: Record<number, ApiErrorKind> = {
  401: "unauthorized",
  402: "payment_required",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "unprocessable",
  429: "rate_limited",
};

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  unauthorized: "Your session has expired. Please sign in again.",
  payment_required: "Your balance is too low for this order.",
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find that.",
  conflict: "This was just updated by someone else. We've refreshed it for you.",
  unprocessable: "Please check the highlighted fields.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  server: "Something went wrong on our side. Please try again.",
  network: "Can't reach the server. Check your connection.",
};

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as { message?: unknown; error?: unknown };
  if (typeof b.message === "string") return b.message;
  if (typeof b.error === "string") return b.error;
  if (b.error && typeof b.error === "object" && typeof (b.error as { message?: unknown }).message === "string") {
    return (b.error as { message: string }).message;
  }
  return undefined;
}

export function errorFromResponse(status: number, body: unknown, retryAfter?: string | null): ApiError {
  const kind = KIND_BY_STATUS[status] ?? "server";
  const retry = retryAfter ? Number(retryAfter) : undefined;
  return new ApiError(
    kind,
    status,
    extractMessage(body) ?? DEFAULT_MESSAGES[kind],
    body,
    Number.isFinite(retry) ? retry : undefined,
  );
}

export function networkError(): ApiError {
  return new ApiError("network", 0, DEFAULT_MESSAGES.network);
}
