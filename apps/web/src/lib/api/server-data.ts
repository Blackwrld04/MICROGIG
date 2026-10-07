import "server-only";
import { cookies } from "next/headers";
import type { OrderTab } from "@/lib/constants/order-status";
import { apiBaseUrl } from "@/lib/env";
import { USE_MOCKS } from "@/mocks/config";
import { listPendingVerifications as demoVerifications, getMySellerProfile, getSellerDashboard } from "@/modules/seller/queries";
import { getCurrentUser, listSessions } from "@/modules/auth/session";
import { getGigBySlug, getMoreFromSeller, getSellerPublicPage, searchGigs as demoSearch } from "@/modules/catalog/queries";
import type { GigSearchQuery } from "@/modules/catalog/contracts";
import { getClientWallet, getFreelancerWallet } from "@/modules/ledger/queries";
import { listThreads } from "@/modules/messaging/queries";
import { getNotifications } from "@/modules/notifications/queries";
import { getOrder, listDisputedOrders, listOrders, roleFor } from "@/modules/orders/queries";
import type { Me } from "@/modules/auth/contracts";
import { EMPTY_DASHBOARD, EMPTY_SELLER_PROFILE, loadDisputes, or404, toSellerPage, toSessions } from "./adapters";
import { ApiError, errorFromResponse } from "./errors";
import type {
  DashboardResponse,
  GigCard,
  GigDetail,
  GigSearchResult,
  InboxThread,
  NotificationPrefs,
  NotificationsResponse,
  OrderDetail,
  OrderListResponse,
  OrderResponse,
  SellerPageResponse,
  SellerProfileResponse,
  SessionRow,
  VerificationRequest,
  WalletResponse,
} from "./types";

/*
 * Server-side data access, one function per /api/v1 endpoint.
 * - Demo mode: reads the fixtures in src/mocks (via the modules/<domain>/queries files).
 * - Real mode: calls the backend (API_URL) and forwards the user's cookies.
 * Used by Server Components for TanStack Query prefetching AND by the demo route handlers
 * in src/app/api/v1, so the browser and the server always see the same data.
 */

async function backend<T>(path: string, timeoutMs = 3000): Promise<T> {
  const base = apiBaseUrl();
  if (!base) {
    throw new ApiError("server", 503, "Backend URL not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/v1${path}`, {
      headers: { cookie: cookies().toString(), accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw errorFromResponse(res.status, body, res.headers.get("Retry-After"));
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 404 → null, anything else rethrows. */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** The signed-in user, enforcing account type / admin like the real API must (401 / 403). */
async function viewer(options: { accountType?: Me["accountType"]; admin?: boolean } = {}): Promise<Me> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("unauthorized", 401, "Not signed in");
  if (options.admin && !user.isAdmin) throw new ApiError("forbidden", 403, "Admins only");
  if (options.accountType && user.accountType !== options.accountType) {
    throw new ApiError("forbidden", 403, `Only ${options.accountType.toLowerCase()} accounts can do this`);
  }
  return user;
}

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const serverData = {
  searchGigs(query: GigSearchQuery): Promise<GigSearchResult> {
    return USE_MOCKS ? demoSearch(query) : backend(`/gigs${qs(query)}`);
  },

  gig(slug: string): Promise<GigDetail | null> {
    return USE_MOCKS ? getGigBySlug(slug) : orNull(backend(`/gigs/${encodeURIComponent(slug)}`));
  },

  async moreFromSeller(gigId: string): Promise<GigCard[]> {
    return USE_MOCKS ? getMoreFromSeller(gigId) : (await backend<{ gigs: GigCard[] }>(`/gigs/${gigId}/more-from-seller`)).gigs;
  },

  async seller(id: string): Promise<SellerPageResponse | null> {
    if (USE_MOCKS) return getSellerPublicPage(id);
    const page = await orNull(backend<SellerPageResponse>(`/sellers/${encodeURIComponent(id)}`));
    return page && toSellerPage(page);
  },

  async orders(tab: OrderTab, q: string | undefined): Promise<OrderListResponse> {
    if (!USE_MOCKS) return backend(`/orders/user/me${qs({ tab, q })}`);
    const user = await viewer();
    return listOrders(roleFor(user.accountType), tab, q, Date.now());
  },

  async order(id: string): Promise<OrderResponse | null> {
    if (!USE_MOCKS) return orNull(backend(`/orders/${encodeURIComponent(id)}`));
    return getOrder(id, await viewer(), Date.now());
  },

  async inbox(): Promise<InboxThread[]> {
    if (!USE_MOCKS) return backend("/inbox");
    const user = await viewer();
    return listThreads(roleFor(user.accountType), Date.now());
  },

  async notifications(): Promise<NotificationsResponse> {
    if (!USE_MOCKS) return backend("/notifications");
    const user = await viewer();
    return getNotifications(user.accountType, Date.now());
  },

  async wallet(): Promise<WalletResponse> {
    if (!USE_MOCKS) return backend("/wallet");
    const user = await viewer();
    const now = Date.now();
    return user.accountType === "FREELANCER"
      ? { accountType: "FREELANCER", ...(await getFreelancerWallet(now)) }
      : { accountType: "CLIENT", ...(await getClientWallet(now)) };
  },

  async dashboard(): Promise<DashboardResponse> {
    if (!USE_MOCKS) return or404(backend("/me/dashboard"), EMPTY_DASHBOARD);
    await viewer({ accountType: "FREELANCER" });
    return getSellerDashboard(Date.now());
  },

  async sellerProfile(): Promise<SellerProfileResponse> {
    if (!USE_MOCKS) return or404(backend("/me/seller-profile"), EMPTY_SELLER_PROFILE);
    await viewer({ accountType: "FREELANCER" });
    return getMySellerProfile();
  },

  async sessions(): Promise<SessionRow[]> {
    if (!USE_MOCKS) return toSessions(await backend<SessionRow[] | { sessions: SessionRow[] }>("/me/sessions"));
    await viewer();
    return listSessions(Date.now());
  },

  async notificationPrefs(): Promise<NotificationPrefs> {
    if (!USE_MOCKS) return backend("/notification-prefs");
    await viewer();
    return { orderEmail: true, inboxEmail: true, promoEmail: false }; // Appendix B defaults
  },

  async verifications(): Promise<VerificationRequest[]> {
    if (!USE_MOCKS) return backend("/admin/verifications");
    await viewer({ admin: true });
    return demoVerifications(Date.now());
  },

  async disputes(): Promise<OrderDetail[]> {
    if (!USE_MOCKS) return loadDisputes(backend);
    await viewer({ admin: true });
    return listDisputedOrders(Date.now());
  },
};
