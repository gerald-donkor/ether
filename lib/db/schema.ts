import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
    // Private unless the owner opts in on the generate form. The default is
    // what keeps every row written before this column existed private.
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // The library's undo layer, and not the delete mechanism. A stamped row
    // leaves every listing while its Blob object stays fetchable, which is
    // exactly what makes restore possible and exactly why permanent deletion
    // is a separate operation that removes both. See docs/backend.md.
    // NULL means live, so every row written before this column existed is.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("generations_user_id_idx").on(table.userId),
    index("generations_user_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    // The landing gallery's only read: public rows, newest first.
    index("generations_public_created_at_idx").on(
      table.isPublic,
      table.createdAt.desc(),
    ),
  ],
);

export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
