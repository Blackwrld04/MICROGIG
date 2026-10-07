import { queryOptions } from "@tanstack/react-query";
import { EMPTY_DASHBOARD, EMPTY_SELLER_PROFILE, loadDisputes, or404, toSellerPage, toSessions } from "@/lib/api/adapters";
import { api } from "@/lib/api/client";
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
} from "@/lib/api/types";
import { USE_MOCKS } from "@/mocks/config";
import type { GigSearchQuery } from "@/modules/catalog/contracts";
import { queryKeys } from "./keys";

/**
 * Browser-side query definitions: key + fetcher against same-origin /api/v1
 * (demo route handlers, or the backend through the Vercel proxy).
 * Server Components prefetch the same keys with `serverData` (lib/api/server-data.ts).
 */

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Poll only against the real backend; demo data is static and would undo local demo changes. */
export const pollEvery = (ms: number) => (USE_MOCKS ? false : ms);

export const queries = {
  gigs: (query: GigSearchQuery) =>
    queryOptions({ queryKey: queryKeys.gigs(query), queryFn: () => api<GigSearchResult>(`/gigs${qs(query)}`) }),

  gig: (slug: string) =>
    queryOptions({ queryKey: queryKeys.gig(slug), queryFn: () => api<GigDetail>(`/gigs/${encodeURIComponent(slug)}`) }),

  moreFromSeller: (gigId: string) =>
    queryOptions({
      queryKey: queryKeys.moreFromSeller(gigId),
      queryFn: async () => (await api<{ gigs: GigCard[] }>(`/gigs/${gigId}/more-from-seller`)).gigs,
    }),

  seller: (id: string) =>
    queryOptions({ queryKey: queryKeys.seller(id), queryFn: async () => toSellerPage(await api<SellerPageResponse>(`/sellers/${encodeURIComponent(id)}`)) }),

  orders: (tab: string, q: string | undefined) =>
    queryOptions({ queryKey: queryKeys.orders(tab, q), queryFn: () => api<OrderListResponse>(`/orders/user/me${qs({ tab, q })}`) }),

  order: (id: string) =>
    queryOptions({
      queryKey: queryKeys.order(id),
      queryFn: () => api<OrderResponse>(`/orders/${encodeURIComponent(id)}`),
      // Keep messages, deliveries and status fresh in the workspace (MSG-01: 15 s polling).
      refetchInterval: pollEvery(15_000),
    }),

  inbox: () =>
    queryOptions({ queryKey: queryKeys.inbox, queryFn: () => api<InboxThread[]>("/inbox"), refetchInterval: pollEvery(15_000) }),

  notifications: () =>
    queryOptions({
      queryKey: queryKeys.notifications,
      queryFn: () => api<NotificationsResponse>("/notifications"),
      refetchInterval: pollEvery(60_000),
    }),

  wallet: () => queryOptions({ queryKey: queryKeys.wallet, queryFn: () => api<WalletResponse>("/wallet") }),

  dashboard: () => queryOptions({ queryKey: queryKeys.dashboard, queryFn: () => or404(api<DashboardResponse>("/me/dashboard"), EMPTY_DASHBOARD) }),

  sellerProfile: () =>
    queryOptions({ queryKey: queryKeys.sellerProfile, queryFn: () => or404(api<SellerProfileResponse>("/me/seller-profile"), EMPTY_SELLER_PROFILE) }),

  sessions: () =>
    queryOptions({
      queryKey: queryKeys.sessions,
      queryFn: async () => toSessions(await api<SessionRow[] | { sessions: SessionRow[] }>("/me/sessions")),
    }),

  notificationPrefs: () =>
    queryOptions({ queryKey: queryKeys.notificationPrefs, queryFn: () => api<NotificationPrefs>("/notification-prefs") }),

  verifications: () =>
    queryOptions({ queryKey: queryKeys.verifications, queryFn: () => api<VerificationRequest[]>("/admin/verifications") }),

  disputes: () => queryOptions({ queryKey: queryKeys.disputes, queryFn: () => (USE_MOCKS ? api<OrderDetail[]>("/admin/disputes") : loadDisputes(api)) }),
};
