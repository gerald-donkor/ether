import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "./index";

const ACCOUNT_HOURLY_IMAGE_LIMIT = 20;
const PROVIDER_DAILY_UNITS_LIMIT = 1_000_000;

type ReservationRow = {
  outcome: unknown;
  owner_window_used: unknown;
  owner_window_remaining: unknown;
  reset_at: unknown;
};

type OwnerUsageRow = {
  rolling_used: unknown;
  rolling_remaining: unknown;
  rolling_reset_at: unknown;
  daily_accepted_images: unknown;
  daily_provider_units: unknown;
};

type AvailableReservation = {
  status: "accepted" | "account_limit" | "provider_capacity";
  ownerWindowUsed: number;
  ownerWindowRemaining: number;
  resetAt: Date | null;
};

export type QuotaReservation =
  | AvailableReservation
  | { status: "unavailable" };

export type OwnerUsageSummary =
  | {
      available: true;
      rollingUsed: number;
      rollingRemaining: number;
      rollingResetAt: Date | null;
      dailyAcceptedImages: number;
      dailyProviderUnits: number;
    }
  | { available: false };

function asNonnegativeInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function asDate(value: unknown) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "Unknown database error";
}

export function parseQuotaReservationRow(
  row: ReservationRow | undefined,
): QuotaReservation {
  if (!row) return { status: "unavailable" };

  const status = row.outcome;
  const ownerWindowUsed = asNonnegativeInteger(row.owner_window_used);
  const ownerWindowRemaining = asNonnegativeInteger(
    row.owner_window_remaining,
  );
  const resetAt = asDate(row.reset_at);

  if (
    (status !== "accepted" &&
      status !== "account_limit" &&
      status !== "provider_capacity") ||
    ownerWindowUsed === null ||
    ownerWindowRemaining === null ||
    resetAt === undefined
  ) {
    return { status: "unavailable" };
  }

  return { status, ownerWindowUsed, ownerWindowRemaining, resetAt };
}

/**
 * The PostgreSQL function owns the lock, both quota reads, the decision, and
 * the insert. One HTTP statement is therefore enough to keep the complete
 * reservation inside one database transaction.
 */
export async function reserveGenerationQuota({
  userId,
  model,
  imageCount,
  providerUnits,
}: {
  userId: string;
  model: string;
  imageCount: number;
  providerUnits: number;
}): Promise<QuotaReservation> {
  try {
    const result = await getDb().execute<ReservationRow>(sql`
      select *
      from reserve_generation_quota(
        ${userId}::text,
        ${model}::text,
        ${imageCount}::integer,
        ${providerUnits}::integer
      )
    `);
    const row = result.rows[0];
    if (!row || result.rows.length !== 1) return { status: "unavailable" };
    return parseQuotaReservationRow(row);
  } catch (error) {
    console.error("Generation quota reservation failed.", errorName(error));
    return { status: "unavailable" };
  }
}

/** Owner-only read. It neither takes the global lock nor reveals global use. */
export async function readOwnerUsageSummary(
  userId: string,
): Promise<OwnerUsageSummary> {
  try {
    const result = await getDb().execute<OwnerUsageRow>(sql`
      with bounds as (
        select
          now() as current_time,
          date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
            as day_start
      ),
      rolling as (
        select
          coalesce(sum(image_count), 0)::integer as used,
          min(created_at + interval '1 hour') as reset_at
        from usage_events, bounds
        where user_id = ${userId}
          and created_at > bounds.current_time - interval '1 hour'
      ),
      daily as (
        select
          coalesce(sum(image_count), 0)::integer as accepted_images,
          coalesce(sum(provider_units), 0)::integer as provider_units
        from usage_events, bounds
        where user_id = ${userId}
          and created_at >= bounds.day_start
      )
      select
        rolling.used as rolling_used,
        greatest(0, ${ACCOUNT_HOURLY_IMAGE_LIMIT} - rolling.used)::integer
          as rolling_remaining,
        rolling.reset_at as rolling_reset_at,
        daily.accepted_images as daily_accepted_images,
        daily.provider_units as daily_provider_units
      from rolling cross join daily
    `);
    const row = result.rows[0];
    if (!row || result.rows.length !== 1) return { available: false };

    const rollingUsed = asNonnegativeInteger(row.rolling_used);
    const rollingRemaining = asNonnegativeInteger(row.rolling_remaining);
    const rollingResetAt = asDate(row.rolling_reset_at);
    const dailyAcceptedImages = asNonnegativeInteger(
      row.daily_accepted_images,
    );
    const dailyProviderUnits = asNonnegativeInteger(row.daily_provider_units);

    if (
      rollingUsed === null ||
      rollingRemaining === null ||
      rollingResetAt === undefined ||
      dailyAcceptedImages === null ||
      dailyProviderUnits === null
    ) {
      return { available: false };
    }

    return {
      available: true,
      rollingUsed,
      rollingRemaining,
      rollingResetAt,
      dailyAcceptedImages,
      dailyProviderUnits,
    };
  } catch (error) {
    console.error("Account usage read failed.", errorName(error));
    return { available: false };
  }
}

/** Server-only configuration. The shared provider ceiling is not UI data. */
export const quotaConfiguration = {
  accountHourlyImageLimit: ACCOUNT_HOURLY_IMAGE_LIMIT,
  providerDailyUnitsLimit: PROVIDER_DAILY_UNITS_LIMIT,
} as const;
