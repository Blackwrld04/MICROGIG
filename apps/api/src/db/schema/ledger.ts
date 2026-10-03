import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./auth.js";

// ── Enums ────────────────────────────────────────────────────────────────────

export const accountKindEnum = pgEnum("account_kind", [
  "USER_AVAILABLE",
  "USER_PENDING",
  "ESCROW",
  "PLATFORM_REVENUE",
  "BUYER_FUNDING",
]);

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "TOP_UP",
  "ORDER_PLACED",
  "ORDER_COMPLETED",
  "CLEARING",
  "ORDER_REFUNDED",
  "WITHDRAWAL",
  "DISPUTE_ADJUSTMENT",
]);

// ── Ledger Accounts ───────────────────────────────────────────────────────────

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId:       text("user_id")
                    .references(() => users.id, { onDelete: "cascade" }),
    kind:         accountKindEnum("kind").notNull(),
    balanceCents: integer("balance_cents").notNull().default(0),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:        index("ledger_accounts_user_idx").on(t.userId),
    userKindUniq:   uniqueIndex("ledger_accounts_user_kind_unique").on(t.userId, t.kind).where(sql`user_id IS NOT NULL`),
    systemKindUniq: uniqueIndex("ledger_accounts_system_kind_unique").on(t.kind).where(sql`user_id IS NULL`),
  }),
);

// ── Ledger Entries ────────────────────────────────────────────────────────────

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    txnId:       text("txn_id").notNull(),
    accountId:   text("account_id")
                   .notNull()
                   .references(() => ledgerAccounts.id),
    orderId:     text("order_id"),
    entryType:   ledgerEntryTypeEnum("entry_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    txnIdx:      index("ledger_entries_txn_idx").on(t.txnId),
    accountIdx:  index("ledger_entries_account_idx").on(t.accountId, t.createdAt),
    idempotency: unique("ledger_entries_order_type_account_unique").on(t.orderId, t.entryType, t.accountId),
  }),
);

// ── Relations ────────────────────────────────────────────────────────────────

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ one, many }) => ({
  user:    one(users, { fields: [ledgerAccounts.userId], references: [users.id] }),
  entries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  account: one(ledgerAccounts, { fields: [ledgerEntries.accountId], references: [ledgerAccounts.id] }),
}));
