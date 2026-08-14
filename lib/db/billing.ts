import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  billingCustomers,
  billingHolds,
  billingSubscriptions,
  billingWebhookEvents,
  creditLedger,
} from "./schema";

type IntegerRow = { value: unknown };

function integer(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("Invalid credit balance");
  return parsed;
}

export async function getBillingCustomerForOwner(userId: string) {
  const [row] = await getDb()
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);
  return row;
}

export async function getOwnerForStripeCustomer(stripeCustomerId: string) {
  const [row] = await getDb()
    .select({ userId: billingCustomers.userId })
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row?.userId;
}

export async function saveBillingCustomer(userId: string, stripeCustomerId: string) {
  const [row] = await getDb()
    .insert(billingCustomers)
    .values({ userId, stripeCustomerId })
    .onConflictDoUpdate({
      target: billingCustomers.userId,
      set: { stripeCustomerId, updatedAt: sql`now()` },
    })
    .returning();
  return row;
}

export async function readCreditBalance(userId: string) {
  const result = await getDb().execute<IntegerRow>(sql`
    select read_credit_balance(${userId}::text) as value
  `);
  return integer(result.rows[0]?.value);
}

export async function readBillingSummary(userId: string) {
  const db = getDb();
  const [balanceResult, subscriptionRows] = await db.batch([
    db.execute<IntegerRow>(sql`select read_credit_balance(${userId}::text) as value`),
    db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.userId, userId))
      .orderBy(desc(billingSubscriptions.providerEventCreatedAt))
      .limit(1),
  ]);
  return {
    available: true as const,
    credits: integer(balanceResult.rows[0]?.value),
    subscription: subscriptionRows[0] ?? null,
  };
}

export type CapacityReservation =
  | { status: "accepted"; ownerWindowUsed: number; ownerWindowRemaining: number; resetAt: Date | null; creditsRemaining: number }
  | { status: "account_limit" | "provider_capacity" | "insufficient_credits" | "billing_hold"; ownerWindowUsed: number; ownerWindowRemaining: number; resetAt: Date | null; creditsRemaining: number }
  | { status: "unavailable" };

type CapacityRow = {
  outcome: unknown;
  owner_window_used: unknown;
  owner_window_remaining: unknown;
  reset_at: unknown;
  credits_remaining: unknown;
};

export async function reserveGenerationCapacity(input: {
  userId: string;
  operationId: string;
  model: string;
  imageCount: number;
  providerUnits: number;
  creditCost: number;
}): Promise<CapacityReservation> {
  try {
    const result = await getDb().execute<CapacityRow>(sql`
      select * from reserve_generation_capacity(
        ${input.userId}::text,
        ${input.operationId}::uuid,
        ${input.model}::text,
        ${input.imageCount}::integer,
        ${input.providerUnits}::integer,
        ${input.creditCost}::integer
      )
    `);
    const row = result.rows[0];
    if (!row) return { status: "unavailable" };
    const status = row.outcome;
    if (!["accepted", "account_limit", "provider_capacity", "insufficient_credits", "billing_hold"].includes(String(status))) {
      return { status: "unavailable" };
    }
    const resetAt = row.reset_at == null ? null : new Date(String(row.reset_at));
    return {
      status: status as Exclude<CapacityReservation, { status: "unavailable" }>["status"],
      ownerWindowUsed: integer(row.owner_window_used),
      ownerWindowRemaining: integer(row.owner_window_remaining),
      resetAt,
      creditsRemaining: integer(row.credits_remaining),
    };
  } catch (error) {
    console.error("Generation capacity reservation failed.", error instanceof Error ? error.name : "Unknown database error");
    return { status: "unavailable" };
  }
}

export async function settleGenerationCredits(operationId: string, deliveredCredits: number) {
  const result = await getDb().execute<IntegerRow>(sql`
    select settle_generation_credits(${operationId}::uuid, ${deliveredCredits}::integer) as value
  `);
  return integer(result.rows[0]?.value);
}

export async function upsertBillingSubscription(input: {
  stripeSubscriptionId: string;
  userId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  eventCreatedAt: Date;
}) {
  await getDb()
    .insert(billingSubscriptions)
    .values({
      ...input,
      providerEventCreatedAt: input.eventCreatedAt,
    })
    .onConflictDoUpdate({
      target: billingSubscriptions.stripeSubscriptionId,
      set: {
        stripePriceId: input.stripePriceId,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        providerEventCreatedAt: input.eventCreatedAt,
        updatedAt: sql`now()`,
      },
      setWhere: sql`${billingSubscriptions.providerEventCreatedAt} <= ${input.eventCreatedAt}`,
    });
}

export async function grantPurchaseCredits(input: {
  userId: string;
  credits: number;
  reason: "subscription_grant" | "top_up_grant";
  stripeEventId: string;
  stripeObjectId: string;
  checkoutSessionId?: string;
  expiresAt?: Date;
}) {
  const result = await getDb().execute<IntegerRow>(sql`
    select grant_purchase_credits(
      ${input.userId}::text,
      ${input.credits}::integer,
      ${input.reason}::credit_ledger_reason,
      ${input.stripeEventId}::text,
      ${input.stripeObjectId}::text,
      ${input.checkoutSessionId ?? null}::text,
      ${input.expiresAt ?? null}::timestamptz
    ) as value
  `);
  return integer(result.rows[0]?.value);
}

