import test from "node:test";
import assert from "node:assert/strict";
import { count, eq } from "drizzle-orm";
import { readCreditBalance } from "../lib/db/billing";
import { getDb } from "../lib/db/index";
import {
  listAllImageUrlsForOwner,
  ownerHasPublicGeneration,
  purgeOwnerData,
  readAccountExport,
  savePreferencesForOwner,
} from "../lib/db/account";
import { claimReport, completeReportWithTakedown } from "../lib/db/moderation";
import {
  countGenerationsForUser,
  createGeneration,
  deleteGenerationForOwner,
  getGenerationForOwner,
  getGenerationForOwnerIncludingRemoved,
  getShareableGeneration,
  listCommunityGenerations,
  listGenerationsForUser,
  listLibraryPage,
  listPublicGenerations,
  restoreGenerationForOwner,
  setGenerationVisibilityForOwner,
  softDeleteGenerationForOwner,
} from "../lib/db/queries";
import { readOwnerUsageSummary } from "../lib/db/quotas";
import {
  creditLedger,
  generations,
  reports,
  usageEvents,
  userPreferences,
} from "../lib/db/schema";

/**
 * AGENTS.md §8.3 rule 4 — "two accounts must not see each other's generations,
 * and that is verified against the database, not by clicking around" — as a
 * committed suite. Every assertion drives a real function from `lib/db/`, so
 * what is proved is the query text the application actually runs.
 *
 * **Nothing here prints.** Not an owner id, not a prompt, not a row id, not a
 * url. Every assertion is on a boolean, a count, or a list of property names,
 * and its message names the property that failed rather than its value. That is
 * `docs/automation.md` §"Exercise an owner boundary without logging user data"
 * step 5 applied to a file that lives in the repository.
 *
 * The two owner ids are synthetic and carry a fresh `crypto.randomUUID()` per
 * test, so no Clerk identity can hold one and no production row is in range of
 * any `where` below.
 *
 * `getPublicGalleryImages` and `getCommunityGenerations` are deliberately not
 * called. They wrap the two uncached functions in `unstable_cache`, which is a
 * Next.js request-scoped primitive with no meaning inside `node:test`; the
 * uncached functions underneath them are what carry the visibility filter and
 * they are what this file exercises.
 */

const IMAGE_URL_PREFIX = "https://test.public.blob.vercel-storage.com/generations/";

/** A url that deliberately embeds no owner id, so an export can be searched. */
function syntheticImageUrl() {
  return `${IMAGE_URL_PREFIX}${crypto.randomUUID()}.png`;
}

function syntheticRow(userId: string, visibility: "private" | "unlisted" | "public", prompt: string) {
  return {
    userId,
    prompt,
    imageUrl: syntheticImageUrl(),
    model: "synthetic",
    width: 1,
    height: 1,
    visibility,
  };
}

/**
 * Cleanup, and the aggregate proof that it worked. Reports this owner filed go
 * first: the ones filed *against* their generations leave with the rows, on the
 * `on delete cascade` that `reports.generation_id` carries.
 *
 * A failed cleanup fails the test, which is the point of asserting the zero.
 */
async function removeSyntheticOwners(owners: string[]) {
  const db = getDb();

  for (const owner of owners) {
    await db.delete(reports).where(eq(reports.reporterUserId, owner));
    await db.delete(generations).where(eq(generations.userId, owner));
    await db.delete(usageEvents).where(eq(usageEvents.userId, owner));
    await db.delete(userPreferences).where(eq(userPreferences.userId, owner));
    await db.delete(creditLedger).where(eq(creditLedger.userId, owner));
  }

  let remaining = 0;
  for (const owner of owners) {
    const [generationRows] = await db.select({ value: count() }).from(generations).where(eq(generations.userId, owner));
    const [usageRows] = await db.select({ value: count() }).from(usageEvents).where(eq(usageEvents.userId, owner));
    const [reportRows] = await db.select({ value: count() }).from(reports).where(eq(reports.reporterUserId, owner));
    const [preferenceRows] = await db.select({ value: count() }).from(userPreferences).where(eq(userPreferences.userId, owner));
    const [ledgerRows] = await db.select({ value: count() }).from(creditLedger).where(eq(creditLedger.userId, owner));
    remaining +=
      (generationRows?.value ?? 0) +
      (usageRows?.value ?? 0) +
      (reportRows?.value ?? 0) +
      (preferenceRows?.value ?? 0) +
      (ledgerRows?.value ?? 0);
  }

  assert.equal(remaining, 0, "synthetic rows remained after cleanup");
}

