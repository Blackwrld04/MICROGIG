import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  serial,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth.js";
import { gigs } from "./catalog.js";

// ── Enums ────────────────────────────────────────────────────────────────────

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING_REQUIREMENTS",
  "IN_PROGRESS",
  "DELIVERED",
  "IN_REVISION",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
]);

export const deliveryKindEnum = pgEnum("delivery_kind", [
  "image",
  "archive",
  "document",
]);

// ── Orders ────────────────────────────────────────────────────────────────────

export const orders = pgTable(
  "orders",
  {
    id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orderNumber: serial("order_number").notNull(),
    gigId:       text("gig_id").notNull().references(() => gigs.id),
    buyerId:     text("buyer_id").notNull().references(() => users.id),
    sellerId:    text("seller_id").notNull().references(() => users.id),

    status: orderStatusEnum("status").notNull().default("PENDING_REQUIREMENTS"),

    priceCents:          integer("price_cents").notNull(),
    feeRateBps:          integer("fee_rate_bps").notNull().default(2000),
    turnaroundHours:     integer("turnaround_hours").notNull(),
    revisionsIncluded:   integer("revisions_included").notNull(),
    revisionsUsed:       integer("revisions_used").notNull().default(0),
    requirementsPrompt:  text("requirements_prompt").array().notNull(),
    requirementsAnswers: text("requirements_answers").array(),

    deadline:                timestamp("deadline", { withTimezone: true }),
    revisionDeadline:        timestamp("revision_deadline", { withTimezone: true }),
    autoCompleteAt:          timestamp("auto_complete_at", { withTimezone: true }),
    completedAt:             timestamp("completed_at", { withTimezone: true }),
    disputedAt:              timestamp("disputed_at", { withTimezone: true }),
    mutualCancelRequestedBy: text("mutual_cancel_requested_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    buyerStatusIdx:  index("orders_buyer_status_idx").on(t.buyerId, t.status),
    sellerStatusIdx: index("orders_seller_status_idx").on(t.sellerId, t.status),
    autoCompleteIdx: index("orders_auto_complete_idx").on(t.status, t.autoCompleteAt),
    deadlineIdx:     index("orders_deadline_idx").on(t.status, t.deadline),
    orderNumberIdx:  index("orders_order_number_idx").on(t.orderNumber),
  }),
);

// ── Order Events (audit log) ──────────────────────────────────────────────────

export const orderEvents = pgTable(
  "order_events",
  {
    id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orderId:   text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    label:     text("label").notNull(),
    actor:     text("actor").notNull(),
    detail:    text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index("order_events_order_idx").on(t.orderId),
  }),
);

// ── Order Stars ───────────────────────────────────────────────────────────────

export const orderStars = pgTable(
  "order_stars",
  {
    userId:  text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.orderId] }),
  }),
);

// ── Deliveries ────────────────────────────────────────────────────────────────

export const deliveries = pgTable(
  "deliveries",
  {
    id:         text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orderId:    text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    sequenceNo: integer("sequence_no").notNull(),
    fileName:   text("file_name").notNull(),
    fileSize:   integer("file_size").notNull(),
    sha256:     text("sha256").notNull(),
    storageKey: text("storage_key").notNull(),
    kind:       deliveryKindEnum("kind").notNull(),
    fileTree:   text("file_tree").array(),
    notes:      text("notes").notNull().default(""),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx:       index("deliveries_order_idx").on(t.orderId),
    orderSeqUnique: unique("deliveries_order_seq_unique").on(t.orderId, t.sequenceNo),
  }),
);

// ── Messages ──────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id:             text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orderId:        text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    senderId:       text("sender_id").notNull().references(() => users.id),
    senderRole:     text("sender_role").notNull(),
    body:           text("body").notNull(),
    attachmentName: text("attachment_name"),
    hasLeakage:     boolean("has_leakage").notNull().default(false),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderTimeIdx: index("messages_order_time_idx").on(t.orderId, t.createdAt),
  }),
);

// ── Reviews ───────────────────────────────────────────────────────────────────

export const reviews = pgTable(
  "reviews",
  {
    id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orderId:   text("order_id").notNull().unique().references(() => orders.id),
    gigId:     text("gig_id").notNull().references(() => gigs.id),
    buyerId:   text("buyer_id").notNull().references(() => users.id),
    rating:    integer("rating").notNull(),
    body:      varchar("body", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    gigIdx: index("reviews_gig_idx").on(t.gigId),
  }),
);

// ── Disputes ──────────────────────────────────────────────────────────────────

export const disputeStatusEnum = pgEnum("dispute_status", ["OPEN", "RESOLVED"]);

export const disputes = pgTable("disputes", {
  id:         text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId:    text("order_id").notNull().unique().references(() => orders.id),
  reason:     text("reason").notNull(),
  status:     disputeStatusEnum("status").notNull().default("OPEN"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ────────────────────────────────────────────────────────────────

export const ordersRelations = relations(orders, ({ one, many }) => ({
  gig:        one(gigs,   { fields: [orders.gigId],    references: [gigs.id] }),
  buyer:      one(users,  { fields: [orders.buyerId],  references: [users.id] }),
  seller:     one(users,  { fields: [orders.sellerId], references: [users.id] }),
  events:     many(orderEvents),
  deliveries: many(deliveries),
  messages:   many(messages),
  starredBy:  many(orderStars),
  review:     one(reviews),
  dispute:    one(disputes),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  order: one(orders, { fields: [deliveries.orderId], references: [orders.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  order:  one(orders, { fields: [messages.orderId],   references: [orders.id] }),
  sender: one(users,  { fields: [messages.senderId],  references: [users.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
  gig:   one(gigs,   { fields: [reviews.gigId],   references: [gigs.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  order: one(orders, { fields: [disputes.orderId], references: [orders.id] }),
}));