export async function reversePurchaseCredits(input: {
  stripeObjectId: string;
  stripeEventId: string;
  reason: "refund_reversal" | "dispute_reversal";
  maximumCredits: number;
}) {
  const result = await getDb().execute<IntegerRow>(sql`
    select reverse_purchase_credits(
      ${input.stripeObjectId}::text,
      ${input.stripeEventId}::text,
      ${input.reason}::credit_ledger_reason,
      ${input.maximumCredits}::integer
    ) as value
  `);
  return integer(result.rows[0]?.value);
}

/**
 * The positive grant a provider object bought, and only that.
 *
 * A reversal carries the same `stripe_object_id` as the grant it compensates,
 * and `credit_ledger_purchase_object_idx` is partial over the grant reasons
 * only, so several rows can share one object id. Without the reason filter a
 * second partial refund can read the earlier reversal's negative delta.
 */
export async function getPurchaseGrantCredits(stripeObjectId: string) {
  const [row] = await getDb().select({ credits: creditLedger.delta }).from(creditLedger)
    .where(and(
      eq(creditLedger.stripeObjectId, stripeObjectId),
      inArray(creditLedger.reason, ["subscription_grant", "top_up_grant"]),
    )).limit(1);
  return row?.credits;
}

export async function claimBillingWebhook(input: { id: string; type: string; created: Date }) {
  const db = getDb();
  const [inserted] = await db
    .insert(billingWebhookEvents)
    .values({ stripeEventId: input.id, type: input.type, eventCreatedAt: input.created })
    .onConflictDoNothing()
    .returning({ id: billingWebhookEvents.stripeEventId });
  if (inserted) return "claimed" as const;

  const [existing] = await db
    .select({ status: billingWebhookEvents.status, attemptedAt: billingWebhookEvents.attemptedAt })
    .from(billingWebhookEvents)
    .where(eq(billingWebhookEvents.stripeEventId, input.id))
    .limit(1);
  if (existing?.status === "processed") return "processed" as const;
  const [reclaimed] = await db
    .update(billingWebhookEvents)
    .set({ status: "processing", attemptedAt: sql`now()`, errorCategory: null })
    .where(and(eq(billingWebhookEvents.stripeEventId, input.id), sql`${billingWebhookEvents.status} = 'failed' or (${billingWebhookEvents.status} = 'processing' and ${billingWebhookEvents.attemptedAt} < now() - interval '15 minutes')`))
    .returning({ id: billingWebhookEvents.stripeEventId });
  return reclaimed ? ("claimed" as const) : ("busy" as const);
}

export async function completeBillingWebhook(id: string, userId?: string) {
  await getDb()
    .update(billingWebhookEvents)
    .set({ status: "processed", userId: userId ?? null, processedAt: sql`now()`, errorCategory: null })
    .where(eq(billingWebhookEvents.stripeEventId, id));
}

export async function failBillingWebhook(id: string, category: string) {
  await getDb()
    .update(billingWebhookEvents)
    .set({ status: "failed", errorCategory: category.slice(0, 120) })
    .where(eq(billingWebhookEvents.stripeEventId, id));
}

export async function setBillingHold(input: {
  stripeDisputeId: string;
  userId: string;
  active: boolean;
  stripePaymentIntentId?: string;
}) {
  await getDb().insert(billingHolds).values({
    stripeDisputeId: input.stripeDisputeId,
    userId: input.userId,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    active: input.active,
    resolvedAt: input.active ? null : new Date(),
  }).onConflictDoUpdate({
    target: billingHolds.stripeDisputeId,
    set: {
      active: input.active,
      resolvedAt: input.active ? null : new Date(),
      // `coalesce(excluded, existing)` rather than a plain overwrite: a later
      // event that could not resolve the payment must not erase one an earlier
      // event did resolve.
      stripePaymentIntentId: sql`coalesce(excluded.stripe_payment_intent_id, ${billingHolds.stripePaymentIntentId})`,
    },
  });
}

/**
 * Every dispute recorded against a payment, oldest first.
 *
 * This is what makes the grant path order-independent: a `charge.dispute.*`
 * event that arrived before its grant wrote a hold row and no ledger row,
 * because `reverse_purchase_credits` returns 0 when no grant exists yet. The
 * grant path replays the reversal for whatever this returns, keyed on the
 * dispute id, so the reversal happens exactly once whichever order they land in.
 */
export async function getDisputesForPaymentIntent(stripePaymentIntentId: string) {
  const rows = await getDb()
    .select({ stripeDisputeId: billingHolds.stripeDisputeId })
    .from(billingHolds)
    .where(eq(billingHolds.stripePaymentIntentId, stripePaymentIntentId))
    .orderBy(billingHolds.createdAt);
  return rows.map((row) => row.stripeDisputeId);
}