test("an owner's reads never return another owner's row", async () => {
  const suffix = crypto.randomUUID();
  const ownerA = `owner-a-${suffix}`;
  const ownerB = `owner-b-${suffix}`;
  const term = `token${suffix.replace(/-/g, "")}`;

  try {
    const row = await createGeneration(syntheticRow(ownerA, "private", `synthetic ${term}`));

    assert.equal(
      (await listGenerationsForUser(ownerB)).some((candidate) => candidate.id === row.id),
      false,
      "the recent list returned a row belonging to another owner",
    );
    assert.equal(await countGenerationsForUser(ownerB), 0, "the recent count included another owner's row");
    assert.equal(await countGenerationsForUser(ownerA), 1, "the owner's own count was wrong");

    assert.equal(
      (await getGenerationForOwner(row.id, ownerB)) === undefined,
      true,
      "the permalink read returned a row to the wrong owner",
    );
    assert.equal(
      (await getGenerationForOwner(row.id, ownerA))?.id === row.id,
      true,
      "the permalink read did not return the owner their own row",
    );

    for (const removed of [false, true]) {
      const page = await listLibraryPage({ userId: ownerB, search: "", page: 1, pageSize: 20, removed });
      assert.equal(
        page.rows.some((candidate) => candidate.id === row.id),
        false,
        removed
          ? "the library's removed view returned another owner's row"
          : "the library's live view returned another owner's row",
      );
    }

    // A search term drawn from the other owner's prompt is the sharpest form of
    // the question: the filter must be the owner column, not the term.
    const searched = await listLibraryPage({ userId: ownerB, search: term, page: 1, pageSize: 20, removed: false });
    assert.equal(searched.rows.length, 0, "a prompt search crossed the owner boundary");
    const ownSearch = await listLibraryPage({ userId: ownerA, search: term, page: 1, pageSize: 20, removed: false });
    assert.equal(ownSearch.rows.length, 1, "a prompt search did not find the owner's own row");

    const exported = await readAccountExport(ownerB);
    assert.equal(exported.generations.length, 0, "the export carried another owner's generations");
    assert.equal(exported.usageEvents.length, 0, "the export carried another owner's usage events");
    assert.equal(exported.billing.ledger.length, 0, "the export carried another owner's ledger rows");
    assert.equal(exported.reportsFiled.length, 0, "the export carried another owner's reports");
    assert.equal(exported.preferences, null, "the export carried another owner's preferences");

    assert.equal((await listAllImageUrlsForOwner(ownerB)).length, 0, "the deletion url list crossed the owner boundary");
    assert.equal((await listAllImageUrlsForOwner(ownerA)).length, 1, "the deletion url list missed the owner's own row");
  } finally {
    await removeSyntheticOwners([ownerA, ownerB]);
  }
});

test("an owner's mutations match nothing when the wrong owner runs them", async () => {
  const suffix = crypto.randomUUID();
  const ownerA = `owner-a-${suffix}`;
  const ownerB = `owner-b-${suffix}`;

  // Every wrong-owner attempt is followed by a re-read as the owner, because a
  // statement that returns nothing and a statement that changed nothing are
  // different claims and only the second one is the boundary.
  let rowId = "";
  const readAsOwner = async () => getGenerationForOwnerIncludingRemoved(rowId, ownerA);

  try {
    rowId = (await createGeneration(syntheticRow(ownerA, "private", "synthetic"))).id;

    assert.equal(
      (await setGenerationVisibilityForOwner(rowId, ownerB, "public")) === undefined,
      true,
      "the wrong owner published a row",
    );
    assert.equal((await readAsOwner())?.visibility, "private", "visibility changed under the wrong owner");

    assert.equal(
      (await softDeleteGenerationForOwner(rowId, ownerB)) === undefined,
      true,
      "the wrong owner soft-deleted a row",
    );
    assert.equal((await readAsOwner())?.deletedAt, null, "deleted_at was stamped by the wrong owner");

    assert.equal(
      (await softDeleteGenerationForOwner(rowId, ownerA))?.id === rowId,
      true,
      "the owner could not soft-delete their own row",
    );
    assert.equal(
      (await restoreGenerationForOwner(rowId, ownerB)) === undefined,
      true,
      "the wrong owner restored a removed row",
    );
    assert.equal(
      (await readAsOwner())?.deletedAt === null,
      false,
      "deleted_at was cleared by the wrong owner",
    );

    assert.equal(
      (await getGenerationForOwnerIncludingRemoved(rowId, ownerB)) === undefined,
      true,
      "the removed-row read returned a row to the wrong owner",
    );
    assert.equal(
      (await restoreGenerationForOwner(rowId, ownerA))?.id === rowId,
      true,
      "the owner could not restore their own row",
    );
    assert.equal((await readAsOwner())?.deletedAt, null, "the owner's own restore did not clear deleted_at");

    assert.equal(
      (await setGenerationVisibilityForOwner(rowId, ownerA, "public"))?.visibility,
      "public",
      "the owner could not publish their own row",
    );

    assert.equal(
      (await deleteGenerationForOwner(rowId, ownerB)) === undefined,
      true,
      "the wrong owner permanently deleted a row",
    );
    assert.equal((await readAsOwner()) === undefined, false, "the row was destroyed by the wrong owner");

    assert.equal(
      (await deleteGenerationForOwner(rowId, ownerA))?.id === rowId,
      true,
      "the owner could not delete their own row",
    );
    assert.equal((await readAsOwner()) === undefined, true, "the owner's own delete left the row behind");
  } finally {
    await removeSyntheticOwners([ownerA, ownerB]);
  }
});

