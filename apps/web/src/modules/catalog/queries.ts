import "server-only";
import { MOCK_GIGS, mockReviews, type MockGig } from "@/mocks/gigs";
import { mockSellers } from "@/mocks/people";
import { GIG_PAGE_SIZE, type GigCard, type GigDetail, type GigSearchQuery, type GigSearchResult, type GigSort } from "./contracts";

/*
 * Catalog reads used by Server Components.
 * TODO(catalog owner): replace the fixture bodies with Prisma queries. Keep the signatures.
 */

export const PAGE_SIZE = GIG_PAGE_SIZE;

const SORTERS: Record<GigSort, (a: MockGig, b: MockGig) => number> = {
  price_asc: (a, b) => a.priceCents - b.priceCents,
  price_desc: (a, b) => b.priceCents - a.priceCents,
  rating_desc: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  delivery_time_asc: (a, b) => a.turnaroundHours - b.turnaroundHours,
};

function toCard(g: MockGig): GigCard {
  const { id, slug, title, thumbnailUrl, priceCents, turnaroundHours, rating, reviewCount, favoriteCount, seller } = g;
  return { id, slug, title, thumbnailUrl, priceCents, turnaroundHours, rating, reviewCount, favoriteCount, seller };
}

export async function searchGigs(query: GigSearchQuery): Promise<GigSearchResult> {
  const term = query.search?.toLowerCase();
  const filtered = MOCK_GIGS.filter(
    (g) =>
      (!query.category || g.category === query.category) &&
      (!query.subcategory || g.subcategory === query.subcategory) &&
      (!term || g.title.toLowerCase().includes(term) || g.detail.tags.some((t) => t.includes(term))),
  ).sort(SORTERS[query.sort ?? "rating_desc"]);

  const start = (query.page - 1) * PAGE_SIZE;
  return { gigs: filtered.slice(start, start + PAGE_SIZE).map(toCard), total: filtered.length, page: query.page };
}

export async function getGigBySlug(slug: string): Promise<GigDetail | null> {
  const g = MOCK_GIGS.find((x) => x.slug === slug);
  if (!g) return null;
  const now = Date.now();
  return {
    ...toCard(g),
    category: g.category,
    subcategory: g.subcategory,
    description: g.detail.description,
    revisionsIncluded: g.detail.revisionsIncluded,
    requirementsPrompt: g.detail.requirementsPrompt,
    tags: g.detail.tags,
    faqs: g.detail.faqs,
    images: g.images,
    sellerCard: mockSellers(now)[g.sellerId]!,
    reviews: mockReviews(g, now),
  };
}

/** GIG-11: up to 5 other published gigs from the same seller. */
export async function getMoreFromSeller(gigId: string): Promise<GigCard[]> {
  const gig = MOCK_GIGS.find((g) => g.id === gigId);
  if (!gig) return [];
  return MOCK_GIGS.filter((g) => g.sellerId === gig.sellerId && g.id !== gigId)
    .slice(0, 5)
    .map(toCard);
}

/** Public seller page (SEL-03): profile, published gigs and recent reviews. */
export async function getSellerPublicPage(sellerId: string) {
  const now = Date.now();
  const seller = mockSellers(now)[sellerId];
  if (!seller) return null;
  const gigs = MOCK_GIGS.filter((g) => g.sellerId === sellerId);
  const totalReviews = gigs.reduce((n, g) => n + g.reviewCount, 0);
  const rated = gigs.filter((g) => g.rating !== null);
  const rating = rated.length
    ? rated.reduce((sum, g) => sum + g.rating! * g.reviewCount, 0) / Math.max(1, rated.reduce((n, g) => n + g.reviewCount, 0))
    : null;
  const reviews = gigs
    .flatMap((g) => mockReviews(g, now).map((r) => ({ ...r, gigTitle: g.title, gigSlug: g.slug })))
    .slice(0, 6);
  return { seller, gigs: gigs.map(toCard), rating, totalReviews, reviews };
}

/** Seller's own gigs for the dashboard (includes status, GIG-08). */
export async function getSellerGigs(sellerId: string) {
  return MOCK_GIGS.filter((g) => g.sellerId === sellerId).map((g, i) => ({
    ...toCard(g),
    status: (i === 2 ? "PAUSED" : "PUBLISHED") as "DRAFT" | "PUBLISHED" | "PAUSED",
  }));
}
