CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"model" text NOT NULL,
	"image_count" integer NOT NULL,
	"provider_units" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_image_count_positive" CHECK ("usage_events"."image_count" > 0),
	CONSTRAINT "usage_events_provider_units_nonnegative" CHECK ("usage_events"."provider_units" >= 0)
);
--> statement-breakpoint
CREATE INDEX "usage_events_user_created_at_idx" ON "usage_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
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
		OR "p_image_count" IS NULL OR "p_image_count" <= 0
		OR "p_provider_units" IS NULL OR "p_provider_units" < 0 THEN
		RAISE EXCEPTION 'Invalid quota reservation input.';
	END IF;

	"v_day_start" := date_trunc('day', "v_now" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

	-- One short global critical section serializes every check-and-insert across
	-- application instances. The transaction-level lock is released by the
	-- statement transaction, including when the function raises.
	PERFORM pg_advisory_xact_lock(hashtextextended('ether:generation-quota:v1', 0));

	SELECT coalesce(sum("image_count"), 0)::integer
	INTO "v_owner_used"
	FROM "usage_events"
	WHERE "user_id" = "p_user_id"
		AND "created_at" > "v_now" - interval '1 hour';

	IF "v_owner_used" + "p_image_count" > 20 THEN
		"v_units_needed" := "v_owner_used" + "p_image_count" - 20;

		SELECT "candidate"."reset_at"
		INTO "v_reset_at"
		FROM (
			SELECT
				"created_at" + interval '1 hour' AS "reset_at",
				sum("image_count") OVER (
					ORDER BY "created_at", "id"
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				) AS "expired_units"
			FROM "usage_events"
			WHERE "user_id" = "p_user_id"
				AND "created_at" > "v_now" - interval '1 hour'
		) AS "candidate"
		WHERE "candidate"."expired_units" >= "v_units_needed"
		ORDER BY "candidate"."reset_at"
		LIMIT 1;

		RETURN QUERY SELECT
			'account_limit'::text,
			"v_owner_used",
			greatest(0, 20 - "v_owner_used"),
			"v_reset_at";
		RETURN;
	END IF;

	SELECT coalesce(sum("provider_units"), 0)::integer
	INTO "v_provider_used"
	FROM "usage_events"
	WHERE "created_at" >= "v_day_start";

	IF "p_provider_units" > 0
		AND "v_provider_used" + "p_provider_units" > 100000 THEN
		RETURN QUERY SELECT
			'provider_capacity'::text,
			"v_owner_used",
			greatest(0, 20 - "v_owner_used"),
			"v_day_start" + interval '1 day';
		RETURN;
	END IF;

	INSERT INTO "usage_events" (
		"user_id",
		"model",
		"image_count",
		"provider_units"
	) VALUES (
		"p_user_id",
		"p_model",
		"p_image_count",
		"p_provider_units"
	);

	"v_owner_used" := "v_owner_used" + "p_image_count";

	SELECT min("created_at" + interval '1 hour')
	INTO "v_reset_at"
	FROM "usage_events"
	WHERE "user_id" = "p_user_id"
		AND "created_at" > "v_now" - interval '1 hour';

	RETURN QUERY SELECT
		'accepted'::text,
		"v_owner_used",
		greatest(0, 20 - "v_owner_used"),
		"v_reset_at";
END;
$$;
