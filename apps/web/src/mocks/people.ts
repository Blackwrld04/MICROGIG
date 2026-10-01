import type { Me } from "@/modules/auth/contracts";
import type { SellerCard } from "@/modules/catalog/contracts";

/**
 * Demo accounts (any password works in demo mode). Accounts are client XOR freelancer.
 * The client owns the buyer-side fixture orders, the freelancer owns Alex Chen's gigs.
 */
export const DEMO_USERS: Record<"client" | "freelancer" | "admin", Me> = {
  client: {
    id: "00000000-0000-4000-8000-000000000011",
    email: "alice@example.com",
    fullName: "Alice Morgan",
    accountType: "CLIENT",
    isAdmin: false,
    isSeller: false,
  },
  freelancer: {
    id: "00000000-0000-4000-8000-000000000012",
    email: "alex@example.com",
    fullName: "Alex Chen",
    accountType: "FREELANCER",
    isAdmin: false,
    isSeller: true,
  },
  admin: {
    id: "00000000-0000-4000-8000-000000000013",
    email: "admin@microgig.dev",
    fullName: "Marcus Reid",
    accountType: "CLIENT",
    isAdmin: true,
    isSeller: false,
  },
};

export const DEMO_CLIENT_NAME = DEMO_USERS.client.fullName;
export const MOCK_ME_SELLER_ID = "s-alex";

const H = 60 * 60 * 1000;
const D = 24 * H;

type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "EXPERT";

/** Public seller profile = seller card + bio and skills (SEL-01 / SEL-03). */
export interface SellerProfilePublic extends SellerCard {
  about: string;
  skills: { skillName: string; level: SkillLevel }[];
}

type Seed = Omit<SellerProfilePublic, "lastDeliveryAt"> & { lastDeliveryAgoMs: number | null };