test("the anonymous projections carry no owner, no prompt and only public work", async () => {
  const suffix = crypto.randomUUID();
  const ownerA = `owner-a-${suffix}`;
  const ownerB = `owner-b-${suffix}`;

  try {
    const privateRow = await createGeneration(syntheticRow(ownerA, "private", "synthetic"));
    const unlistedRow = await createGeneration(syntheticRow(ownerA, "unlisted", "synthetic"));
    const publicRow = await createGeneration(syntheticRow(ownerA, "public", "synthetic"));

    assert.equal(
      (await getShareableGeneration(privateRow.id)) === undefined,
      true,
      "a private row was shareable",
    );
    assert.equal((await getShareableGeneration(unlistedRow.id))?.id === unlistedRow.id, true, "an unlisted row was not shareable");

    const shareable = await getShareableGeneration(publicRow.id);
    assert.equal(shareable?.id === publicRow.id, true, "a public row was not shareable");
    // Asserted on the object's own keys rather than on two absences, so a column
    // added to this projection later fails here instead of leaking quietly.
    assert.deepEqual(
      Object.keys(shareable ?? {}).sort(),
      ["createdAt", "height", "id", "imageUrl", "model", "visibility", "width"],
      "the shareable projection's column list changed",
    );

    const community = await listCommunityGenerations(100);
    assert.equal(community.some((row) => row.id === publicRow.id), true, "a public row was missing from Community");
    assert.equal(community.some((row) => row.id === unlistedRow.id), false, "an unlisted row reached Community");
    assert.equal(community.some((row) => row.id === privateRow.id), false, "a private row reached Community");
    assert.deepEqual(
      Object.keys(community.find((row) => row.id === publicRow.id) ?? {}).sort(),
      ["createdAt", "height", "id", "imageUrl", "width"],
      "the Community projection's column list changed",
    );

    const strip = await listPublicGenerations(100);
    assert.equal(strip.some((row) => row.id === publicRow.id), true, "a public row was missing from the landing strip");
    assert.equal(strip.some((row) => row.id === unlistedRow.id), false, "an unlisted row reached the landing strip");
    assert.equal(strip.some((row) => row.id === privateRow.id), false, "a private row reached the landing strip");
    assert.deepEqual(
      Object.keys(strip.find((row) => row.id === publicRow.id) ?? {}).sort(),
      ["height", "id", "imageUrl", "width"],
      "the landing strip's column list changed",
    );

    // A soft-deleted public row leaves both anonymous surfaces. The taken-down
    // half of the same rule is asserted by the moderation test below, where the
    // takedown is written by the function that owns it.
    await softDeleteGenerationForOwner(publicRow.id, ownerA);
    assert.equal(
      (await listCommunityGenerations(100)).some((row) => row.id === publicRow.id),
      false,
      "a removed public row stayed in Community",
    );
    assert.equal(
      (await listPublicGenerations(100)).some((row) => row.id === publicRow.id),
      false,
      "a removed public row stayed in the landing strip",
    );
    assert.equal(
      (await getShareableGeneration(publicRow.id)) === undefined,
      true,
      "a removed public row was still shareable",
    );
  } finally {
    await removeSyntheticOwners([ownerA, ownerB]);
  }
});

