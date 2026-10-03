-- =============================================================================
-- microgig — Double-Entry Ledger Zero-Sum Constraint Trigger (PRD §11.4)
-- Enforces that all ledger_entries sharing a txn_id must sum exactly to 0 cents.
-- This trigger is DEFERRED, firing at COMMIT time so multi-leg transactions can
-- insert multiple rows before verification.
-- =============================================================================

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

DROP TRIGGER IF EXISTS "trg_assert_ledger_zero_sum" ON "ledger_entries";
CREATE CONSTRAINT TRIGGER "trg_assert_ledger_zero_sum"
AFTER INSERT OR UPDATE ON "ledger_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION verify_ledger_transaction_zero_sum();
