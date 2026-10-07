import type { Me } from "@/modules/auth/contracts";
import { ApiError } from "./errors";
import type {
  DashboardResponse,
  GigCard,
  OrderDetail,
  OrderResponse,
  SellerPageResponse,
  SellerProfileResponse,
  SessionRow,
} from "./types";

/*
 * Real-mode response adapters: where the backend (server/) answers with a different shape than
 * the frontend contract, normalise it here. Used by BOTH the browser queries (lib/query/queries.ts)
 * and server prefetches (lib/api/server-data.ts) so hydrated and refetched data are identical.
 * Isomorphic: no server-only imports.
 */

type Fetch = <T>(path: string) => Promise<T>;

/** Login/register: the backend returns the user itself, the contract wraps it as `{ user }`. */
export function toMe(res: Me | { user: Me }): Me {
  return "user" in res ? res.user : res;
}

/** POST /orders: the backend returns the new order's workspace, the contract only `{ orderId }`. */
export function toOrderId(res: { orderId: string } | OrderResponse): string {
  return "orderId" in res ? res.orderId : res.order.id;
}

/** GET /me/sessions: the backend returns a bare array. */
export function toSessions(res: SessionRow[] | { sessions: SessionRow[] }): SessionRow[] {
  return Array.isArray(res) ? res : res.sessions;
}

/** A freelancer who hasn't saved a profile yet gets 404 from the backend; show an empty one. */
export const EMPTY_SELLER_PROFILE: SellerProfileResponse = {
  profile: { displayName: "", headline: "", about: "", country: "", languages: [], skills: [] },
  verification: "NOT_SUBMITTED",
};

export const EMPTY_DASHBOARD: DashboardResponse = {
  checklist: { profileComplete: false, verification: "NOT_SUBMITTED", hasGig: false, hasPublishedGig: false },
  stats: { netEarningsCents: 0, avgSellingPriceCents: null, onTimeDeliveryRate: null, completionRate: null },
  activeOrders: 0,
  completedOrders: 0,
  gigs: [],
};

export async function or404<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return fallback;
    throw err;
  }
}

/** GET /sellers/:id: the backend has no aggregate rating or review list yet; derive what we can. */
export function toSellerPage(raw: Omit<SellerPageResponse, "rating" | "totalReviews" | "reviews"> & Partial<SellerPageResponse>): SellerPageResponse {
  const gigs: GigCard[] = raw.gigs;
  const rated = gigs.filter((g) => g.rating !== null && g.reviewCount > 0);
  const ratedCount = rated.reduce((n, g) => n + g.reviewCount, 0);
  return {
    ...raw,
    rating: raw.rating ?? (ratedCount ? rated.reduce((s, g) => s + g.rating! * g.reviewCount, 0) / ratedCount : null),
    totalReviews: raw.totalReviews ?? gigs.reduce((n, g) => n + g.reviewCount, 0),
    reviews: raw.reviews ?? [],
  };
}

/**
 * GET /admin/disputes: the backend lists summary rows, but the resolver needs each order's
 * full workspace (fee rate, activity log), which admins can read via GET /orders/:id.
 */
export async function loadDisputes(fetchJson: Fetch): Promise<OrderDetail[]> {
  const rows = await fetchJson<{ id: string }[] | OrderDetail[]>("/admin/disputes");
  return Promise.all(
    rows.map(async (r) => ("events" in r ? r : (await fetchJson<OrderResponse>(`/orders/${encodeURIComponent(r.id)}`)).order)),
  );
}
