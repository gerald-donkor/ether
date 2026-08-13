import "server-only";

import { sql } from "drizzle-orm";
import type { ModerationCategory } from "@/lib/ai/moderation";
import { getDb } from "./index";

type ClaimRow = { id: string; image_url: string };

export type ReportClaim =
  | { status: "claimed"; reportId: string; imageUrl: string }
  | { status: "duplicate" }
  | { status: "not_found" }
  | { status: "unavailable" };

export async function claimReport({
  generationId,
  reporterUserId,
  category,
}: {
  generationId: string;
  reporterUserId: string;
  category: ModerationCategory;
}): Promise<ReportClaim> {
  try {
    const result = await getDb().execute<ClaimRow>(sql`
      insert into reports (generation_id, reporter_user_id, category)
      select id, ${reporterUserId}, ${category}::moderation_category
      from generations
      where id = ${generationId}::uuid
        and user_id <> ${reporterUserId}
        and visibility in ('unlisted', 'public')
        and deleted_at is null
        and takedown_at is null
      on conflict (generation_id, reporter_user_id) do nothing
      returning id, (select image_url from generations where id = generation_id) as image_url
    `);
    const row = result.rows[0];
    if (row && result.rows.length === 1) {
      return { status: "claimed", reportId: row.id, imageUrl: row.image_url };
    }
    const duplicate = await getDb().execute<{ exists: boolean }>(sql`
      select exists(
        select 1 from reports
        where generation_id = ${generationId}::uuid
          and reporter_user_id = ${reporterUserId}
      ) as exists
    `);
    return duplicate.rows[0]?.exists
      ? { status: "duplicate" }
      : { status: "not_found" };
  } catch (error) {
    console.error(
      "Report claim failed.",
      error instanceof Error ? error.name : "Unknown database error",
    );
    return { status: "unavailable" };
  }
}

export async function completeReportNoAction(reportId: string) {
  const result = await getDb().execute<{ id: string }>(sql`
    update reports set result = 'no_action', resolved_at = now()
    where id = ${reportId}::uuid and result = 'pending'
    returning id
  `);
  return result.rows.length === 1;
}

export async function completeReportWithTakedown(
  reportId: string,
  reason: ModerationCategory,
) {
  const result = await getDb().execute<{ generation_id: string }>(sql`
    with resolved as (
      update reports set result = 'takedown', resolved_at = now()
      where id = ${reportId}::uuid and result = 'pending'
      returning generation_id
    ), stamped as (
      update generations
      set takedown_at = now(), takedown_reason = ${reason}::moderation_category
      where id in (select generation_id from resolved) and takedown_at is null
      returning id
    )
    select id as generation_id from stamped
  `);
  return result.rows[0]?.generation_id;
}
