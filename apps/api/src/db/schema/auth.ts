import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ────────────────────────────────────────────────────────────────────

export const accountTypeEnum = pgEnum("account_type", ["CLIENT", "FREELANCER"]);

// ── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email:        varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName:     varchar("full_name", { length: 120 }).notNull(),
  accountType:  accountTypeEnum("account_type").notNull(),
  isAdmin:      boolean("is_admin").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Login lockout (PRD §13.2): 5 failed attempts lock the account for 15 minutes.
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil:  timestamp("locked_until", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Email Verifications ───────────────────────────────────────────────────────
// One row per email. Only a SHA-256 of the code is stored; `attempts` caps guesses and the
// send counters throttle how often a code can be emailed.

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id:              text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    email:           varchar("email", { length: 255 }).notNull(),
    codeHash:        varchar("code_hash", { length: 64 }).notNull(),
    attempts:        integer("attempts").notNull().default(0),
    sendCount:       integer("send_count").notNull().default(1),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    lastSentAt:      timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt:       timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("email_verifications_email_unique").on(t.email),
  }),
);

// ── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId:    text("user_id")
                 .notNull()
                 .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

// ── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
