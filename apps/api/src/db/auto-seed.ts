import bcrypt from "bcryptjs";
import { db } from "./connection.js";
import {
  users,
  sellerProfiles,
  sellerSkills,
  sellerLanguages,
  gigs,
  gigFaqs,
  ledgerAccounts,
} from "./schema/index.js";
import { eq, count } from "drizzle-orm";
import { generateGigSlug } from "../lib/slug.js";

const BCRYPT_ROUNDS = 10;

export async function ensureInitialData() {
  try {
    // 1. System Ledger Accounts (ESCROW, PLATFORM_REVENUE, BUYER_FUNDING)
    const systemKinds = ["ESCROW", "PLATFORM_REVENUE", "BUYER_FUNDING"] as const;
    for (const kind of systemKinds) {
      const [existing] = await db
        .select({ id: ledgerAccounts.id })
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.kind, kind))
        .limit(1);

      if (!existing) {
        await db.insert(ledgerAccounts).values({
          userId: null,
          kind,
          balanceCents: 0,
        });
      }
    }

    // 2. Check if catalog gigs already exist
    const [gigCountRes] = await db.select({ total: count() }).from(gigs);
    if (Number(gigCountRes?.total ?? 0) > 0) {
      return;
    }

    console.log("🌱 [auto-seed] Database has 0 gigs. Populating initial showcase catalog...");

    // 3. Create or find verified showcase freelancer
    const sellerEmail = "seller@microgig.dev";
    let [sellerUser] = await db.select().from(users).where(eq(users.email, sellerEmail)).limit(1);
    let sellerProfileId = "";

    if (!sellerUser) {
      const sellerId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash("SellerPass123!", BCRYPT_ROUNDS);

      await db.insert(users).values({
        id: sellerId,
        email: sellerEmail,
        passwordHash,
        fullName: "Elena Rostova",
        accountType: "FREELANCER",
        isAdmin: false,
        emailVerified: true,
      });

      await db.insert(ledgerAccounts).values({
        userId: sellerId,
        kind: "USER_AVAILABLE",
        balanceCents: 15000,
      });

      const [profile] = await db.insert(sellerProfiles).values({
        userId: sellerId,
        displayName: "Elena R.",
        headline: "Senior Brand Designer & Full-Stack Creative",
        about: "Over 8 years helping founders build standout digital products, iconic brand identities, and responsive web experiences.",
        country: "United States",
        idVerified: true,
        verificationStatus: "APPROVED",
        idDocumentType: "PASSPORT",
        documentReference: "P-98421035",
        verificationSubmittedAt: new Date(),
      }).returning({ id: sellerProfiles.id });

      sellerProfileId = profile.id;

      await db.insert(sellerSkills).values([
        { profileId: profile.id, skillName: "Logo Design", level: "EXPERT" },
        { profileId: profile.id, skillName: "Brand Identity", level: "EXPERT" },
        { profileId: profile.id, skillName: "Frontend Bug Fixing", level: "EXPERT" },
        { profileId: profile.id, skillName: "SEO Copywriting", level: "EXPERT" },
      ]);

      await db.insert(sellerLanguages).values([
        { profileId: profile.id, language: "English", proficiency: "NATIVE" },
      ]);
    } else {
      const [profile] = await db
        .select({ id: sellerProfiles.id })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, sellerUser.id))
        .limit(1);
      sellerProfileId = profile?.id ?? "";
    }

    if (!sellerProfileId) {
      console.warn("⚠️ [auto-seed] Could not obtain sellerProfileId, skipping gig insertion.");
      return;
    }

    // 4. Showcase Gigs
    const showcaseGigs = [
      {
        title: "I will design a modern minimalist vector logo for your brand",
        category: "graphics-design",
        subcategory: "logo-design-tweaks",
        description: "Get a clean, modern, and memorable minimalist vector logo tailored to your business identity. Delivered with source SVG, high-res transparent PNG, and commercial usage rights included.",
        priceCents: 2500, // $25.00
        turnaroundHours: 24,
        revisionsIncluded: 3,
        tags: ["logo", "branding", "minimalist", "vector", "design"],
        thumbnailUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800",
        requirementsPrompt: [
          "What is your brand or project name?",
          "Do you have preferred brand colors or design aesthetics?",
          "Are there any competitor logos or visual references you like?",
        ],
        faqs: [
          { question: "What files will I receive?", answer: "You will receive high-resolution vector SVG, PDF, transparent PNG, and preview JPG files." },
          { question: "Can I request revisions?", answer: "Yes, 3 revision rounds are included with your order." },
        ],
      },
      {
        title: "I will fix 1 responsive CSS or layout bug",
        category: "programming-tech",
        subcategory: "bug-fixes-html-css-js",
        description: "Struggling with sticky elements, broken flexbox wrapping, or mobile viewport overflow? I will diagnose and fix your frontend CSS, Tailwind, or layout bugs within 24 hours.",
        priceCents: 1500, // $15.00
        turnaroundHours: 24,
        revisionsIncluded: 2,
        tags: ["css", "html", "tailwind", "responsive", "bugfix"],
        thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
        requirementsPrompt: [
          "What browser/device does the layout bug occur on?",
          "Please provide the relevant HTML/CSS snippet or repository link.",
        ],
        faqs: [
          { question: "Do you support Tailwind CSS?", answer: "Yes, I support vanilla CSS, Tailwind CSS, Sass, and CSS Modules." },
        ],
      },
      {
        title: "I will write high converting SEO product descriptions",
        category: "writing-translation",
        subcategory: "product-description-copy",
        description: "Engage your customers and boost your e-commerce conversion rates with persuasive, search-optimized product descriptions tailored for Shopify, Amazon, or Etsy stores.",
        priceCents: 2000, // $20.00
        turnaroundHours: 48,
        revisionsIncluded: 2,
        tags: ["copywriting", "seo", "ecommerce", "shopify", "product"],
        thumbnailUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800",
        requirementsPrompt: [
          "What is the product and its key features/benefits?",
          "Who is your target audience?",
        ],
        faqs: [
          { question: "Is the copy checked for plagiarism?", answer: "Yes, 100% original copy guaranteed." },
        ],
      },
      {
        title: "I will edit YouTube short reels and TikTok videos with captions",
        category: "video-animation",
        subcategory: "short-video-trim",
        description: "Transform your raw footage into dynamic, high-retention short videos with punchy jump cuts, kinetic animated captions, sound effects, and background music.",
        priceCents: 3000, // $30.00
        turnaroundHours: 48,
        revisionsIncluded: 3,
        tags: ["reels", "tiktok", "shorts", "videoediting", "captions"],
        thumbnailUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800",
        requirementsPrompt: [
          "Please share a link to your raw video footage (Google Drive/Dropbox).",
          "What style of captions or color scheme do you prefer?",
        ],
        faqs: [
          { question: "What is the max footage length?", answer: "Raw footage up to 5 minutes edited down to a 30-60s reel." },
        ],
      },
      {
        title: "I will audit and optimize your Google search SEO tags",
        category: "digital-marketing",
        subcategory: "seo-metadata-audit",
        description: "Full audit of your title tags, meta descriptions, OpenGraph social cards, canonical URLs, and schema markup to maximize search engine visibility and click-through rates.",
        priceCents: 3500, // $35.00
        turnaroundHours: 48,
        revisionsIncluded: 2,
        tags: ["seo", "marketing", "google", "meta-tags", "audit"],
        thumbnailUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
        requirementsPrompt: [
          "What is your website URL?",
          "What are the target keywords for your site?",
        ],
        faqs: [
          { question: "Do you deliver an action report?", answer: "Yes, you receive a detailed checklist and recommended tag values." },
        ],
      },
      {
        title: "I will clean and organize your CSV or Excel dataset",
        category: "operations-admin",
        subcategory: "spreadsheet-cleanup-formatting",
        description: "Messy spreadsheets slowing you down? I will remove duplicates, fix column formatting, standardise dates and phone numbers, and prepare your data for import.",
        priceCents: 2000, // $20.00
        turnaroundHours: 24,
        revisionsIncluded: 2,
        tags: ["excel", "csv", "data-entry", "cleanup", "formatting"],
        thumbnailUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
        requirementsPrompt: [
          "Please upload your sample CSV or Excel spreadsheet.",
          "Specify the desired output format and columns.",
        ],
        faqs: [
          { question: "Is my data kept confidential?", answer: "Strict confidentiality guaranteed; all files deleted after delivery." },
        ],
      },
    ];

    for (const g of showcaseGigs) {
      const slug = generateGigSlug(g.title);
      const [insertedGig] = await db.insert(gigs).values({
        slug,
        sellerId: sellerProfileId,
        title: g.title,
        category: g.category,
        subcategory: g.subcategory,
        description: g.description,
        priceCents: g.priceCents,
        turnaroundHours: g.turnaroundHours,
        revisionsIncluded: g.revisionsIncluded,
        requirementsPrompt: g.requirementsPrompt,
        tags: g.tags,
        thumbnailUrl: g.thumbnailUrl,
        status: "PUBLISHED",
        avgRating: 4.9,
        reviewCount: 18,
        favoriteCount: 24,
      }).returning({ id: gigs.id });

      for (let i = 0; i < g.faqs.length; i++) {
        await db.insert(gigFaqs).values({
          gigId: insertedGig.id,
          question: g.faqs[i].question,
          answer: g.faqs[i].answer,
          position: i,
        });
      }

      console.log(`  ✓ [auto-seed] Created published gig: "${g.title}"`);
    }

    console.log("✅ [auto-seed] Finished populating initial marketplace gigs!");
  } catch (err) {
    console.error("❌ [auto-seed] Failed to auto-seed initial data:", err);
  }
}
