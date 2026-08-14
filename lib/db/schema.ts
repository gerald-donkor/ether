import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  type AnyPgColumn,
  pgEnum,
  pgTable,
  uniqueIndex,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { GENERATION_VISIBILITIES } from "@/lib/generations/visibility";
import { REPORT_CATEGORIES } from "@/lib/validation/report";

export const generationVisibility = pgEnum(
  "generation_visibility",
  GENERATION_VISIBILITIES,
);

export const moderationCategory = pgEnum(
  "moderation_category",
  REPORT_CATEGORIES,
);
export const reportResult = pgEnum("report_result", [
  "pending",
  "no_action",
  "takedown",
]);

export const billingSubscriptionStatus = pgEnum("billing_subscription_status", [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);
export const creditReservationStatus = pgEnum("credit_reservation_status", [
  "reserved",
  "settled",
  "released",
]);
export const creditLedgerReason = pgEnum("credit_ledger_reason", [
  "starter_grant",
  "subscription_grant",
  "top_up_grant",
  "generation_reservation",
  "generation_release",
  "subscription_expiry",
  "refund_reversal",
  "dispute_reversal",
]);
export const billingWebhookStatus = pgEnum("billing_webhook_status", [
  "processing",
  "processed",
  "failed",
]);

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
    takedownAt: timestamp("takedown_at", { withTimezone: true }),
    takedownReason: moderationCategory("takedown_reason"),
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
    check(
      "generations_takedown_pair",
      sql`(${table.takedownAt} is null and ${table.takedownReason} is null) or (${table.takedownAt} is not null and ${table.takedownReason} is not null)`,
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
    imageCount: integer("image_count").notNull().default(0),
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
    check("usage_events_image_count_nonnegative", sql`${table.imageCount} >= 0`),
    check(
      "usage_events_work_positive",
      sql`${table.imageCount} > 0 or ${table.providerUnits} > 0`,
    ),
    check(
      "usage_events_provider_units_nonnegative",
      sql`${table.providerUnits} >= 0`,
    ),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => generations.id, { onDelete: "cascade" }),
    reporterUserId: text("reporter_user_id").notNull(),
    category: moderationCategory("category").notNull(),
    result: reportResult("result").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("reports_generation_reporter_idx").on(
      table.generationId,
      table.reporterUserId,
    ),
    check(
      "reports_resolution_pair",
      sql`(${table.result} = 'pending' and ${table.resolvedAt} is null) or (${table.result} <> 'pending' and ${table.resolvedAt} is not null)`,
    ),
  ],
);

/**
 * One row is one owner's generation defaults. **This is not a users table**
 * (AGENTS.md 7.5): it holds no email, no name, and no identity of any kind.
 * Clerk still owns identity, and `user_id` is the same owner column every other
 * table here already carries.
 *
 * It lives in Postgres rather than in Clerk metadata because it is application
 * state. Putting it in Clerk would give the application a second write path
 * outside `lib/db/`, break the AGENTS.md 6.1 data-layer boundary, and make the
 * account export read from two providers.
 *
 * `user_id` is the primary key and there is no other index, because every read
 * is by exact owner id.
 *
 * `default_visibility` reuses the generation enum, but only `private` and
 * `public` are ever written: the publish control is a binary checkbox, and a
 * default it cannot express would be a lie about what will happen. The
 * constraint below is what enforces that rather than trusting the caller.
 */
export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: text("user_id").primaryKey(),
    defaultModel: text("default_model").notNull(),
    defaultSize: text("default_size").notNull(),
    defaultCount: integer("default_count").notNull(),
    defaultVisibility: generationVisibility("default_visibility")
      .notNull()
      .default("private"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "user_preferences_default_visibility_binary",
      sql`${table.defaultVisibility} in ('private', 'public')`,
    ),
    check(
      "user_preferences_default_count_positive",
      sql`${table.defaultCount} > 0`,
    ),
  ],
);

export const billingCustomers = pgTable(
  "billing_customers",
  {
    userId: text("user_id").primaryKey(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("billing_customers_stripe_customer_idx").on(table.stripeCustomerId)],
);

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    stripeSubscriptionId: text("stripe_subscription_id").primaryKey(),
    userId: text("user_id").notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripePriceId: text("stripe_price_id").notNull(),
    status: billingSubscriptionStatus("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    providerEventCreatedAt: timestamp("provider_event_created_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("billing_subscriptions_user_idx").on(table.userId),
    index("billing_subscriptions_customer_idx").on(table.stripeCustomerId),
  ],
);

export const billingHolds = pgTable(
  "billing_holds",
  {
    stripeDisputeId: text("stripe_dispute_id").primaryKey(),
    userId: text("user_id").notNull(),
    // The payment the dispute is against, so a grant that lands *after* its
    // dispute can find it and replay the reversal. Nullable because the one
    // row that predates this column cannot be backfilled from the table.
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("billing_holds_user_active_idx").on(table.userId, table.active),
    index("billing_holds_payment_intent_idx").on(table.stripePaymentIntentId),
  ],
);

export const creditReservations = pgTable(
  "credit_reservations",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    requestedCredits: integer("requested_credits").notNull(),
    settledCredits: integer("settled_credits"),
    status: creditReservationStatus("status").notNull().default("reserved"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("credit_reservations_user_status_idx").on(table.userId, table.status),
    check("credit_reservations_requested_positive", sql`${table.requestedCredits} > 0`),
    check("credit_reservations_settled_nonnegative", sql`${table.settledCredits} is null or ${table.settledCredits} >= 0`),
  ],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    delta: integer("delta").notNull(),
    reason: creditLedgerReason("reason").notNull(),
    grantId: uuid("grant_id").references((): AnyPgColumn => creditLedger.id),
    reservationId: uuid("reservation_id").references(() => creditReservations.id, { onDelete: "cascade" }),
    stripeEventId: text("stripe_event_id"),
    stripeObjectId: text("stripe_object_id"),
    checkoutSessionId: text("checkout_session_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("credit_ledger_user_created_idx").on(table.userId, table.createdAt),
    index("credit_ledger_grant_idx").on(table.grantId),
    uniqueIndex("credit_ledger_purchase_object_idx")
      .on(table.stripeObjectId)
      .where(sql`${table.reason} in ('starter_grant', 'subscription_grant', 'top_up_grant')`),
    uniqueIndex("credit_ledger_reservation_grant_reason_idx").on(table.reservationId, table.grantId, table.reason),
    check("credit_ledger_delta_nonzero", sql`${table.delta} <> 0`),
  ],
);

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    stripeEventId: text("stripe_event_id").primaryKey(),
    type: text("type").notNull(),
    status: billingWebhookStatus("status").notNull().default("processing"),
    userId: text("user_id"),
    errorCategory: text("error_category"),
    eventCreatedAt: timestamp("event_created_at", { withTimezone: true }).notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("billing_webhook_events_user_idx").on(table.userId)],
);

export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
