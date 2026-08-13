CREATE TYPE "public"."moderation_category" AS ENUM('sexual', 'violence', 'hate', 'self_harm', 'illegal', 'personal_data');--> statement-breakpoint
CREATE TYPE "public"."report_result" AS ENUM('pending', 'no_action', 'takedown');--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"reporter_user_id" text NOT NULL,
	"category" "moderation_category" NOT NULL,
	"result" "report_result" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "reports_resolution_pair" CHECK (("reports"."result" = 'pending' and "reports"."resolved_at" is null) or ("reports"."result" <> 'pending' and "reports"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_image_count_positive";--> statement-breakpoint
ALTER TABLE "usage_events" ALTER COLUMN "image_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "takedown_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "takedown_reason" "moderation_category";--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_generation_reporter_idx" ON "reports" USING btree ("generation_id","reporter_user_id");--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_takedown_pair" CHECK (("generations"."takedown_at" is null and "generations"."takedown_reason" is null) or ("generations"."takedown_at" is not null and "generations"."takedown_reason" is not null));--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_image_count_nonnegative" CHECK ("usage_events"."image_count" >= 0);--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_work_positive" CHECK ("usage_events"."image_count" > 0 or "usage_events"."provider_units" > 0);
--> statement-breakpoint
-- Provider units move from tenths to hundredths of a neuron. Existing rows are
-- scaled in place so their real provider spend does not change meaning.
UPDATE "usage_events" SET "provider_units" = "provider_units" * 10;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reserve_generation_quota"(
	"p_user_id" text,
	"p_model" text,
	"p_image_count" integer,
	"p_provider_units" integer
)
RETURNS TABLE(
	"outcome" text,
	"owner_window_used" integer,
	"owner_window_remaining" integer,
	"reset_at" timestamp with time zone
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
	"v_now" timestamp with time zone := now();
	"v_day_start" timestamp with time zone;
	"v_owner_used" integer;
	"v_provider_used" integer;
	"v_units_needed" integer;
	"v_reset_at" timestamp with time zone;
BEGIN
	IF "p_user_id" IS NULL OR btrim("p_user_id") = ''
		OR "p_model" IS NULL OR btrim("p_model") = ''
		OR "p_image_count" IS NULL OR "p_image_count" < 0
		OR "p_provider_units" IS NULL OR "p_provider_units" < 0
		OR ("p_image_count" = 0 AND "p_provider_units" = 0) THEN
		RAISE EXCEPTION 'Invalid quota reservation input.';
	END IF;

	"v_day_start" := date_trunc('day', "v_now" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
	PERFORM pg_advisory_xact_lock(hashtextextended('ether:generation-quota:v1', 0));

	SELECT coalesce(sum("image_count"), 0)::integer
	INTO "v_owner_used"
	FROM "usage_events"
	WHERE "user_id" = "p_user_id"
		AND "created_at" > "v_now" - interval '1 hour';

	IF "p_image_count" > 0 AND "v_owner_used" + "p_image_count" > 20 THEN
		"v_units_needed" := "v_owner_used" + "p_image_count" - 20;
		SELECT "candidate"."reset_at" INTO "v_reset_at"
		FROM (
			SELECT "created_at" + interval '1 hour' AS "reset_at",
				sum("image_count") OVER (ORDER BY "created_at", "id" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "expired_units"
			FROM "usage_events"
			WHERE "user_id" = "p_user_id"
				AND "created_at" > "v_now" - interval '1 hour'
				AND "image_count" > 0
		) AS "candidate"
		WHERE "candidate"."expired_units" >= "v_units_needed"
		ORDER BY "candidate"."reset_at"
		LIMIT 1;
		RETURN QUERY SELECT 'account_limit'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), "v_reset_at";
		RETURN;
	END IF;

	SELECT coalesce(sum("provider_units"), 0)::integer INTO "v_provider_used"
	FROM "usage_events" WHERE "created_at" >= "v_day_start";
	IF "v_provider_used" + "p_provider_units" > 1000000 THEN
		RETURN QUERY SELECT 'provider_capacity'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), "v_day_start" + interval '1 day';
		RETURN;
	END IF;

	INSERT INTO "usage_events" ("user_id", "model", "image_count", "provider_units")
	VALUES ("p_user_id", "p_model", "p_image_count", "p_provider_units");
	"v_owner_used" := "v_owner_used" + "p_image_count";
	SELECT min("created_at" + interval '1 hour') INTO "v_reset_at"
	FROM "usage_events"
	WHERE "user_id" = "p_user_id"
		AND "created_at" > "v_now" - interval '1 hour'
		AND "image_count" > 0;
	RETURN QUERY SELECT 'accepted'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), "v_reset_at";
END;
$$;
