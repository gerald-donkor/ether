-- A dispute hold is not an empty balance. Before this migration the hold
-- branch returned 'insufficient_credits' with credits_remaining = 0, which made
-- the generate action tell an owner they had no credits while /account showed
-- their real, positive balance. The outcome is now its own value and reports
-- the real balance. Nothing else in the function changes.
CREATE OR REPLACE FUNCTION "reserve_generation_capacity"(
	"p_user_id" text, "p_operation_id" uuid, "p_model" text, "p_image_count" integer,
	"p_provider_units" integer, "p_credit_cost" integer
) RETURNS TABLE("outcome" text, "owner_window_used" integer, "owner_window_remaining" integer,
	"reset_at" timestamptz, "credits_remaining" integer)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
	"v_now" timestamptz := now(); "v_day_start" timestamptz; "v_owner_used" integer;
	"v_provider_used" integer; "v_units_needed" integer; "v_reset_at" timestamptz;
	"v_needed" integer; "v_balance" integer; "v_take" integer; "v_grant" record;
BEGIN
	IF "p_user_id" IS NULL OR btrim("p_user_id") = '' OR "p_operation_id" IS NULL
		OR "p_model" IS NULL OR btrim("p_model") = '' OR "p_image_count" IS NULL OR "p_image_count" <= 0
		OR "p_provider_units" IS NULL OR "p_provider_units" < 0 OR "p_credit_cost" IS NULL OR "p_credit_cost" <= 0
	THEN RAISE EXCEPTION 'Invalid capacity reservation input.'; END IF;

	PERFORM pg_advisory_xact_lock(hashtextextended('ether:generation-quota:v1', 0));
	PERFORM reconcile_credit_balance("p_user_id");
	"v_day_start" := date_trunc('day', "v_now" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
	SELECT coalesce(sum(image_count), 0)::integer INTO "v_owner_used" FROM usage_events
	WHERE user_id = "p_user_id" AND created_at > "v_now" - interval '1 hour';
	SELECT read_credit_balance("p_user_id") INTO "v_balance";

	IF EXISTS (SELECT 1 FROM billing_holds WHERE user_id = "p_user_id" AND active) THEN
		RETURN QUERY SELECT 'billing_hold'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), null::timestamptz, "v_balance"; RETURN;
	END IF;
	IF EXISTS (SELECT 1 FROM credit_reservations WHERE id = "p_operation_id" AND user_id = "p_user_id") THEN
		RETURN QUERY SELECT 'accepted'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), null::timestamptz, "v_balance"; RETURN;
	END IF;
	IF "v_owner_used" + "p_image_count" > 20 THEN
		"v_units_needed" := "v_owner_used" + "p_image_count" - 20;
		SELECT candidate.reset_at INTO "v_reset_at" FROM (
			SELECT created_at + interval '1 hour' AS reset_at,
			sum(image_count) OVER (ORDER BY created_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS expired_units
			FROM usage_events WHERE user_id = "p_user_id" AND created_at > "v_now" - interval '1 hour' AND image_count > 0
		) candidate WHERE candidate.expired_units >= "v_units_needed" ORDER BY candidate.reset_at LIMIT 1;
		RETURN QUERY SELECT 'account_limit'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), "v_reset_at", "v_balance"; RETURN;
	END IF;
	SELECT coalesce(sum(provider_units), 0)::integer INTO "v_provider_used" FROM usage_events WHERE created_at >= "v_day_start";
	IF "v_provider_used" + "p_provider_units" > 1000000 THEN
		RETURN QUERY SELECT 'provider_capacity'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), "v_day_start" + interval '1 day', "v_balance"; RETURN;
	END IF;
	"v_needed" := "p_image_count" * "p_credit_cost";
	IF "v_balance" < "v_needed" THEN
		RETURN QUERY SELECT 'insufficient_credits'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), null::timestamptz, "v_balance"; RETURN;
	END IF;

	INSERT INTO credit_reservations(id, user_id, requested_credits, expires_at)
	VALUES ("p_operation_id", "p_user_id", "v_needed", "v_now" + interval '15 minutes');
	FOR "v_grant" IN
		SELECT g.id, (g.delta + coalesce(sum(c.delta), 0))::integer AS available
		FROM credit_ledger g LEFT JOIN credit_ledger c ON c.grant_id = g.id
		WHERE g.user_id = "p_user_id" AND g.delta > 0 AND (g.expires_at IS NULL OR g.expires_at > "v_now")
		GROUP BY g.id, g.expires_at, g.created_at HAVING g.delta + coalesce(sum(c.delta), 0) > 0
		ORDER BY g.expires_at ASC NULLS LAST, g.created_at, g.id
	LOOP
		EXIT WHEN "v_needed" = 0; "v_take" := least("v_needed", "v_grant".available);
		INSERT INTO credit_ledger(user_id, delta, reason, grant_id, reservation_id)
		VALUES ("p_user_id", -"v_take", 'generation_reservation', "v_grant".id, "p_operation_id");
		"v_needed" := "v_needed" - "v_take";
	END LOOP;
	IF "v_needed" <> 0 THEN RAISE EXCEPTION 'Credit allocation invariant failed.'; END IF;
	INSERT INTO usage_events(user_id, model, image_count, provider_units)
	VALUES ("p_user_id", "p_model", "p_image_count", "p_provider_units");
	"v_owner_used" := "v_owner_used" + "p_image_count"; "v_balance" := "v_balance" - ("p_image_count" * "p_credit_cost");
	SELECT min(created_at + interval '1 hour') INTO "v_reset_at" FROM usage_events
	WHERE user_id = "p_user_id" AND created_at > "v_now" - interval '1 hour' AND image_count > 0;
	RETURN QUERY SELECT 'accepted'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), "v_reset_at", "v_balance";
END; $$;
