ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "ledger_entries_order_type_unique";--> statement-breakpoint
ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "ledger_entries_order_type_account_unique";--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_type_account_unique" UNIQUE("order_id","entry_type","account_id");