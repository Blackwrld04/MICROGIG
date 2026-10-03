import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth.js";

// ── Enums ────────────────────────────────────────────────────────────────────

export const verificationStatusEnum = pgEnum("verification_status", [
  "NOT_SUBMITTED",
  "PENDING_VERIFICATION",
  "APPROVED",
  "REJECTED",
]);

export const idDocumentTypeEnum = pgEnum("id_document_type", [
  "PASSPORT",
  "NATIONAL_ID",
  "DRIVERS_LICENSE",
]);

export const proficiencyEnum = pgEnum("proficiency", [
  "BASIC",
  "CONVERSATIONAL",
  "FLUENT",
  "NATIVE",
]);

export const skillLevelEnum = pgEnum("skill_level", [
  "BEGINNER",
  "INTERMEDIATE",
  "EXPERT",
]);

// ── Seller Profiles ───────────────────────────────────────────────────────────

export const sellerProfiles = pgTable("seller_profiles", {
  id:                      text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:                  text("user_id")
                             .notNull()
                             .unique()
                             .references(() => users.id, { onDelete: "cascade" }),
  displayName:             varchar("display_name", { length: 80 }).notNull().default(""),
  headline:                varchar("headline", { length: 80 }).notNull().default(""),
  about:                   varchar("about", { length: 600 }).notNull().default(""),
  country:                 varchar("country", { length: 60 }).notNull().default(""),
  idVerified:              boolean("id_verified").notNull().default(false),
  verificationStatus:      verificationStatusEnum("verification_status")
                             .notNull()
                             .default("NOT_SUBMITTED"),
  idDocumentType:          idDocumentTypeEnum("id_document_type"),
  documentReference:       varchar("document_reference", { length: 60 }),
  verificationSubmittedAt: timestamp("verification_submitted_at", { withTimezone: true }),
  createdAt:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Seller Languages ──────────────────────────────────────────────────────────

export const sellerLanguages = pgTable("seller_languages", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId:   text("profile_id")
                 .notNull()
                 .references(() => sellerProfiles.id, { onDelete: "cascade" }),
  language:    varchar("language", { length: 60 }).notNull(),
  proficiency: proficiencyEnum("proficiency").notNull(),
});

// ── Seller Skills ─────────────────────────────────────────────────────────────

export const sellerSkills = pgTable("seller_skills", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: text("profile_id")
               .notNull()
               .references(() => sellerProfiles.id, { onDelete: "cascade" }),
  skillName: varchar("skill_name", { length: 60 }).notNull(),
  level:     skillLevelEnum("level").notNull(),
});

// ── Relations ────────────────────────────────────────────────────────────────

export const sellerProfilesRelations = relations(sellerProfiles, ({ one, many }) => ({
  user:      one(users, { fields: [sellerProfiles.userId], references: [users.id] }),
  languages: many(sellerLanguages),
  skills:    many(sellerSkills),
}));

export const sellerLanguagesRelations = relations(sellerLanguages, ({ one }) => ({
  profile: one(sellerProfiles, { fields: [sellerLanguages.profileId], references: [sellerProfiles.id] }),
}));

export const sellerSkillsRelations = relations(sellerSkills, ({ one }) => ({
  profile: one(sellerProfiles, { fields: [sellerSkills.profileId], references: [sellerProfiles.id] }),
}));
