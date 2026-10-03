CREATE TYPE "public"."account_type" AS ENUM('CLIENT', 'FREELANCER');--> statement-breakpoint
CREATE TYPE "public"."id_document_type" AS ENUM('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE');--> statement-breakpoint
CREATE TYPE "public"."proficiency" AS ENUM('BASIC', 'CONVERSATIONAL', 'FLUENT', 'NATIVE');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('BEGINNER', 'INTERMEDIATE', 'EXPERT');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('NOT_SUBMITTED', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."gig_status" AS ENUM('DRAFT', 'PUBLISHED', 'PAUSED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."delivery_kind" AS ENUM('image', 'archive', 'document');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING_REQUIREMENTS', 'IN_PROGRESS', 'DELIVERED', 'IN_REVISION', 'COMPLETED', 'CANCELLED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."account_kind" AS ENUM('USER_AVAILABLE', 'USER_PENDING', 'ESCROW', 'PLATFORM_REVENUE', 'BUYER_FUNDING');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('TOP_UP', 'ORDER_PLACED', 'ORDER_COMPLETED', 'CLEARING', 'ORDER_REFUNDED', 'WITHDRAWAL', 'DISPUTE_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('ORDER_PLACED', 'REQUIREMENTS_SUBMITTED', 'DELIVERABLE_UPLOADED', 'REVISION_REQUESTED', 'ORDER_COMPLETED', 'AUTO_COMPLETE_WARNING', 'LATE_WARNING', 'DISPUTE_OPENED', 'NEW_MESSAGE');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"account_type" "account_type" NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_languages" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"language" varchar(60) NOT NULL,
	"proficiency" "proficiency" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" varchar(80) DEFAULT '' NOT NULL,
	"headline" varchar(80) DEFAULT '' NOT NULL,
	"about" varchar(600) DEFAULT '' NOT NULL,
	"country" varchar(60) DEFAULT '' NOT NULL,
	"id_verified" boolean DEFAULT false NOT NULL,
	"verification_status" "verification_status" DEFAULT 'NOT_SUBMITTED' NOT NULL,
	"id_document_type" "id_document_type",
	"document_reference" varchar(60),
	"verification_submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"skill_name" varchar(60) NOT NULL,
	"level" "skill_level" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "favorites" (
	"user_id" text NOT NULL,
	"gig_id" text NOT NULL,
	CONSTRAINT "favorites_user_id_gig_id_pk" PRIMARY KEY("user_id","gig_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gig_faqs" (
	"id" text PRIMARY KEY NOT NULL,
	"gig_id" text NOT NULL,
	"question" varchar(150) NOT NULL,
	"answer" varchar(600) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gig_images" (
	"id" text PRIMARY KEY NOT NULL,
	"gig_id" text NOT NULL,
	"url" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gigs" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"seller_id" text NOT NULL,
	"title" varchar(80) NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"description" text NOT NULL,
	"price_cents" integer NOT NULL,
	"turnaround_hours" integer NOT NULL,
	"revisions_included" integer DEFAULT 2 NOT NULL,
	"requirements_prompt" text[] NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"thumbnail_url" text,
	"status" "gig_status" DEFAULT 'DRAFT' NOT NULL,
	"avg_rating" real,
	"review_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gigs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"sequence_no" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"kind" "delivery_kind" NOT NULL,
	"file_tree" text[],
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_order_seq_unique" UNIQUE("order_id","sequence_no")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"attachment_name" text,
	"has_leakage" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"label" text NOT NULL,
	"actor" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_stars" (
	"user_id" text NOT NULL,
	"order_id" text NOT NULL,
	CONSTRAINT "order_stars_user_id_order_id_pk" PRIMARY KEY("user_id","order_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" serial NOT NULL,
	"gig_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"status" "order_status" DEFAULT 'PENDING_REQUIREMENTS' NOT NULL,
	"price_cents" integer NOT NULL,
	"fee_rate_bps" integer DEFAULT 2000 NOT NULL,
	"turnaround_hours" integer NOT NULL,
	"revisions_included" integer NOT NULL,
	"revisions_used" integer DEFAULT 0 NOT NULL,
	"requirements_prompt" text[] NOT NULL,
	"requirements_answers" text[],
	"deadline" timestamp with time zone,
	"revision_deadline" timestamp with time zone,
	"auto_complete_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"disputed_at" timestamp with time zone,
	"mutual_cancel_requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"gig_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"rating" integer NOT NULL,
	"body" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "account_kind" NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_user_kind_unique" UNIQUE("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"txn_id" text NOT NULL,
	"account_id" text NOT NULL,
	"order_id" text,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_order_type_unique" UNIQUE("order_id","entry_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"order_email" boolean DEFAULT true NOT NULL,
	"inbox_email" boolean DEFAULT true NOT NULL,
	"promo_email" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"order_id" text,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_languages" ADD CONSTRAINT "seller_languages_profile_id_seller_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_skills" ADD CONSTRAINT "seller_skills_profile_id_seller_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorites" ADD CONSTRAINT "favorites_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gig_faqs" ADD CONSTRAINT "gig_faqs_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gig_images" ADD CONSTRAINT "gig_images_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gigs" ADD CONSTRAINT "gigs_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_stars" ADD CONSTRAINT "order_stars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_stars" ADD CONSTRAINT "order_stars_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gigs_category_idx" ON "gigs" USING btree ("category","subcategory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gigs_status_idx" ON "gigs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gigs_price_idx" ON "gigs" USING btree ("price_cents");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliveries_order_idx" ON "deliveries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_order_time_idx" ON "messages" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_events_order_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_buyer_status_idx" ON "orders" USING btree ("buyer_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_seller_status_idx" ON "orders" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_auto_complete_idx" ON "orders" USING btree ("status","auto_complete_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_deadline_idx" ON "orders" USING btree ("status","deadline");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_gig_idx" ON "reviews" USING btree ("gig_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_accounts_user_idx" ON "ledger_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_txn_idx" ON "ledger_entries" USING btree ("txn_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");