import { z } from "zod";
import { GIG_MAX_PRICE_CENTS, GIG_MIN_PRICE_CENTS } from "@/lib/money";

/** GIG-06 sort options. */
export const GIG_SORTS = ["price_asc", "price_desc", "rating_desc", "delivery_time_asc"] as const;
export type GigSort = (typeof GIG_SORTS)[number];

/** GET /api/v1/gigs query — PRD §12.3 */
export const gigSearchQuerySchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(GIG_SORTS).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type GigSearchQuery = z.infer<typeof gigSearchQuerySchema>;

/** Catalog card — GIG-05 (+ favorite count, GIG-10). */
export const gigCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string().max(80),
  thumbnailUrl: z.string().nullable(),
  priceCents: z.number().int(),
  turnaroundHours: z.union([z.literal(24), z.literal(48)]),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int(),
  favoriteCount: z.number().int(),
  seller: z.object({
    id: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    idVerified: z.boolean(),
  }),
});
export type GigCard = z.infer<typeof gigCardSchema>;

export const gigSearchResultSchema = z.object({
  gigs: z.array(gigCardSchema),
  total: z.number().int(),
  page: z.number().int(),
});
export type GigSearchResult = z.infer<typeof gigSearchResultSchema>;

export type LanguageProficiency = "BASIC" | "CONVERSATIONAL" | "FLUENT" | "NATIVE";

/** Public seller card — SEL-03. */
export interface SellerCard {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  idVerified: boolean;
  headline: string;
  country: string;
  memberSince: string;
  avgResponseHours: number;
  lastDeliveryAt: string | null;
  completionRate: number;
  languages: { language: string; proficiency: LanguageProficiency }[];
}

export interface GigReview {
  id: string;
  buyerName: string;
  rating: number;
  body: string | null;
  createdAt: string;
}

/** GET /api/v1/gigs/:slug — { gig, sellerCard, faqs, images, reviews } (§12.3). */
export interface GigDetail extends GigCard {
  category: string;
  subcategory: string;
  description: string;
  revisionsIncluded: number;
  requirementsPrompt: string[];
  tags: string[];
  faqs: { question: string; answer: string }[];
  /** Gallery: 1 primary + up to 3 showcase images (GIG-01). null = no image uploaded yet. */
  images: (string | null)[];
  sellerCard: SellerCard;
  reviews: GigReview[];
}

/** POST /api/v1/gigs body — GIG-01..04. */
export const createGigSchema = z.object({
  title: z
    .string()
    .trim()
    .max(80, "Max 80 characters")
    .refine((t) => t.startsWith("I will "), 'Title must start with "I will…"'),
  category: z.string().min(1, "Choose a category"),
  subcategory: z.string().min(1, "Choose a subcategory"),
  description: z.string().trim().min(1, "Add a description"),
  priceCents: z.number().int().min(GIG_MIN_PRICE_CENTS).max(GIG_MAX_PRICE_CENTS),
  turnaroundHours: z.union([z.literal(24), z.literal(48)]),
  revisionsIncluded: z.number().int().min(0).max(5).default(2),
  tags: z.array(z.string().trim().min(1).max(30)).max(5, "Up to 5 tags"),
  faqs: z
    .array(z.object({ question: z.string().trim().min(1).max(150), answer: z.string().trim().min(1).max(600) }))
    .max(5, "Up to 5 FAQs"),
  requirementsPrompt: z.array(z.string().trim().min(1)).min(1).max(3, "1 to 3 questions"),
});
export type CreateGigInput = z.infer<typeof createGigSchema>;