const SEEDS: Seed[] = [
  {
    id: "s-alex",
    displayName: "Alex Chen",
    avatarUrl: "/images/avatars/alex.jpg",
    idVerified: true,
    headline: "Full-Stack Web Specialist",
    country: "Canada",
    memberSince: "2024-01-15T00:00:00Z",
    avgResponseHours: 1,
    lastDeliveryAgoMs: 3 * H,
    completionRate: 99,
    languages: [
      { language: "English", proficiency: "NATIVE" },
      { language: "French", proficiency: "CONVERSATIONAL" },
    ],
    about:
      "I'm a full-stack developer with six years of experience fixing layouts, building landing pages and wiring up APIs. I keep gigs small and fast: clear scope, 24-hour turnaround, and a short note explaining every fix so you learn what went wrong.",
    skills: [
      { skillName: "CSS", level: "EXPERT" },
      { skillName: "React", level: "EXPERT" },
      { skillName: "Node.js", level: "INTERMEDIATE" },
    ],
  },
  {
    id: "s-sara",
    displayName: "Sara Connor",
    avatarUrl: "/images/avatars/sara.jpg",
    idVerified: true,
    headline: "Icon & Brand Designer",
    country: "United Kingdom",
    memberSince: "2023-06-01T00:00:00Z",
    avgResponseHours: 2,
    lastDeliveryAgoMs: D,
    completionRate: 100,
    languages: [{ language: "English", proficiency: "NATIVE" }],
    about:
      "Brand designer focused on small, sharp deliverables: app icons, logo refreshes and social assets. Every file comes in vector and ready-to-upload sizes, with source files included once you accept the delivery.",
    skills: [
      { skillName: "Icon design", level: "EXPERT" },
      { skillName: "Illustrator", level: "EXPERT" },
      { skillName: "Branding", level: "INTERMEDIATE" },
    ],
  },
  {
    id: "s-marcus",
    displayName: "Marcus Vance",
    avatarUrl: "/images/avatars/marcus.jpg",
    idVerified: false,
    headline: "Editor & Proofreader",
    country: "United States",
    memberSince: "2025-03-10T00:00:00Z",
    avgResponseHours: 4,
    lastDeliveryAgoMs: 2 * D,
    completionRate: 96,
    languages: [
      { language: "English", proficiency: "NATIVE" },
      { language: "Spanish", proficiency: "FLUENT" },
    ],
    about:
      "Former newspaper copy editor. I proofread pitch decks, web copy and short documents with tracked changes, so you can accept or reject every edit. Fast, careful and friendly about style guides.",
    skills: [
      { skillName: "Proofreading", level: "EXPERT" },
      { skillName: "Copy editing", level: "EXPERT" },
    ],
  },
  {
    id: "s-dana",
    displayName: "Dana Kim",
    avatarUrl: "/images/avatars/dana.jpg",
    idVerified: true,
    headline: "SEO & Social Media Marketer",
    country: "South Korea",
    memberSince: "2024-09-02T00:00:00Z",
    avgResponseHours: 3,
    lastDeliveryAgoMs: 6 * H,
    completionRate: 98,
    languages: [
      { language: "Korean", proficiency: "NATIVE" },
      { language: "English", proficiency: "FLUENT" },
    ],
    about:
      "I help small teams get found and get clicked. Technical SEO audits with a prioritised fix list, and social posts written for your audience and platform. No fluff, just what you can act on this week.",
    skills: [
      { skillName: "Technical SEO", level: "EXPERT" },
      { skillName: "Copywriting", level: "INTERMEDIATE" },
      { skillName: "Google Search Console", level: "EXPERT" },
    ],
  },
  {
    id: "s-tom",
    displayName: "Tom Reyes",
    avatarUrl: "/images/avatars/tom.jpg",
    idVerified: true,
    headline: "Video Editor & Audio Engineer",
    country: "Philippines",
    memberSince: "2024-04-20T00:00:00Z",
    avgResponseHours: 2,
    lastDeliveryAgoMs: 12 * H,
    completionRate: 97,
    languages: [
      { language: "Filipino", proficiency: "NATIVE" },
      { language: "English", proficiency: "FLUENT" },
    ],
    about:
      "Short-form video editor for creators and startups. I trim, caption and clean up audio so your clips are ready for any platform. Quick turnaround and clear notes on every edit.",
    skills: [
      { skillName: "Premiere Pro", level: "EXPERT" },
      { skillName: "Audio cleanup", level: "EXPERT" },
    ],
  },
  {
    id: "s-lena",
    displayName: "Lena Fischer",
    avatarUrl: "/images/avatars/lena.jpg",
    idVerified: true,
    headline: "Print & Photo Retouching Designer",
    country: "Germany",
    memberSince: "2023-11-05T00:00:00Z",
    avgResponseHours: 5,
    lastDeliveryAgoMs: 2 * D,
    completionRate: 99,
    languages: [
      { language: "German", proficiency: "NATIVE" },
      { language: "English", proficiency: "FLUENT" },
    ],
    about:
      "Print designer and photo retoucher. Business cards that print correctly the first time, and clean product cut-outs for online shops. Files come print-ready with bleed and crop marks.",
    skills: [
      { skillName: "Photoshop", level: "EXPERT" },
      { skillName: "Print design", level: "EXPERT" },
    ],
  },
  {
    id: "s-kofi",
    displayName: "Kofi Mensah",
    avatarUrl: "/images/avatars/kofi.jpg",
    idVerified: true,
    headline: "Data & Document Specialist",
    country: "Ghana",
    memberSince: "2025-01-12T00:00:00Z",
    avgResponseHours: 1,
    lastDeliveryAgoMs: 4 * H,
    completionRate: 100,
    languages: [
      { language: "English", proficiency: "NATIVE" },
      { language: "Twi", proficiency: "NATIVE" },
    ],
    about:
      "Spreadsheet and document clean-up. I deduplicate, normalise and validate CSVs, and convert PDFs into clean, editable Word or Markdown files. Accurate, fast, and I always send a summary of what changed.",
    skills: [
      { skillName: "Excel", level: "EXPERT" },
      { skillName: "Data cleaning", level: "EXPERT" },
      { skillName: "Python", level: "INTERMEDIATE" },
    ],
  },
  {
    id: "s-maria",
    displayName: "Maria Lopez",
    avatarUrl: "/images/avatars/maria.jpg",
    idVerified: true,
    headline: "Writer, Translator & Virtual Assistant",
    country: "Spain",
    memberSince: "2024-02-28T00:00:00Z",
    avgResponseHours: 2,
    lastDeliveryAgoMs: 9 * H,
    completionRate: 98,
    languages: [
      { language: "Spanish", proficiency: "NATIVE" },
      { language: "English", proficiency: "FLUENT" },
      { language: "French", proficiency: "FLUENT" },
    ],
    about:
      "Trilingual writer and assistant. I polish resumes and cover letters, translate short texts between English, Spanish and French, and handle one-hour admin tasks so you can focus on your work.",
    skills: [
      { skillName: "Translation", level: "EXPERT" },
      { skillName: "Resume writing", level: "EXPERT" },
      { skillName: "Admin support", level: "INTERMEDIATE" },
    ],
  },
];

export function mockSellers(now: number): Record<string, SellerProfilePublic> {
  return Object.fromEntries(
    SEEDS.map(({ lastDeliveryAgoMs, ...s }) => [
      s.id,
      { ...s, lastDeliveryAt: lastDeliveryAgoMs === null ? null : new Date(now - lastDeliveryAgoMs).toISOString() },
    ]),
  );
}

/** Avatar lookup by display name (orders/messages only carry names). */
export const AVATAR_BY_NAME: Record<string, string> = Object.fromEntries(
  SEEDS.map((s) => [s.displayName, s.avatarUrl ?? ""]),
);
