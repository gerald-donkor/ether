CREATE TABLE "billing_refunds" (
	"stripe_refund_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"refund_amount" integer NOT NULL,
	"charged_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "billing_refunds_payment_intent_idx" ON "billing_refunds" USING btree ("stripe_payment_intent_id");