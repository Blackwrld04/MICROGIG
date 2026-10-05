import { db } from "../../db/connection.js";
import {
  gigs,
  gigImages,
  gigFaqs,
  favorites,
  sellerProfiles,
  sellerLanguages,
  reviews,
  users,
} from "../../db/schema/index.js";
import { eq, and, sql, desc, asc, ilike, count, inArray, or } from "drizzle-orm";
import { generateGigSlug } from "../../lib/slug.js";
import { notFound, forbidden } from "../../errors.js";

const PAGE_SIZE = 24;

const CATEGORY_MAP: Record<string, string[]> = {
  "graphics-design": ["graphics-design", "Graphics & Design"],
  "programming-tech": ["programming-tech", "Programming & Tech"],
  "writing-translation": ["writing-translation", "Writing & Translation"],
  "video-animation": ["video-animation", "Video & Animation"],
  "digital-marketing": ["digital-marketing", "Digital Marketing"],
  "operations-admin": ["operations-admin", "Operations & Admin"],
  "Graphics & Design": ["graphics-design", "Graphics & Design"],
  "Programming & Tech": ["programming-tech", "Programming & Tech"],
  "Writing & Translation": ["writing-translation", "Writing & Translation"],
  "Video & Animation": ["video-animation", "Video & Animation"],
  "Digital Marketing": ["digital-marketing", "Digital Marketing"],
  "Operations & Admin": ["operations-admin", "Operations & Admin"],
};

export async function searchGigs(query: {
  category?: string;
  subcategory?: string;
  search?: string;
  sort?: "price_asc" | "price_desc" | "rating_desc" | "delivery_time_asc";
  page?: number;
}) {
  const page   = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions: ReturnType<typeof eq>[] = [eq(gigs.status, "PUBLISHED")];
  if (query.category) {
    const candidates = CATEGORY_MAP[query.category] ?? [query.category];
    conditions.push(inArray(gigs.category, candidates) as any);
  }
  if (query.subcategory) {
    conditions.push(or(eq(gigs.subcategory, query.subcategory), ilike(gigs.subcategory, `%${query.subcategory}%`)) as any);
  }
  if (query.search?.trim()) conditions.push(ilike(gigs.title, `%${query.search.trim()}%`) as any);

  let orderBy = desc(gigs.createdAt);
  if (query.sort === "price_asc")          orderBy = asc(gigs.priceCents);
  if (query.sort === "price_desc")         orderBy = desc(gigs.priceCents);
  if (query.sort === "rating_desc")        orderBy = desc(gigs.avgRating);
  if (query.sort === "delivery_time_asc")  orderBy = asc(gigs.turnaroundHours);

  const [totalRes] = await db.select({ total: count() }).from(gigs).where(and(...(conditions as any)));

  const rows = await db
    .select({
      id:              gigs.id,
      slug:            gigs.slug,
      title:           gigs.title,
      thumbnailUrl:    gigs.thumbnailUrl,
      priceCents:      gigs.priceCents,
      turnaroundHours: gigs.turnaroundHours,
      rating:          gigs.avgRating,
      reviewCount:     gigs.reviewCount,
      favoriteCount:   gigs.favoriteCount,
      sellerId:        sellerProfiles.id,
      sellerName:      sellerProfiles.displayName,
      sellerVerified:  sellerProfiles.idVerified,
    })
    .from(gigs)
    .innerJoin(sellerProfiles, eq(gigs.sellerId, sellerProfiles.id))
    .where(and(...(conditions as any)))
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset(offset);

  return {
    gigs:  rows.map((r) => ({
      id:              r.id,
      slug:            r.slug,
      title:           r.title,
      thumbnailUrl:    r.thumbnailUrl,
      priceCents:      r.priceCents,
      turnaroundHours: r.turnaroundHours as 24 | 48,
      rating:          r.rating,
      reviewCount:     r.reviewCount,
      favoriteCount:   r.favoriteCount,
      seller:          { id: r.sellerId, displayName: r.sellerName, avatarUrl: null, idVerified: r.sellerVerified },
    })),
    total: totalRes?.total ?? 0,
    page,
  };
}

