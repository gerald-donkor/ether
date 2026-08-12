import "server-only";

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
