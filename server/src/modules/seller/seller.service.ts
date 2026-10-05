import { db } from "../../db/connection.js";
import {
  sellerProfiles,
  sellerSkills,
  sellerLanguages,
  users,
  gigs,
  orders,
  reviews,
} from "../../db/schema/index.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { notFound } from "../../errors.js";

export async function getSellerProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    return {
      profile: {
        displayName: "",
        headline:    "",
        about:       "",
        country:     "",
        languages:   [],
        skills:      [],
      },
      verification: "NOT_SUBMITTED",
    };
  }

  const skills = await db
    .select({ skillName: sellerSkills.skillName, level: sellerSkills.level })
    .from(sellerSkills)
    .where(eq(sellerSkills.profileId, profile.id));

  const languages = await db
    .select({ language: sellerLanguages.language, proficiency: sellerLanguages.proficiency })
    .from(sellerLanguages)
    .where(eq(sellerLanguages.profileId, profile.id));

  return {
    profile: {
      displayName: profile.displayName,
      headline:    profile.headline,
      about:       profile.about,
      country:     profile.country,
      languages,
      skills,
    },
    verification: profile.verificationStatus,
  };
}

export async function updateSellerProfile(
  userId: string,
  input: {
    displayName: string;
    headline: string;
    about: string;
    country: string;
    languages: { language: string; proficiency: "BASIC" | "CONVERSATIONAL" | "FLUENT" | "NATIVE" }[];
    skills: { skillName: string; level: "BEGINNER" | "INTERMEDIATE" | "EXPERT" }[];
  },
) {
  let [profile] = await db
    .select({ id: sellerProfiles.id })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1);

  await db.transaction(async (tx) => {
    if (!profile) {
      const [created] = await tx
        .insert(sellerProfiles)
        .values({ userId, displayName: input.displayName, headline: input.headline, about: input.about, country: input.country })
        .returning({ id: sellerProfiles.id });
      profile = created;
    } else {
      await tx
        .update(sellerProfiles)
        .set({ displayName: input.displayName, headline: input.headline, about: input.about, country: input.country, updatedAt: new Date() })
        .where(eq(sellerProfiles.id, profile.id));
    }

    await tx.delete(sellerSkills).where(eq(sellerSkills.profileId, profile.id));
    if (input.skills.length > 0) {
      await tx.insert(sellerSkills).values(input.skills.map((s) => ({ profileId: profile.id, skillName: s.skillName, level: s.level })));
    }

    await tx.delete(sellerLanguages).where(eq(sellerLanguages.profileId, profile.id));
    if (input.languages.length > 0) {
      await tx.insert(sellerLanguages).values(input.languages.map((l) => ({ profileId: profile.id, language: l.language, proficiency: l.proficiency })));
    }
  });

  return getSellerProfile(userId);
}

export async function submitVerification(
  userId: string,
  input: { idDocumentType: "PASSPORT" | "NATIONAL_ID" | "DRIVERS_LICENSE"; documentReference: string },
) {
  const [profile] = await db.select({ id: sellerProfiles.id }).from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).limit(1);
  if (!profile) throw notFound("Seller profile not found");

  await db.update(sellerProfiles).set({
    verificationStatus:      "PENDING_VERIFICATION",
    idDocumentType:          input.idDocumentType,
    documentReference:       input.documentReference,
    verificationSubmittedAt: new Date(),
    updatedAt:               new Date(),
  }).where(eq(sellerProfiles.id, profile.id));

  return { status: "PENDING_VERIFICATION" };
}

export async function getSellerDashboardData(userId: string) {
  const { profile, verification } = await getSellerProfile(userId);

  const [sellerRecord] = await db.select({ id: sellerProfiles.id }).from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).limit(1);

  const sellerGigs = sellerRecord
    ? await db
        .select({ id: gigs.id, slug: gigs.slug, title: gigs.title, priceCents: gigs.priceCents, turnaroundHours: gigs.turnaroundHours, status: gigs.status, reviewCount: gigs.reviewCount, avgRating: gigs.avgRating, thumbnailUrl: gigs.thumbnailUrl })
        .from(gigs)
        .where(eq(gigs.sellerId, sellerRecord.id))
    : [];

  const sellerOrders = await db
    .select({ id: orders.id, status: orders.status, priceCents: orders.priceCents })
    .from(orders)
    .where(eq(orders.sellerId, userId));

  const activeOrders    = sellerOrders.filter((o) => ["IN_PROGRESS", "IN_REVISION", "DELIVERED"].includes(o.status)).length;
  const completedOrders = sellerOrders.filter((o) => o.status === "COMPLETED").length;

  return {
    checklist: {
      profileComplete:    profile.about.length >= 150 && profile.languages.length > 0 && profile.skills.length > 0,
      verification,
      hasGig:             sellerGigs.length > 0,
      hasPublishedGig:    sellerGigs.some((g) => g.status === "PUBLISHED"),
    },
    stats: {
      netEarningsCents:         completedOrders * 2000,
      avgSellingPriceCents:     sellerGigs.length > 0 ? Math.round(sellerGigs.reduce((a, b) => a + b.priceCents, 0) / sellerGigs.length) : 2500,
      onTimeDeliveryRate:       100,
      completionRate:           sellerOrders.length > 0 ? Math.round((completedOrders / sellerOrders.length) * 100) : 100,
    },
    activeOrders,
    completedOrders,
    gigs: sellerGigs,
  };
}

