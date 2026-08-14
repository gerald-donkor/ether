CREATE TYPE "public"."billing_subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "public"."billing_webhook_status" AS ENUM('processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."credit_ledger_reason" AS ENUM('starter_grant', 'subscription_grant', 'top_up_grant', 'generation_reservation', 'generation_release', 'subscription_expiry', 'refund_reversal', 'dispute_reversal');--> statement-breakpoint
CREATE TYPE "public"."credit_reservation_status" AS ENUM('reserved', 'settled', 'released');--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"stripe_subscription_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"status" "billing_subscription_status" NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"provider_event_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"stripe_event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" "billing_webhook_status" DEFAULT 'processing' NOT NULL,
	"user_id" text,
	"error_category" text,
	"event_created_at" timestamp with time zone NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" "credit_ledger_reason" NOT NULL,
	"grant_id" uuid,
	"reservation_id" uuid,
	"stripe_event_id" text,
	"stripe_object_id" text,
	"checkout_session_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_delta_nonzero" CHECK ("credit_ledger"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "credit_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"requested_credits" integer NOT NULL,
	"settled_credits" integer,
	"status" "credit_reservation_status" DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_reservations_requested_positive" CHECK ("credit_reservations"."requested_credits" > 0),
	CONSTRAINT "credit_reservations_settled_nonnegative" CHECK ("credit_reservations"."settled_credits" is null or "credit_reservations"."settled_credits" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_grant_id_credit_ledger_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."credit_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_reservation_id_credit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_stripe_customer_idx" ON "billing_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_user_idx" ON "billing_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_customer_idx" ON "billing_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_webhook_events_user_idx" ON "billing_webhook_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_grant_idx" ON "credit_ledger" USING btree ("grant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_purchase_object_idx" ON "credit_ledger" USING btree ("stripe_object_id") WHERE "credit_ledger"."reason" in ('starter_grant', 'subscription_grant', 'top_up_grant');--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_reservation_grant_reason_idx" ON "credit_ledger" USING btree ("reservation_id","grant_id","reason");--> statement-breakpoint
CREATE INDEX "credit_reservations_user_status_idx" ON "credit_reservations" USING btree ("user_id","status");