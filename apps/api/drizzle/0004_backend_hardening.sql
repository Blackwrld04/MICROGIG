CREATE TYPE "public"."email_status" AS ENUM('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'REVIEW_REMINDER';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'DISPUTE_RESOLVED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'ORDER_CANCELLED';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"user_id" text NOT NULL,
	"key" varchar(255) NOT NULL,
	"route" text NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"status_code" integer,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
-- Pending codes were stored in plain text; drop them (they expire within 15 minutes anyway).
DELETE FROM "email_verifications";--> statement-breakpoint
DROP INDEX IF EXISTS "email_verifications_email_idx";--> statement-breakpoint
ALTER TABLE "email_verifications" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD COLUMN "code_hash" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD COLUMN "send_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD COLUMN "window_started_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD COLUMN "last_sent_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_login_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "preview_key" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
-- Existing notifications were already emailed by the old code path: mark them SKIPPED so the
-- outbox doesn't send them again, then make PENDING the default for new rows.
ALTER TABLE "notifications" ADD COLUMN "email_status" "email_status" DEFAULT 'SKIPPED' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "email_status" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_last_error" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_verifications_email_unique" ON "email_verifications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_dedupe_unique" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_email_queue_idx" ON "notifications" USING btree ("email_status","email_next_attempt_at");