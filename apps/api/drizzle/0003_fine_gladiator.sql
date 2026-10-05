CREATE TABLE IF NOT EXISTS "email_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(10) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verifications_email_idx" ON "email_verifications" USING btree ("email");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION verify_ledger_transaction_zero_sum()
RETURNS TRIGGER AS $$
DECLARE
  v_sum BIGINT;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_sum
  FROM "ledger_entries"
  WHERE "txn_id" = NEW."txn_id";

  IF v_sum <> 0 THEN
    RAISE EXCEPTION 'Ledger transaction % is unbalanced! Net sum is % cents (must be exactly 0)',
      NEW."txn_id", v_sum;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_assert_ledger_zero_sum" ON "ledger_entries";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "trg_assert_ledger_zero_sum"
AFTER INSERT OR UPDATE ON "ledger_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION verify_ledger_transaction_zero_sum();