export async function getPublicSellerCard(sellerIdOrUserId: string) {
  let [profile] = await db
    .select({ id: sellerProfiles.id, userId: sellerProfiles.userId, displayName: sellerProfiles.displayName, headline: sellerProfiles.headline, about: sellerProfiles.about, country: sellerProfiles.country, idVerified: sellerProfiles.idVerified, createdAt: sellerProfiles.createdAt })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, sellerIdOrUserId))
    .limit(1);

  if (!profile) {
    const [byUser] = await db
      .select({ id: sellerProfiles.id, userId: sellerProfiles.userId, displayName: sellerProfiles.displayName, headline: sellerProfiles.headline, about: sellerProfiles.about, country: sellerProfiles.country, idVerified: sellerProfiles.idVerified, createdAt: sellerProfiles.createdAt })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, sellerIdOrUserId))
      .limit(1);
    profile = byUser;
  }

  if (!profile) return null;

  const languages = await db
    .select({ language: sellerLanguages.language, proficiency: sellerLanguages.proficiency })
    .from(sellerLanguages).where(eq(sellerLanguages.profileId, profile.id));

  const skills = await db
    .select({ skillName: sellerSkills.skillName, level: sellerSkills.level })
    .from(sellerSkills).where(eq(sellerSkills.profileId, profile.id));

  const sellerGigs = await db
    .select({ id: gigs.id, slug: gigs.slug, title: gigs.title, thumbnailUrl: gigs.thumbnailUrl, priceCents: gigs.priceCents, turnaroundHours: gigs.turnaroundHours, avgRating: gigs.avgRating, reviewCount: gigs.reviewCount, favoriteCount: gigs.favoriteCount })
    .from(gigs)
    .where(and(eq(gigs.sellerId, profile.id), eq(gigs.status, "PUBLISHED")));

  const gigIds = sellerGigs.map((g) => g.id);
  const sellerReviews = gigIds.length > 0
    ? await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          body: reviews.body,
          createdAt: reviews.createdAt,
          buyerName: users.fullName,
          gigId: reviews.gigId,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.buyerId, users.id))
        .where(sql`${reviews.gigId} = ANY(${gigIds})`)
        .orderBy(desc(reviews.createdAt))
        .limit(10)
    : [];

  const gigMap = new Map(sellerGigs.map((g) => [g.id, g]));
  const formattedReviews = sellerReviews.map((r) => {
    const gig = gigMap.get(r.gigId);
    return {
      id: r.id,
      buyerName: r.buyerName,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      gigTitle: gig?.title ?? "",
      gigSlug: gig?.slug ?? "",
    };
  });

  const totalReviews = sellerGigs.reduce((sum, g) => sum + g.reviewCount, 0);
  const ratedGigs = sellerGigs.filter((g) => g.avgRating !== null);
  const overallRating = ratedGigs.length > 0
    ? ratedGigs.reduce((sum, g) => sum + (g.avgRating ?? 0) * g.reviewCount, 0) / Math.max(1, totalReviews)
    : null;

  return {
    seller: {
      id:               profile.id,
      displayName:      profile.displayName,
      avatarUrl:        null,
      idVerified:       profile.idVerified,
      headline:         profile.headline,
      country:          profile.country,
      about:            profile.about,
      memberSince:      profile.createdAt.toISOString(),
      avgResponseHours: 1,
      lastDeliveryAt:   null,
      completionRate:   100,
      languages,
      skills,
    },
    gigs: sellerGigs.map((g) => ({
      id:              g.id,
      slug:            g.slug,
      title:           g.title,
      thumbnailUrl:    g.thumbnailUrl,
      priceCents:      g.priceCents,
      turnaroundHours: g.turnaroundHours as 24 | 48,
      rating:          g.avgRating,
      reviewCount:     g.reviewCount,
      favoriteCount:   g.favoriteCount,
      seller: {
        id:          profile.id,
        displayName: profile.displayName,
        avatarUrl:   null,
        idVerified:  profile.idVerified,
      },
    })),
    rating: overallRating,
    totalReviews,
    reviews: formattedReviews,
  };
}
