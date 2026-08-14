CREATE TABLE "billing_holds" (
	"stripe_dispute_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "billing_holds_user_active_idx" ON "billing_holds" USING btree ("user_id","active");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reconcile_credit_balance"("p_user_id" text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE "v_row" record; "v_remaining" integer;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended('ether:credits:' || "p_user_id", 0));
	FOR "v_row" IN
		SELECT r.id FROM credit_reservations r
		WHERE r.user_id = "p_user_id" AND r.status = 'reserved' AND r.expires_at <= now()
	LOOP
		INSERT INTO credit_ledger(user_id, delta, reason, grant_id, reservation_id)
		SELECT "p_user_id", -sum(l.delta)::integer, 'generation_release', l.grant_id, "v_row".id
		FROM credit_ledger l WHERE l.reservation_id = "v_row".id GROUP BY l.grant_id
		HAVING sum(l.delta) < 0 ON CONFLICT DO NOTHING;
		UPDATE credit_reservations SET status = 'released', settled_credits = 0, updated_at = now()
		WHERE id = "v_row".id AND status = 'reserved';
	END LOOP;

	FOR "v_row" IN
		SELECT g.id, g.user_id, (g.delta + coalesce(sum(c.delta), 0))::integer AS remaining
		FROM credit_ledger g LEFT JOIN credit_ledger c ON c.grant_id = g.id
		WHERE g.user_id = "p_user_id" AND g.reason = 'subscription_grant' AND g.expires_at <= now()
		GROUP BY g.id HAVING g.delta + coalesce(sum(c.delta), 0) > 0
	LOOP
		INSERT INTO credit_ledger(user_id, delta, reason, grant_id)
		SELECT "p_user_id", -"v_row".remaining, 'subscription_expiry', "v_row".id
		WHERE NOT EXISTS (SELECT 1 FROM credit_ledger WHERE grant_id = "v_row".id AND reason = 'subscription_expiry');
	END LOOP;

	INSERT INTO credit_ledger(user_id, delta, reason, stripe_object_id)
	VALUES ("p_user_id", 10, 'starter_grant', 'starter:' || "p_user_id") ON CONFLICT DO NOTHING;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "read_credit_balance"("p_user_id" text)
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE "v_balance" integer;
BEGIN
	IF "p_user_id" IS NULL OR btrim("p_user_id") = '' THEN RAISE EXCEPTION 'Invalid owner.'; END IF;
	PERFORM reconcile_credit_balance("p_user_id");
	SELECT coalesce(sum(delta), 0)::integer INTO "v_balance" FROM credit_ledger WHERE user_id = "p_user_id";
	RETURN greatest(0, "v_balance");
END; $$;
--> statement-breakpoint
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
		RETURN QUERY SELECT 'insufficient_credits'::text, "v_owner_used", greatest(0, 20 - "v_owner_used"), null::timestamptz, 0; RETURN;
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "settle_generation_credits"("p_operation_id" uuid, "p_delivered" integer)
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE "v_res" credit_reservations%rowtype; "v_release" integer; "v_row" record; "v_amount" integer;
BEGIN
	SELECT * INTO "v_res" FROM credit_reservations WHERE id = "p_operation_id" FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found.'; END IF;
	IF "p_delivered" < 0 OR "p_delivered" > "v_res".requested_credits THEN RAISE EXCEPTION 'Invalid settlement.'; END IF;
	IF "v_res".status <> 'reserved' THEN RETURN coalesce("v_res".settled_credits, 0); END IF;
	"v_release" := "v_res".requested_credits - "p_delivered";
	FOR "v_row" IN SELECT grant_id, -sum(delta)::integer AS reserved FROM credit_ledger
		WHERE reservation_id = "p_operation_id" GROUP BY grant_id ORDER BY grant_id
	LOOP
		EXIT WHEN "v_release" = 0; "v_amount" := least("v_release", "v_row".reserved);
		INSERT INTO credit_ledger(user_id, delta, reason, grant_id, reservation_id)
		VALUES ("v_res".user_id, "v_amount", 'generation_release', "v_row".grant_id, "p_operation_id") ON CONFLICT DO NOTHING;
		"v_release" := "v_release" - "v_amount";
	END LOOP;
	UPDATE credit_reservations SET settled_credits = "p_delivered",
		status = CASE WHEN "p_delivered" = 0 THEN 'released'::credit_reservation_status ELSE 'settled'::credit_reservation_status END,
		updated_at = now() WHERE id = "p_operation_id";
	RETURN "p_delivered";
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "grant_purchase_credits"("p_user_id" text, "p_credits" integer,
	"p_reason" credit_ledger_reason, "p_event_id" text, "p_object_id" text,
	"p_session_id" text, "p_expires_at" timestamptz)
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE "v_grant" record;
BEGIN
	IF "p_credits" <= 0 OR "p_reason" NOT IN ('subscription_grant', 'top_up_grant') THEN RAISE EXCEPTION 'Invalid grant.'; END IF;
	PERFORM reconcile_credit_balance("p_user_id");
	IF "p_reason" = 'subscription_grant' THEN
		FOR "v_grant" IN SELECT g.id, (g.delta + coalesce(sum(c.delta),0))::integer remaining
			FROM credit_ledger g LEFT JOIN credit_ledger c ON c.grant_id = g.id
			WHERE g.user_id = "p_user_id" AND g.reason = 'subscription_grant' AND (g.expires_at IS NULL OR g.expires_at > now())
			GROUP BY g.id HAVING g.delta + coalesce(sum(c.delta),0) > 0
		LOOP INSERT INTO credit_ledger(user_id, delta, reason, grant_id) VALUES ("p_user_id", -"v_grant".remaining, 'subscription_expiry', "v_grant".id); END LOOP;
	END IF;
	INSERT INTO credit_ledger(user_id, delta, reason, stripe_event_id, stripe_object_id, checkout_session_id, expires_at)
	VALUES ("p_user_id", "p_credits", "p_reason", "p_event_id", "p_object_id", "p_session_id", "p_expires_at") ON CONFLICT DO NOTHING;
	RETURN read_credit_balance("p_user_id");
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reverse_purchase_credits"("p_object_id" text, "p_event_id" text,
	"p_reason" credit_ledger_reason, "p_maximum" integer)
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE "v_grant" credit_ledger%rowtype; "v_remaining" integer; "v_revoke" integer;
BEGIN
	IF "p_reason" NOT IN ('refund_reversal', 'dispute_reversal') OR "p_maximum" <= 0 THEN RAISE EXCEPTION 'Invalid reversal.'; END IF;
	SELECT * INTO "v_grant" FROM credit_ledger WHERE stripe_object_id = "p_object_id" AND reason IN ('subscription_grant','top_up_grant') FOR UPDATE;
	IF NOT FOUND THEN RETURN 0; END IF;
	PERFORM reconcile_credit_balance("v_grant".user_id);
	SELECT greatest(0, "v_grant".delta + coalesce(sum(delta),0))::integer INTO "v_remaining" FROM credit_ledger WHERE grant_id = "v_grant".id;
	"v_revoke" := least("v_remaining", "p_maximum");
	IF "v_revoke" > 0 AND NOT EXISTS (SELECT 1 FROM credit_ledger WHERE stripe_event_id = "p_event_id") THEN
		INSERT INTO credit_ledger(user_id, delta, reason, grant_id, stripe_event_id, stripe_object_id)
		VALUES ("v_grant".user_id, -"v_revoke", "p_reason", "v_grant".id, "p_event_id", "p_object_id");
	END IF;
	RETURN "v_revoke";
END; $$;