export async function getGigBySlug(slug: string) {
  const [gig] = await db
    .select({ id: gigs.id, slug: gigs.slug, sellerId: gigs.sellerId, title: gigs.title, category: gigs.category, subcategory: gigs.subcategory, description: gigs.description, priceCents: gigs.priceCents, turnaroundHours: gigs.turnaroundHours, revisionsIncluded: gigs.revisionsIncluded, requirementsPrompt: gigs.requirementsPrompt, tags: gigs.tags, thumbnailUrl: gigs.thumbnailUrl, avgRating: gigs.avgRating, reviewCount: gigs.reviewCount, favoriteCount: gigs.favoriteCount, createdAt: gigs.createdAt })
    .from(gigs)
    .where(eq(gigs.slug, slug))
    .limit(1);

  if (!gig) return null;

  const [profile] = await db
    .select({ id: sellerProfiles.id, displayName: sellerProfiles.displayName, headline: sellerProfiles.headline, country: sellerProfiles.country, idVerified: sellerProfiles.idVerified, createdAt: sellerProfiles.createdAt })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, gig.sellerId))
    .limit(1);

  const languages = await db
    .select({ language: sellerLanguages.language, proficiency: sellerLanguages.proficiency })
    .from(sellerLanguages)
    .where(eq(sellerLanguages.profileId, gig.sellerId));

  const images  = await db.select({ url: gigImages.url }).from(gigImages).where(eq(gigImages.gigId, gig.id)).orderBy(gigImages.position);
  const faqs    = await db.select({ question: gigFaqs.question, answer: gigFaqs.answer }).from(gigFaqs).where(eq(gigFaqs.gigId, gig.id)).orderBy(gigFaqs.position);

  const gigReviews = await db
    .select({ id: reviews.id, rating: reviews.rating, body: reviews.body, createdAt: reviews.createdAt, buyerName: users.fullName })
    .from(reviews)
    .innerJoin(users, eq(reviews.buyerId, users.id))
    .where(eq(reviews.gigId, gig.id))
    .orderBy(desc(reviews.createdAt))
    .limit(20);

  const imageList = images.map((i) => i.url);
  if (imageList.length === 0 && gig.thumbnailUrl) imageList.push(gig.thumbnailUrl);

  return {
    id:                 gig.id,
    slug:               gig.slug,
    title:              gig.title,
    thumbnailUrl:       gig.thumbnailUrl,
    priceCents:         gig.priceCents,
    turnaroundHours:    gig.turnaroundHours as 24 | 48,
    rating:             gig.avgRating,
    reviewCount:        gig.reviewCount,
    favoriteCount:      gig.favoriteCount,
    category:           gig.category,
    subcategory:        gig.subcategory,
    description:        gig.description,
    revisionsIncluded:  gig.revisionsIncluded,
    requirementsPrompt: gig.requirementsPrompt,
    tags:               gig.tags,
    faqs,
    images:             imageList,
    seller: {
      id:          profile?.id ?? gig.sellerId,
      displayName: profile?.displayName ?? "Seller",
      avatarUrl:   null,
      idVerified:  profile?.idVerified ?? false,
    },
    sellerCard: {
      id:               profile?.id ?? gig.sellerId,
      displayName:      profile?.displayName ?? "Seller",
      avatarUrl:        null,
      idVerified:       profile?.idVerified ?? false,
      headline:         profile?.headline ?? "",
      country:          profile?.country ?? "",
      memberSince:      profile?.createdAt?.toISOString() ?? gig.createdAt.toISOString(),
      avgResponseHours: 1,
      lastDeliveryAt:   null,
      completionRate:   100,
      languages,
    },
    reviews: gigReviews.map((r) => ({ id: r.id, buyerName: r.buyerName, rating: r.rating, body: r.body, createdAt: r.createdAt.toISOString() })),
  };
}

