import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  billingCustomers,
  billingHolds,
  billingSubscriptions,
  billingWebhookEvents,
  creditLedger,
  creditReservations,
  generations,
  reports,
  usageEvents,
  userPreferences,
  type UserPreferences,
} from "./schema";

/**
 * One owner's stored generation defaults, or `undefined` when they have never
 * saved any. The owner is the primary key, so there is nothing to filter beyond
 * it and a wrong id returns nothing rather than someone else's row.
 */
export async function getPreferencesForOwner(
  userId: string,
): Promise<UserPreferences | undefined> {
  const [row] = await getDb()
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return row;
}

/**
 * The upsert. `onConflictDoUpdate` on the primary key is what makes saving
 * twice one row rather than an error, and `updated_at` is stamped in the
 * statement rather than by the caller so the two can never disagree.
 */
export async function savePreferencesForOwner(
  userId: string,
  input: {
    model: string;
    size: string;
    count: number;
    visibility: "private" | "public";
  },
) {
  const [row] = await getDb()
    .insert(userPreferences)
    .values({
      userId,
      defaultModel: input.model,
      defaultSize: input.size,
      defaultCount: input.count,
      defaultVisibility: input.visibility,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        defaultModel: input.model,
        defaultSize: input.size,
        defaultCount: input.count,
        defaultVisibility: input.visibility,
        updatedAt: sql`now()`,
      },
    })
    .returning({ userId: userPreferences.userId });

  return row;
}

/**
 * Every Blob url this owner has, **including soft-deleted and taken-down
 * rows**. An account deletion removes the objects behind those rows too: the
 * soft delete is the owner's own undo layer, not a reason to keep bytes they
 * asked to have removed (AGENTS.md 8.3 rule 5).
 */
export async function listAllImageUrlsForOwner(userId: string) {
  const rows = await getDb()
    .select({ imageUrl: generations.imageUrl })
    .from(generations)
    .where(eq(generations.userId, userId));

  return rows.map((row) => row.imageUrl);
}

/**
 * Whether this owner has a live public row, which is the only thing that
 * decides whether deleting the account has to expire the landing gallery and
 * Community. It is read before the purge, because afterwards there is nothing
 * left to ask.
 */
