import "server-only";

import { unstable_cache } from "next/cache";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "./index";
import { generations, type NewGeneration } from "./schema";

export async function listGenerationsForUser(userId: string, limit = 24) {
  return getDb()
    .select()
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt))
    .limit(limit);
}

export async function countGenerationsForUser(userId: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(generations)
    .where(eq(generations.userId, userId));

  return row?.value ?? 0;
}

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
    .where(eq(generations.isPublic, true))
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
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .limit(1);

  return generation;
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