export async function createGig(
  userId: string,
  input: {
    title: string;
    category: string;
    subcategory: string;
    description: string;
    priceCents: number;
    turnaroundHours: 24 | 48;
    revisionsIncluded: number;
    tags: string[];
    faqs: { question: string; answer: string }[];
    requirementsPrompt: string[];
    images?: string[];
  },
) {
  const [profile] = await db.select({ id: sellerProfiles.id }).from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).limit(1);
  if (!profile) throw forbidden("Create your seller profile first.");

  const slug        = generateGigSlug(input.title);
  const gigId       = crypto.randomUUID();
  const thumbnailUrl = input.images?.[0] ?? null;

  await db.transaction(async (tx) => {
    await tx.insert(gigs).values({
      id: gigId, slug, sellerId: profile.id, title: input.title, category: input.category, subcategory: input.subcategory,
      description: input.description, priceCents: input.priceCents, turnaroundHours: input.turnaroundHours,
      revisionsIncluded: input.revisionsIncluded, requirementsPrompt: input.requirementsPrompt, tags: input.tags,
      thumbnailUrl, status: "PUBLISHED",
    });

    if (input.faqs.length > 0) {
      await tx.insert(gigFaqs).values(input.faqs.map((faq, i) => ({ gigId, question: faq.question, answer: faq.answer, position: i })));
    }
    if (input.images && input.images.length > 0) {
      await tx.insert(gigImages).values(input.images.map((url, i) => ({ gigId, url, isPrimary: i === 0, position: i })));
    }
  });

  return { id: gigId, slug };
}

export async function getMoreFromSeller(gigId: string) {
  const [current] = await db.select({ sellerId: gigs.sellerId }).from(gigs).where(eq(gigs.id, gigId)).limit(1);
  if (!current) return [];

  const otherGigs = await db
    .select({ id: gigs.id, slug: gigs.slug, title: gigs.title, thumbnailUrl: gigs.thumbnailUrl, priceCents: gigs.priceCents, turnaroundHours: gigs.turnaroundHours, rating: gigs.avgRating, reviewCount: gigs.reviewCount, favoriteCount: gigs.favoriteCount, sellerId: sellerProfiles.id, sellerName: sellerProfiles.displayName, sellerVerified: sellerProfiles.idVerified })
    .from(gigs)
    .innerJoin(sellerProfiles, eq(gigs.sellerId, sellerProfiles.id))
    .where(and(eq(gigs.sellerId, current.sellerId), eq(gigs.status, "PUBLISHED"), sql`${gigs.id} <> ${gigId}`))
    .limit(5);

  return otherGigs.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, thumbnailUrl: r.thumbnailUrl, priceCents: r.priceCents,
    turnaroundHours: r.turnaroundHours as 24 | 48, rating: r.rating, reviewCount: r.reviewCount, favoriteCount: r.favoriteCount,
    seller: { id: r.sellerId, displayName: r.sellerName, avatarUrl: null, idVerified: r.sellerVerified },
  }));
}

export async function toggleGigFavorite(userId: string, gigId: string) {
  const [existing] = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.gigId, gigId))).limit(1);

  let isFavorited = false;

  await db.transaction(async (tx) => {
    if (existing) {
      await tx.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.gigId, gigId)));
      await tx.update(gigs).set({ favoriteCount: sql`GREATEST(0, favorite_count - 1)` }).where(eq(gigs.id, gigId));
      isFavorited = false;
    } else {
      await tx.insert(favorites).values({ userId, gigId });
      await tx.update(gigs).set({ favoriteCount: sql`favorite_count + 1` }).where(eq(gigs.id, gigId));
      isFavorited = true;
    }
  });

  const [updated] = await db.select({ favoriteCount: gigs.favoriteCount }).from(gigs).where(eq(gigs.id, gigId)).limit(1);
  return { isFavorited, count: updated?.favoriteCount ?? 0 };
}
