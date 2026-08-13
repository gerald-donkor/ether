import "server-only";

import { unstable_cache } from "next/cache";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { getDb } from "./index";
import { generations, type NewGeneration } from "./schema";

/**
 * A removed row is invisible everywhere the owner reads their own work, so the
 * filter belongs in the query rather than in the component that renders it
 * (AGENTS.md 6.2). The one deliberate exception is
 * `countRecentGenerationsForUser`, which says why below.
 */
export async function listGenerationsForUser(userId: string, limit = 24) {
  return getDb()
    .select()
    .from(generations)
    .where(
      and(eq(generations.userId, userId), isNull(generations.deletedAt)),
    )
    .orderBy(desc(generations.createdAt))
    .limit(limit);
}

export async function countGenerationsForUser(userId: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(generations)
    .where(
      and(eq(generations.userId, userId), isNull(generations.deletedAt)),
    );

  return row?.value ?? 0;
}

/**
 * The hourly floor, and the one read that counts removed rows too. The
 * provider was already paid for a removed image, so excluding it would let a
 * user reset their own quota by pressing Remove. This counts spend, not
 * inventory.
 */
export async function countRecentGenerationsForUser(
  userId: string,
  since: Date,
) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        gte(generations.createdAt, since),
      ),
    );

  return row?.value ?? 0;
}

/**
 * The landing gallery's projection. It carries the four fields the strip
 * renders and nothing else: no owner id, no prompt, no model. Anonymous
 * visitors read this, so the column list is the privacy boundary.
 */
export type PublicGalleryImage = {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
};

export async function listPublicGenerations(
  limit: number,
): Promise<PublicGalleryImage[]> {
  return getDb()
    .select({
      id: generations.id,
      imageUrl: generations.imageUrl,
      width: generations.width,
      height: generations.height,
    })
    .from(generations)
    .where(
      and(eq(generations.isPublic, true), isNull(generations.deletedAt)),
    )
    .orderBy(desc(generations.createdAt))
    .limit(limit);
}

/**
 * The one tag the generation action expires after a successful public write.
 * Cache Components is off in this project, so the documented primitive for a
 * non-`fetch` read is `unstable_cache` with a tag. There is no polling
 * interval: the landing gallery only changes when someone publishes.
 */
export const PUBLIC_GALLERY_TAG = "public-gallery";

const readPublicGenerations = unstable_cache(
  async (limit: number) => listPublicGenerations(limit),
  ["public-gallery"],
  { tags: [PUBLIC_GALLERY_TAG] },
);

/**
 * The failure path is deliberately outside the cached function, so a database
 * outage is never what gets cached. The landing page falls back to its
 * artboard images rather than rendering an empty strip or throwing, and the
 * log line carries no row, prompt, or owner.
 */
export async function getPublicGalleryImages(
  limit: number,
): Promise<PublicGalleryImage[]> {
  try {
    return await readPublicGenerations(limit);
  } catch {
    console.error("The public gallery read failed.");
    return [];
  }
}

/**
 * One generation, for its owner. Both columns are filtered in the query, so a
 * valid id belonging to someone else returns nothing rather than returning a
 * row to a check that was forgotten (AGENTS.md 9 rule 1).
 */
export async function getGenerationForOwner(id: string, userId: string) {
  const [generation] = await getDb()
    .select()
    .from(generations)
    .where(
      and(
        eq(generations.id, id),
        eq(generations.userId, userId),
        isNull(generations.deletedAt),
      ),
    )
    .limit(1);

  return generation;
}

/**
 * The same two-column filter without the `deleted_at` condition, so a removed
 * row can still be destroyed for good from the library's Removed view. Only
 * the permanent-delete action reads through this.
 */
export async function getGenerationForOwnerIncludingRemoved(
  id: string,
  userId: string,
) {
  const [generation] = await getDb()
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .limit(1);

  return generation;
}

/**
 * `%` and `_` are wildcards to `ilike`, so a user searching for `100%` would
 * otherwise match every row they own. `\` escapes them, and escaping the
 * backslash first is what stops the escape character escaping itself.
 */
function escapeLikePattern(term: string) {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * One page of the library. It enters through
 * `generations_user_created_at_idx` exactly as the recent strip does, and the
 * `deleted_at` condition is a filter on rows that index has already narrowed
 * to one owner, so no new index is added here.
 *
 * `limit(pageSize + 1)` is how "is there another page" is answered without a
 * second count query. The extra row never reaches the caller.
 */
export async function listLibraryPage({
  userId,
  search,
  page,
  pageSize,
  removed,
}: {
  userId: string;
  search: string;
  page: number;
  pageSize: number;
  removed: boolean;
}) {
  const conditions = [
    eq(generations.userId, userId),
    removed
      ? isNotNull(generations.deletedAt)
      : isNull(generations.deletedAt),
  ];

  if (search) {
    conditions.push(
      ilike(generations.prompt, `%${escapeLikePattern(search)}%`),
    );
  }

  const rows = await getDb()
    .select()
    .from(generations)
    .where(and(...conditions))
    .orderBy(desc(generations.createdAt))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);

  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

/**
 * The undo layer. The owner is filtered inside the statement, so a wrong id
 * matches nothing rather than returning a row to a check that was forgotten
 * (AGENTS.md 9 rule 1). The `deleted_at is null` guard makes a double submit a
 * no-op instead of a second timestamp, and `is_public` comes back because it
 * is what tells the action whether the landing gallery has to be expired.
 */
export async function softDeleteGenerationForOwner(id: string, userId: string) {
  const [row] = await getDb()
    .update(generations)
    .set({ deletedAt: sql`now()` })
    .where(
      and(
        eq(generations.id, id),
        eq(generations.userId, userId),
        isNull(generations.deletedAt),
      ),
    )
    .returning({ id: generations.id, isPublic: generations.isPublic });

  return row;
}

/** The mirror of the above, guarded so restoring a live row is a no-op. */
export async function restoreGenerationForOwner(id: string, userId: string) {
  const [row] = await getDb()
    .update(generations)
    .set({ deletedAt: null })
    .where(
      and(
        eq(generations.id, id),
        eq(generations.userId, userId),
        isNotNull(generations.deletedAt),
      ),
    )
    .returning({ id: generations.id, isPublic: generations.isPublic });

  return row;
}

/**
 * Permanent deletion of one row, filtered on the owner again rather than
 * trusting the read that authorised it. The returned id is what distinguishes
 * a delete that matched from one that matched nothing.
 */
export async function deleteGenerationForOwner(id: string, userId: string) {
  const [deleted] = await getDb()
    .delete(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .returning({ id: generations.id });

  return deleted;
}

export async function createGeneration(input: NewGeneration) {
  const [generation] = await getDb()
    .insert(generations)
    .values(input)
    .returning();

  if (!generation) {
    throw new Error("The generation record was not created.");
  }

  return generation;
}
