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
  ledgerEntries,
} from "./schema/index.js";
import { eq } from "drizzle-orm";
import { generateGigSlug } from "../lib/slug.js";

const BCRYPT_ROUNDS = 12;

export async function seedDatabase() {
  console.log("🌱 Starting Micro-Gig database seeding...");

  // 1. Seed System Ledger Accounts (ESCROW, PLATFORM_REVENUE, BUYER_FUNDING)
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
      console.log(`  ✓ Created system ledger account: ${kind}`);
    }
  }

  // 2. Admin User
  const adminEmail = "admin@microgig.dev";
  const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("Admin123!", BCRYPT_ROUNDS);
    const adminId = crypto.randomUUID();
    await db.insert(users).values({
      id: adminId,
      email: adminEmail,
      passwordHash,
      fullName: "Platform Administrator",
      accountType: "CLIENT",
      isAdmin: true,
    });

    await db.insert(ledgerAccounts).values({
      userId: adminId,
      kind: "USER_AVAILABLE",
      balanceCents: 0,
    });
    console.log("  ✓ Created Admin user: admin@microgig.dev / Admin123!");
  }

  // 3. Client User (Alex Rivera)
  const clientEmail = "client@microgig.dev";
  let clientUser = (await db.select().from(users).where(eq(users.email, clientEmail)).limit(1))[0];
  if (!clientUser) {
    const passwordHash = await bcrypt.hash("Client123!", BCRYPT_ROUNDS);
    const clientId = crypto.randomUUID();
    await db.insert(users).values({
      id: clientId,
      email: clientEmail,
      passwordHash,
      fullName: "Alex Rivera",
      accountType: "CLIENT",
      isAdmin: false,
    });

    const availAcct = (await db.insert(ledgerAccounts).values({
      userId: clientId,
      kind: "USER_AVAILABLE",
      balanceCents: 10000, // $100.00 virtual funding
    }).returning())[0];

    const fundAcct = (await db.insert(ledgerAccounts).values({
      userId: clientId,
      kind: "BUYER_FUNDING",
      balanceCents: -10000,
    }).returning())[0];

    const txnId = crypto.randomUUID();
    await db.insert(ledgerEntries).values([
      { txnId, accountId: fundAcct.id, amountCents: -10000, entryType: "TOP_UP", description: "Initial seeded virtual funds" },
      { txnId, accountId: availAcct.id, amountCents: 10000, entryType: "TOP_UP", description: "Initial seeded virtual funds" },
    ]);

    clientUser = (await db.select().from(users).where(eq(users.id, clientId)).limit(1))[0];
    console.log("  ✓ Created Client user: client@microgig.dev / Client123! ($100 balance)");
  }

  // 4. Freelancer User (Sara Connor)
  const sellerEmail = "seller@microgig.dev";
  let sellerUser = (await db.select().from(users).where(eq(users.email, sellerEmail)).limit(1))[0];
  let sellerProfileId = "";

  if (!sellerUser) {
    const passwordHash = await bcrypt.hash("Seller123!", BCRYPT_ROUNDS);
    const sellerId = crypto.randomUUID();
    await db.insert(users).values({
      id: sellerId,
      email: sellerEmail,
      passwordHash,
      fullName: "Sara Connor",
      accountType: "FREELANCER",
      isAdmin: false,
    });

    await db.insert(ledgerAccounts).values([
      { userId: sellerId, kind: "USER_AVAILABLE", balanceCents: 5000 },
      { userId: sellerId, kind: "USER_PENDING", balanceCents: 2800 },
    ]);

    const [profile] = await db.insert(sellerProfiles).values({
      userId: sellerId,
      displayName: "Sara Connor",
      headline: "Senior Brand Designer & Vector Specialist",
      about: "Professional graphic designer with 7+ years of experience helping startups and indie hackers build memorable brand identities. Fast turnaround and pixel-perfect deliverables guaranteed.",
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
      { profileId: profile.id, skillName: "Figma", level: "EXPERT" },
      { profileId: profile.id, skillName: "Vector Illustration", level: "INTERMEDIATE" },
    ]);

    await db.insert(sellerLanguages).values([
      { profileId: profile.id, language: "English", proficiency: "NATIVE" },
      { profileId: profile.id, language: "Spanish", proficiency: "CONVERSATIONAL" },
    ]);

    sellerUser = (await db.select().from(users).where(eq(users.id, sellerId)).limit(1))[0];
    console.log("  ✓ Created Freelancer user: seller@microgig.dev / Seller123! (Verified profile)");
  } else {
    const [profile] = await db.select({ id: sellerProfiles.id }).from(sellerProfiles).where(eq(sellerProfiles.userId, sellerUser.id)).limit(1);
    sellerProfileId = profile?.id ?? "";
  }

  // 5. Seed Published Gigs
  if (sellerProfileId) {
    const sampleGigs = [
      {
        title: "I will design a modern minimalist vector logo for your brand",
        category: "Graphics & Design",
        subcategory: "Logo Design & Tweaks",
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
        title: "I will fix CSS flexbox and responsive layout bugs in your web app",
        category: "Programming & Tech",
        subcategory: "Bug Fixing & Code Review",
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
        category: "Writing & Translation",
        subcategory: "Product Descriptions",
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
        category: "Video & Animation",
        subcategory: "Short Video Ads & Reels",
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
    ];

    for (const g of sampleGigs) {
      const slug = generateGigSlug(g.title);
      const [existing] = await db.select({ id: gigs.id }).from(gigs).where(eq(gigs.slug, slug)).limit(1);
      if (!existing) {
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
          avgRating: 5.0,
          reviewCount: 3,
          favoriteCount: 12,
        }).returning({ id: gigs.id });

        for (let i = 0; i < g.faqs.length; i++) {
          await db.insert(gigFaqs).values({
            gigId: insertedGig.id,
            question: g.faqs[i].question,
            answer: g.faqs[i].answer,
            position: i,
          });
        }

        console.log(`  ✓ Created published gig: "${g.title}"`);
      }
    }
  }

  console.log("✅ Seeding completed successfully!");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    });
}
