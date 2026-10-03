import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  timestamp,
  index,
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
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