test("a report crosses the owner boundary in exactly one direction", async () => {
  const suffix = crypto.randomUUID();
  const ownerA = `owner-a-${suffix}`;
  const ownerB = `owner-b-${suffix}`;

  try {
    const privateRow = await createGeneration(syntheticRow(ownerA, "private", "synthetic"));
    const publicRow = await createGeneration(syntheticRow(ownerA, "public", "synthetic"));

    assert.equal(
      (await claimReport({ generationId: privateRow.id, reporterUserId: ownerB, category: "hate" })).status,
      "not_found",
      "a private row was reportable by another owner",
    );
    // `user_id <> reporter_user_id` in the insert's select is what makes this
    // the boundary rather than a UI rule.
    assert.equal(
      (await claimReport({ generationId: publicRow.id, reporterUserId: ownerA, category: "hate" })).status,
      "not_found",
      "an owner reported their own row",
    );

    const claim = await claimReport({ generationId: publicRow.id, reporterUserId: ownerB, category: "hate" });
    assert.equal(claim.status, "claimed", "a shared row was not reportable by another owner");
    assert.equal(
      (await claimReport({ generationId: publicRow.id, reporterUserId: ownerB, category: "violence" })).status,
      "duplicate",
      "the same reporter filed twice against one row",
    );

    assert.equal(claim.status === "claimed", true, "the claim carried no report id");
    if (claim.status !== "claimed") return;
    assert.equal(
      await completeReportWithTakedown(claim.reportId, "hate"),
      publicRow.id,
      "the takedown did not stamp the reported row",
    );

    // A taken-down row leaves the owner's own reads as well as every anonymous
    // one: the owner keeps the record, not the visibility.
    assert.equal(
      (await getGenerationForOwner(publicRow.id, ownerA)) === undefined,
      true,
      "a taken-down row was still readable by its owner",
    );
    assert.equal(
      (await listGenerationsForUser(ownerA)).some((row) => row.id === publicRow.id),
      false,
      "a taken-down row stayed in the owner's recent list",
    );
    assert.equal(
      (await listLibraryPage({ userId: ownerA, search: "", page: 1, pageSize: 20, removed: false })).rows.some((row) => row.id === publicRow.id),
      false,
      "a taken-down row stayed in the owner's library",
    );
    assert.equal(
      (await getShareableGeneration(publicRow.id)) === undefined,
      true,
      "a taken-down row was still shareable",
    );
    assert.equal(
      (await listCommunityGenerations(100)).some((row) => row.id === publicRow.id),
      false,
      "a taken-down row stayed in Community",
    );
    assert.equal(
      (await listPublicGenerations(100)).some((row) => row.id === publicRow.id),
      false,
      "a taken-down row stayed in the landing strip",
    );

    // The export is the boundary in the other direction: the reporter's copy
    // lists what they filed, and the reported owner's copy carries no report
    // and no reporter id anywhere in it.
    const reporterExport = await readAccountExport(ownerB);
    assert.equal(reporterExport.reportsFiled.length, 1, "the reporter's export lost the report they filed");
    assert.deepEqual(
      Object.keys(reporterExport.reportsFiled[0] ?? {}).sort(),
      ["category", "createdAt"],
      "the filed-report projection's column list changed",
    );

    const reportedExport = await readAccountExport(ownerA);
    assert.equal(reportedExport.reportsFiled.length, 0, "a report filed against an owner reached their export");
    assert.equal(
      JSON.stringify(reportedExport).includes(ownerB),
      false,
      "a reporter id appeared in the reported owner's export",
    );
    assert.equal(reportedExport.generations.length, 2, "the owner's export lost their own taken-down row");
  } finally {
    await removeSyntheticOwners([ownerA, ownerB]);
  }
});