export async function ownerHasPublicGeneration(userId: string) {
  const [row] = await getDb()
    .select({ id: generations.id })
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        eq(generations.visibility, "public"),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * The purge. Four statements, filtered on the owner in every one of them rather
 * than trusting the read that authorised the action (AGENTS.md 9 rule 1).
 *
 * `db.batch()` rather than `db.transaction()`: the neon-http driver throws
 * `No transactions support in neon-http driver` on the latter, while `batch`
 * sends the statements to Neon's HTTP endpoint as a single transaction. That is
 * the "one transaction where the driver allows it" this needs.
 *
 * `reports` rows filed **against** this owner's generations are removed by the
 * `on delete cascade` on `reports.generation_id`, so only reports this owner
 * filed against other people's images need their own statement.
 *
 * Deleting the usage events is correct rather than a quota hole: the Clerk user
 * is destroyed in the same operation and a new signup gets a new id, so keeping
 * them would protect nothing and would retain data the user asked to remove.
 */
export async function purgeOwnerData(userId: string) {
  const db = getDb();

  const [deletedLedger, deletedReservations, deletedSubscriptions, deletedHolds, deletedWebhooks, deletedCustomer, deletedGenerations, deletedUsage, deletedPreferences, deletedReports] =
    await db.batch([
      db.delete(creditLedger).where(eq(creditLedger.userId, userId)).returning({ id: creditLedger.id }),
      db.delete(creditReservations).where(eq(creditReservations.userId, userId)).returning({ id: creditReservations.id }),
      db.delete(billingSubscriptions).where(eq(billingSubscriptions.userId, userId)).returning({ id: billingSubscriptions.stripeSubscriptionId }),
      db.delete(billingHolds).where(eq(billingHolds.userId, userId)).returning({ id: billingHolds.stripeDisputeId }),
      db.delete(billingWebhookEvents).where(eq(billingWebhookEvents.userId, userId)).returning({ id: billingWebhookEvents.stripeEventId }),
      db.delete(billingCustomers).where(eq(billingCustomers.userId, userId)).returning({ id: billingCustomers.userId }),
      db
        .delete(generations)
        .where(eq(generations.userId, userId))
        .returning({ id: generations.id }),
      db
        .delete(usageEvents)
        .where(eq(usageEvents.userId, userId))
        .returning({ id: usageEvents.id }),
      db
        .delete(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .returning({ userId: userPreferences.userId }),
      db
        .delete(reports)
        .where(eq(reports.reporterUserId, userId))
        .returning({ id: reports.id }),
    ]);

  return {
    creditLedger: deletedLedger.length,
    creditReservations: deletedReservations.length,
    billingSubscriptions: deletedSubscriptions.length,
    billingHolds: deletedHolds.length,
    billingWebhookEvents: deletedWebhooks.length,
    billingCustomers: deletedCustomer.length,
    generations: deletedGenerations.length,
    usageEvents: deletedUsage.length,
    preferences: deletedPreferences.length,
    reports: deletedReports.length,
  };
}

export type AccountExportData = {
  generations: {
    id: string;
    prompt: string;
    imageUrl: string;
    model: string;
    width: number;
    height: number;
    visibility: string;
    createdAt: Date;
    deletedAt: Date | null;
    takedownAt: Date | null;
    takedownReason: string | null;
  }[];
  usageEvents: {
    id: string;
    model: string;
    imageCount: number;
    providerUnits: number;
    createdAt: Date;
  }[];
  preferences: UserPreferences | null;
  reportsFiled: { category: string; createdAt: Date }[];
  billing: {
    customer: { stripeCustomerId: string; createdAt: Date; updatedAt: Date } | null;
    subscriptions: (typeof billingSubscriptions.$inferSelect)[];
    reservations: (typeof creditReservations.$inferSelect)[];
    ledger: (typeof creditLedger.$inferSelect)[];
  };
};

/**
 * Everything Ether stores about one owner, for the export.
 *
 * Every read filters on the owner inside the query. The generation list is
 * deliberately unfiltered on `deleted_at` and `takedown_at`: a removed row is
 * still the user's own data and belongs in their copy of it.
 *
 * The reports projection is the privacy boundary in the other direction. It
 * carries only what this owner submitted, by category and date. Reports filed
 * *against* their images are somebody else's data and never cross, and no
 * reporter id appears anywhere in the payload.
 */
export async function readAccountExport(
  userId: string,
): Promise<AccountExportData> {
  const db = getDb();

  const [generationRows, usageRows, preferenceRows, reportRows, customerRows, subscriptionRows, reservationRows, ledgerRows] =
    await db.batch([
      db
        .select({
          id: generations.id,
          prompt: generations.prompt,
          imageUrl: generations.imageUrl,
          model: generations.model,
          width: generations.width,
          height: generations.height,
          visibility: generations.visibility,
          createdAt: generations.createdAt,
          deletedAt: generations.deletedAt,
          takedownAt: generations.takedownAt,
          takedownReason: generations.takedownReason,
        })
        .from(generations)
        .where(eq(generations.userId, userId))
        .orderBy(desc(generations.createdAt)),
      db
        .select({
          id: usageEvents.id,
          model: usageEvents.model,
          imageCount: usageEvents.imageCount,
          providerUnits: usageEvents.providerUnits,
          createdAt: usageEvents.createdAt,
        })
        .from(usageEvents)
        .where(eq(usageEvents.userId, userId))
        .orderBy(desc(usageEvents.createdAt)),
      db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1),
      db
        .select({
          category: reports.category,
          createdAt: reports.createdAt,
        })
        .from(reports)
        .where(eq(reports.reporterUserId, userId))
        .orderBy(asc(reports.createdAt)),
      db.select({ stripeCustomerId: billingCustomers.stripeCustomerId, createdAt: billingCustomers.createdAt, updatedAt: billingCustomers.updatedAt }).from(billingCustomers).where(eq(billingCustomers.userId, userId)).limit(1),
      db.select().from(billingSubscriptions).where(eq(billingSubscriptions.userId, userId)).orderBy(desc(billingSubscriptions.createdAt)),
      db.select().from(creditReservations).where(eq(creditReservations.userId, userId)).orderBy(desc(creditReservations.createdAt)),
      db.select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt)),
    ]);

  return {
    generations: generationRows,
    usageEvents: usageRows,
    preferences: preferenceRows[0] ?? null,
    reportsFiled: reportRows,
    billing: { customer: customerRows[0] ?? null, subscriptions: subscriptionRows, reservations: reservationRows, ledger: ledgerRows },
  };
}
