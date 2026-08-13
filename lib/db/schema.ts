import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { GENERATION_VISIBILITIES } from "@/lib/generations/visibility";

export const generationVisibility = pgEnum(
  "generation_visibility",
  GENERATION_VISIBILITIES,
);

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    prompt: text("prompt").notNull(),
    imageUrl: text("image_url").notNull(),
    model: text("model").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    visibility: generationVisibility("visibility")
      .notNull()
      .default("private"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // The library's undo layer, and not the delete mechanism. A stamped row
    // leaves every listing while its Blob object stays fetchable, which is
    // exactly what makes restore possible and exactly why permanent deletion
    // is a separate operation that removes both. See docs/backend.md.
    // NULL means live, so every row written before this column existed is live.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("generations_user_id_idx").on(table.userId),
    index("generations_user_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    // Public surfaces enter through visibility, newest first.
    index("generations_visibility_created_at_idx").on(
      table.visibility,
      table.createdAt.desc(),
    ),
  ],
);

/**
 * One row is one accepted generation reservation. It is deliberately separate
 * from `generations`: failed provider or storage work still consumed shared
 * capacity, and deleting an image must not refund that spend.
 */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    model: text("model").notNull(),
    imageCount: integer("image_count").notNull(),
    providerUnits: integer("provider_units").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_events_user_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    check("usage_events_image_count_positive", sql`${table.imageCount} > 0`),
    check(
      "usage_events_provider_units_nonnegative",
      sql`${table.providerUnits} >= 0`,
    ),
  ],
);

export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
