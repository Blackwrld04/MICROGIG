import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth.js";
import { sellerProfiles } from "./seller.js";

// ── Enums ────────────────────────────────────────────────────────────────────

export const gigStatusEnum = pgEnum("gig_status", [
  "DRAFT",
  "PUBLISHED",
  "PAUSED",
  "DELETED",
]);

// ── Gigs ─────────────────────────────────────────────────────────────────────

export const gigs = pgTable(
  "gigs",
  {
    id:                 text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug:               varchar("slug", { length: 120 }).notNull().unique(),
    sellerId:           text("seller_id")
                          .notNull()
                          .references(() => sellerProfiles.id),
    title:              varchar("title", { length: 80 }).notNull(),
    category:           text("category").notNull(),
    subcategory:        text("subcategory").notNull(),
    description:        text("description").notNull(),
    priceCents:         integer("price_cents").notNull(),
    turnaroundHours:    integer("turnaround_hours").notNull(),
    revisionsIncluded:  integer("revisions_included").notNull().default(2),
    requirementsPrompt: text("requirements_prompt").array().notNull(),
    tags:               text("tags").array().notNull().default([]),
    thumbnailUrl:       text("thumbnail_url"),
    status:             gigStatusEnum("status").notNull().default("DRAFT"),
    avgRating:          real("avg_rating"),
    reviewCount:        integer("review_count").notNull().default(0),
    favoriteCount:      integer("favorite_count").notNull().default(0),
    createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index("gigs_category_idx").on(t.category, t.subcategory),
    statusIdx:   index("gigs_status_idx").on(t.status),
    priceIdx:    index("gigs_price_idx").on(t.priceCents),
  }),
);

// ── Gig Images ────────────────────────────────────────────────────────────────

export const gigImages = pgTable("gig_images", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  gigId:     text("gig_id")
               .notNull()
               .references(() => gigs.id, { onDelete: "cascade" }),
  url:       text("url").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  position:  integer("position").notNull().default(0),
});

// ── Gig FAQs ──────────────────────────────────────────────────────────────────

export const gigFaqs = pgTable("gig_faqs", {
  id:       text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  gigId:    text("gig_id")
              .notNull()
              .references(() => gigs.id, { onDelete: "cascade" }),
  question: varchar("question", { length: 150 }).notNull(),
  answer:   varchar("answer", { length: 600 }).notNull(),
  position: integer("position").notNull().default(0),
});

// ── Favorites ─────────────────────────────────────────────────────────────────

export const favorites = pgTable(
  "favorites",
  {
    userId: text("user_id")
              .notNull()
              .references(() => users.id, { onDelete: "cascade" }),
    gigId:  text("gig_id")
              .notNull()
              .references(() => gigs.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.gigId] }),
  }),
);

// ── Relations ────────────────────────────────────────────────────────────────

export const gigsRelations = relations(gigs, ({ one, many }) => ({
  seller:    one(sellerProfiles, { fields: [gigs.sellerId], references: [sellerProfiles.id] }),
  images:    many(gigImages),
  faqs:      many(gigFaqs),
  favorites: many(favorites),
}));

export const gigImagesRelations = relations(gigImages, ({ one }) => ({
  gig: one(gigs, { fields: [gigImages.gigId], references: [gigs.id] }),
}));

export const gigFaqsRelations = relations(gigFaqs, ({ one }) => ({
  gig: one(gigs, { fields: [gigFaqs.gigId], references: [gigs.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  gig:  one(gigs,  { fields: [favorites.gigId],  references: [gigs.id] }),
}));
