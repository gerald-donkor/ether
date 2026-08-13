import test from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { IMAGE_MODERATION_MODEL_ID } from "../lib/ai/moderation";
import {
  claimReport,
  completeReportNoAction,
  completeReportWithTakedown,
} from "../lib/db/moderation";
import { getDb } from "../lib/db/index";
import {
  getShareableGeneration,
  listCommunityGenerations,
  listGenerationsForUser,
  listLibraryPage,
  listPublicGenerations,
  restoreGenerationForOwner,
  setGenerationVisibilityForOwner,
} from "../lib/db/queries";
import { reserveGenerationQuota } from "../lib/db/quotas";
import { generations, reports, usageEvents } from "../lib/db/schema";

test("duplicate reports, takedown filtering and moderation quota stay bounded", async () => {
  const suffix = crypto.randomUUID();
  const owner = `integration-owner-${suffix}`;
  const reporter = `integration-reporter-${suffix}`;
  const safeId = crypto.randomUUID();
  const unsafeId = crypto.randomUUID();
  const db = getDb();

  try {
    await db.insert(generations).values([
      { id: safeId, userId: owner, prompt: "synthetic", imageUrl: "https://test.public.blob.vercel-storage.com/generations/safe.png", model: "synthetic", width: 1, height: 1, visibility: "public" },
      { id: unsafeId, userId: owner, prompt: "synthetic", imageUrl: "https://test.public.blob.vercel-storage.com/generations/unsafe.png", model: "synthetic", width: 1, height: 1, visibility: "public" },
    ]);

    const first = await claimReport({ generationId: safeId, reporterUserId: reporter, category: "hate" });
    assert.equal(first.status, "claimed");
    const duplicate = await claimReport({ generationId: safeId, reporterUserId: reporter, category: "violence" });
    assert.equal(duplicate.status, "duplicate");
    if (first.status === "claimed") assert.equal(await completeReportNoAction(first.reportId), true);
    assert.equal((await listGenerationsForUser(owner)).some((row) => row.id === safeId), true);

    const unsafe = await claimReport({ generationId: unsafeId, reporterUserId: reporter, category: "violence" });
    assert.equal(unsafe.status, "claimed");
    if (unsafe.status === "claimed") {
      assert.equal(await completeReportWithTakedown(unsafe.reportId, "violence"), unsafeId);
      assert.equal(await completeReportWithTakedown(unsafe.reportId, "violence"), undefined);
    }
    assert.equal((await listGenerationsForUser(owner)).some((row) => row.id === unsafeId), false);
    assert.equal((await listCommunityGenerations(20)).some((row) => row.id === unsafeId), false);
    assert.equal((await listPublicGenerations(20)).some((row) => row.id === unsafeId), false);
    assert.equal(await getShareableGeneration(unsafeId), undefined);
    assert.equal(
      (await listLibraryPage({ userId: owner, search: "", page: 1, pageSize: 20, removed: false })).rows.some((row) => row.id === unsafeId),
      false,
    );
    assert.equal(await setGenerationVisibilityForOwner(unsafeId, owner, "public"), undefined);
    await db.update(generations).set({ deletedAt: new Date() }).where(eq(generations.id, unsafeId));
    assert.equal(await restoreGenerationForOwner(unsafeId, owner), undefined);

    const quotaUser = `integration-quota-${suffix}`;
    const reservations = await Promise.all(
      Array.from({ length: 2 }, () => reserveGenerationQuota({ userId: quotaUser, model: IMAGE_MODERATION_MODEL_ID, imageCount: 0, providerUnits: 600_000 })),
    );
    assert.equal(reservations.filter((row) => row.status === "accepted").length, 1);
    const [usage] = await db.select().from(usageEvents).where(eq(usageEvents.userId, quotaUser));
    assert.equal(usage?.imageCount, 0);
  } finally {
    await db.delete(reports).where(sql`${reports.reporterUserId} like ${`%${suffix}`}`);
    await db.delete(generations).where(eq(generations.userId, owner));
    await db.delete(usageEvents).where(sql`${usageEvents.userId} like ${`%${suffix}`}`);
    const remaining = await db.execute<{ count: number }>(sql`
      select count(*)::integer as count from generations where user_id = ${owner}
    `);
    assert.equal(Number(remaining.rows[0]?.count), 0);
  }
});
