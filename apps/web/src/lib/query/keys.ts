import type { GigSearchQuery } from "@/modules/catalog/contracts";

/**
 * Query keys, one per /api/v1 resource. Keys are shared by server prefetches and client
 * hooks, so hydrated data lands in exactly the cache entry the hook reads.
 */
export const queryKeys = {
  gigs: (query: GigSearchQuery) => ["gigs", query] as const,
  gig: (slug: string) => ["gig", slug] as const,
  moreFromSeller: (gigId: string) => ["gig", gigId, "more-from-seller"] as const,
  seller: (id: string) => ["seller", id] as const,
  orders: (tab: string, q: string | undefined) => ["orders", { tab, q: q ?? "" }] as const,
  order: (id: string) => ["order", id] as const,
  inbox: ["inbox"] as const,
  notifications: ["notifications"] as const,
  wallet: ["wallet"] as const,
  dashboard: ["me", "dashboard"] as const,
  sellerProfile: ["me", "seller-profile"] as const,
  sessions: ["me", "sessions"] as const,
  notificationPrefs: ["notification-prefs"] as const,
  verifications: ["admin", "verifications"] as const,
  disputes: ["admin", "disputes"] as const,
};
