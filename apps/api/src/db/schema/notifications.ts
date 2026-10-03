import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth.js";

// ── Enums ────────────────────────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "ORDER_PLACED",
  "REQUIREMENTS_SUBMITTED",
  "DELIVERABLE_UPLOADED",
  "REVISION_REQUESTED",
  "ORDER_COMPLETED",
  "AUTO_COMPLETE_WARNING",
  "LATE_WARNING",
  "DISPUTE_OPENED",
  "NEW_MESSAGE",
]);

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId:    text("user_id")
                 .notNull()
                 .references(() => users.id, { onDelete: "cascade" }),
    type:      notificationTypeEnum("type").notNull(),
    orderId:   text("order_id"),
    message:   text("message").notNull(),
    read:      boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userReadIdx: index("notifications_user_read_idx").on(t.userId, t.read),
  }),
);

// ── Notification Preferences ──────────────────────────────────────────────────

export const notificationPrefs = pgTable("notification_prefs", {
  userId:     text("user_id")
                .primaryKey()
                .references(() => users.id, { onDelete: "cascade" }),
  orderEmail: boolean("order_email").notNull().default(true),
  inboxEmail: boolean("inbox_email").notNull().default(true),
  promoEmail: boolean("promo_email").notNull().default(false),
});

// ── Relations ────────────────────────────────────────────────────────────────

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const notificationPrefsRelations = relations(notificationPrefs, ({ one }) => ({
  user: one(users, { fields: [notificationPrefs.userId], references: [users.id] }),
}));

