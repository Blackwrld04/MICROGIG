import "server-only";
import { mockVerifications } from "@/mocks/account";
import { buildMockOrders } from "@/mocks/orders";
import { getSellerGigs } from "@/modules/catalog/queries";
import type { SellerProfileInput, VerificationStatus } from "./contracts";

/*
 * Seller profile & onboarding reads — SEL-01/02/03.
 * DEMO FIXTURES ONLY: these power demo mode (and its /api/v1 demo handlers). Real mode reads
 * the backend through src/lib/api/server-data.ts; keep the return shapes in sync with it.
 */

export async function getMySellerProfile(): Promise<{ profile: SellerProfileInput; verification: VerificationStatus }> {
  return {
    profile: {
      displayName: "Alex Chen",
      headline: "Full-Stack Web Specialist",
      about:
        "I'm a full-stack developer with six years of experience fixing layouts, building landing pages and wiring up APIs. I keep gigs small and fast: clear scope, 24-hour turnaround, and a short note explaining every fix so you learn what went wrong.",
      country: "Canada",
      languages: [
        { language: "English", proficiency: "NATIVE" },
        { language: "French", proficiency: "CONVERSATIONAL" },
      ],
      skills: [
        { skillName: "CSS", level: "EXPERT" },
        { skillName: "React", level: "EXPERT" },
        { skillName: "Node.js", level: "INTERMEDIATE" },
      ],
    },
    verification: "APPROVED",
  };
}

/** GET /api/v1/me/dashboard — { checklist, stats, walletSummary }. */
export async function getSellerDashboard(nowMs: number) {
  const { profile, verification } = await getMySellerProfile();
  const gigs = await getSellerGigs("s-alex");
  const sellerOrders = buildMockOrders(nowMs).filter((o) => o.viewerRole === "seller");
  const completed = sellerOrders.filter((o) => o.status === "COMPLETED");

  return {
    checklist: {
      profileComplete: profile.about.length >= 150 && profile.languages.length > 0 && profile.skills.length > 0,
      verification,
      hasGig: gigs.length > 0,
      hasPublishedGig: gigs.some((g) => g.status === "PUBLISHED"),
    },
    // SEL headline stats (§16.6). Values from the wireframe until analytics exist.
    stats: { netEarningsCents: 64000, avgSellingPriceCents: 3250, onTimeDeliveryRate: 98.2, completionRate: 100 },
    activeOrders: sellerOrders.filter((o) => ["IN_PROGRESS", "IN_REVISION", "DELIVERED"].includes(o.status)).length,
    completedOrders: completed.length,
    gigs,
  };
}

/** Admin queue — /admin/verifications (§19 risk #5). */
export async function listPendingVerifications(nowMs: number) {
  return mockVerifications(nowMs);
}
