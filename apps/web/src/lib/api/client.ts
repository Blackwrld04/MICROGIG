import { ApiError, errorFromResponse, networkError } from "./errors";

/**
 * Browser-side client for `/api/v1` route handlers (PRD §12).
 * Server Components should call module services directly instead of fetching
 * their own API over HTTP.
 *
 * Auth is cookie-based (AUTH-03), so requests use `credentials: "same-origin"`
 * and never touch tokens in JS.
 */

const BASE = "/api/v1";

type Refresher = () => Promise<boolean>;

let refresher: Refresher | null = null;
let inflightRefresh: Promise<boolean> | null = null;

/**
 * Register how to rotate the refresh cookie (PRD §13.1). The PRD defines rotation
 * but no endpoint yet — the auth module owner wires this up.
 */
export function setSessionRefresher(fn: Refresher | null) {
  refresher = fn;
}

/**
 * Single-flight: concurrent 401s share ONE refresh call. With automatic token
 * rotation, two parallel refreshes would present the same token twice and the
 * server would revoke the whole token family (logging the user out).
 */
function refreshOnce(): Promise<boolean> {
  if (!refresher) return Promise.resolve(false);
  inflightRefresh ??= refresher()
    .catch(() => false)
    .finally(() => {
      inflightRefresh = null;
    });
  return inflightRefresh;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Sent as `Idempotency-Key` (PRD §12.4). Create once per user intent and reuse it on retry. */
  idempotencyKey?: string;
}

export async function api<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { body, idempotencyKey, headers, ...init } = options;
  const finalHeaders = new Headers(headers);
  if (body !== undefined) finalHeaders.set("Content-Type", "application/json");
  if (idempotencyKey) finalHeaders.set("Idempotency-Key", idempotencyKey);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: finalHeaders,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw networkError();
  }

  if (res.status === 401 && !retried && (await refreshOnce())) {
    return api<T>(path, options, true);
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  const parsed: unknown = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) throw errorFromResponse(res.status, parsed, res.headers.get("Retry-After"));
  return parsed as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export { ApiError };