test("a usage reading is one owner's and never the account beside it", async () => {
  const suffix = crypto.randomUUID();
  const ownerA = `owner-a-${suffix}`;
  const ownerB = `owner-b-${suffix}`;
  const db = getDb();

  // `reserveGenerationQuota` is deliberately not called. It takes the shared
  // provider-daily advisory lock and its accepted reservations count against a
  // real global allocation, so a test that drove it would spend capacity the
  // product needs. The usage rows are written straight through the schema
  // instead; the read under test is `readOwnerUsageSummary`, which is
  // owner-filtered and takes no lock.
  try {
    await db.insert(usageEvents).values([
      { userId: ownerA, model: "synthetic", imageCount: 3, providerUnits: 3 },
      { userId: ownerA, model: "synthetic", imageCount: 2, providerUnits: 2 },
    ]);

    const forA = await readOwnerUsageSummary(ownerA);
    assert.equal(forA.available, true, "the owner's usage summary was unavailable");
    assert.equal(forA.available === true ? forA.rollingUsed : null, 5, "the owner's rolling total was wrong");
    assert.equal(forA.available === true ? forA.dailyAcceptedImages : null, 5, "the owner's daily total was wrong");

    const forB = await readOwnerUsageSummary(ownerB);
    assert.equal(forB.available, true, "the second owner's usage summary was unavailable");
    assert.equal(forB.available === true ? forB.rollingUsed : null, 0, "another owner's usage counted against this one");
    assert.equal(forB.available === true ? forB.dailyAcceptedImages : null, 0, "another owner's images counted against this one");
    assert.equal(forB.available === true ? forB.dailyProviderUnits : null, 0, "another owner's provider units counted against this one");
    assert.equal(forB.available === true ? forB.rollingResetAt : "unset", null, "a reset time was reported for an owner with no usage");
  } finally {
    await removeSyntheticOwners([ownerA, ownerB]);
  }
});

test("deleting one account leaves the account beside it byte for byte identical", async () => {
  const suffix = crypto.randomUUID();
  const ownerA = `owner-a-${suffix}`;
  const ownerB = `owner-b-${suffix}`;
  const db = getDb();

  try {
    await createGeneration(syntheticRow(ownerA, "public", "synthetic"));
    await createGeneration(syntheticRow(ownerB, "private", "synthetic"));
    await db.insert(usageEvents).values([
      { userId: ownerA, model: "synthetic", imageCount: 1, providerUnits: 1 },
      { userId: ownerB, model: "synthetic", imageCount: 1, providerUnits: 1 },
    ]);
    await savePreferencesForOwner(ownerA, { model: "synthetic", size: "1024x1024", count: 1, visibility: "private" });
    await savePreferencesForOwner(ownerB, { model: "synthetic", size: "1024x1024", count: 1, visibility: "private" });

    // Read before the purge, because afterwards there is nothing left to ask.
    assert.equal(await ownerHasPublicGeneration(ownerA), true, "the public flag missed the owner's own public row");
    assert.equal(await ownerHasPublicGeneration(ownerB), false, "the public flag read another owner's public row");

    // The balance is read first on purpose. `read_credit_balance` reconciles
    // before it answers, and reconciling writes the starter grant for an owner
    // who has no ledger row yet. Reading it after the export snapshot would put
    // that row in the second snapshot only, and the test would blame the purge
    // for a row its own measurement wrote.
    const balanceBefore = await readCreditBalance(ownerB);
    const countBefore = await countGenerationsForUser(ownerB);
    const exportBefore = JSON.stringify(await readAccountExport(ownerB));

    const purged = await purgeOwnerData(ownerA);
    assert.equal(purged.generations, 1, "the purge removed the wrong number of generations");
    assert.equal(purged.usageEvents, 1, "the purge removed the wrong number of usage events");
    assert.equal(purged.preferences, 1, "the purge removed the wrong number of preference rows");

    assert.equal(await countGenerationsForUser(ownerA), 0, "the purged owner still has generations");
    assert.equal((await listAllImageUrlsForOwner(ownerA)).length, 0, "the purged owner still has image urls");
    const purgedExport = await readAccountExport(ownerA);
    assert.equal(purgedExport.generations.length, 0, "the purged owner's export still carries generations");
    assert.equal(purgedExport.usageEvents.length, 0, "the purged owner's export still carries usage events");
    assert.equal(purgedExport.preferences, null, "the purged owner's export still carries preferences");

    // Asserted by value rather than by eye, and compared as a string so a
    // failure names the property without printing the other owner's data.
    assert.equal(await countGenerationsForUser(ownerB), countBefore, "the purge changed another owner's generation count");
    assert.equal(JSON.stringify(await readAccountExport(ownerB)) === exportBefore, true, "the purge changed another owner's export");
    assert.equal(await readCreditBalance(ownerB), balanceBefore, "the purge changed another owner's credit balance");
  } finally {
    await removeSyntheticOwners([ownerA, ownerB]);
  }
});
