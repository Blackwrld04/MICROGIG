ALTER TABLE "ledger_accounts" DROP CONSTRAINT "ledger_accounts_user_kind_unique";--> statement-breakpoint
ALTER TABLE "ledger_accounts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_user_kind_unique" ON "ledger_accounts" USING btree ("user_id","kind") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_system_kind_unique" ON "ledger_accounts" USING btree ("kind") WHERE user_id IS NULL;