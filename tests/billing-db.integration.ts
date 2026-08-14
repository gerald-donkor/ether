import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  getPurchaseGrantCredits,
  grantPurchaseCredits,
  readCreditBalance,
  reserveGenerationCapacity,
  reversePurchaseCredits,
  setBillingHold,
  settleGenerationCredits,
  upsertBillingSubscription,
} from "../lib/db/billing";
import { getDb } from "../lib/db/index";
import {
  billingHolds,
  billingSubscriptions,
  creditLedger,
  creditReservations,
  usageEvents,
} from "../lib/db/schema";

test("credits cannot overspend and grants, settlement and reversals are idempotent", async () => {
  const suffix = crypto.randomUUID();
  const owner = `billing-owner-${suffix}`;
  const other = `billing-other-${suffix}`;
  const operations = [crypto.randomUUID(), crypto.randomUUID()];
  const db = getDb();

  try {
    assert.equal(await readCreditBalance(owner), 10);
    const results = await Promise.all(operations.map((operationId) => reserveGenerationCapacity({
      userId: owner,
      operationId,
      model: "synthetic",
      imageCount: 6,
      providerUnits: 1,
      creditCost: 1,
    })));
    assert.equal(results.filter((result) => result.status === "accepted").length, 1);
    assert.equal(results.filter((result) => result.status === "insufficient_credits").length, 1);

    const acceptedIndex = results.findIndex((result) => result.status === "accepted");
    const acceptedOperation = operations[acceptedIndex];
    assert.ok(acceptedOperation);
    assert.equal(await settleGenerationCredits(acceptedOperation, 3), 3);
    assert.equal(await settleGenerationCredits(acceptedOperation, 3), 3);
    assert.equal(await readCreditBalance(owner), 7);
    assert.equal(await readCreditBalance(other), 10);

    const objectId = `pi_${suffix}`;
    await grantPurchaseCredits({ userId: owner, credits: 100, reason: "top_up_grant", stripeEventId: `evt_grant_${suffix}`, stripeObjectId: objectId });
    await grantPurchaseCredits({ userId: owner, credits: 100, reason: "top_up_grant", stripeEventId: `evt_grant_duplicate_${suffix}`, stripeObjectId: objectId });
    assert.equal(await readCreditBalance(owner), 107);
    await reversePurchaseCredits({ stripeObjectId: objectId, stripeEventId: `evt_refund_${suffix}`, reason: "refund_reversal", maximumCredits: 40 });
    await reversePurchaseCredits({ stripeObjectId: objectId, stripeEventId: `evt_refund_${suffix}`, reason: "refund_reversal", maximumCredits: 40 });
    assert.equal(await readCreditBalance(owner), 67);

    // The reversal above wrote a second row carrying the same object id. The
    // grant lookup must still read the grant, or a later partial refund
    // computes its proportion from a negative delta and under-recovers.
    assert.equal(await getPurchaseGrantCredits(objectId), 100);
  } finally {
    await db.delete(creditLedger).where(eq(creditLedger.userId, owner));
    await db.delete(creditLedger).where(eq(creditLedger.userId, other));
    await db.delete(creditReservations).where(eq(creditReservations.userId, owner));
    await db.delete(usageEvents).where(eq(usageEvents.userId, owner));
  }
});

test("an out-of-order subscription event never regresses the stored row", async () => {
  const suffix = crypto.randomUUID();
  const owner = `billing-sub-owner-${suffix}`;
  const subscriptionId = `sub_${suffix}`;
  const db = getDb();
  const base = {
    stripeSubscriptionId: subscriptionId,
    userId: owner,
    stripeCustomerId: `cus_${suffix}`,
    stripePriceId: `price_${suffix}`,
    currentPeriodStart: new Date("2026-08-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00Z"),
    cancelAtPeriodEnd: false,
  };

  const read = async () => {
    const [row] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.stripeSubscriptionId, subscriptionId)).limit(1);
    return row;
  };

  try {
    await upsertBillingSubscription({ ...base, status: "active", eventCreatedAt: new Date("2026-08-14T12:00:00Z") });
    assert.equal((await read())?.status, "active");

    // An event Stripe created earlier can arrive later. It must not overwrite
    // the newer state.
    await upsertBillingSubscription({ ...base, status: "incomplete", eventCreatedAt: new Date("2026-08-14T11:00:00Z") });
    assert.equal((await read())?.status, "active");

    // A genuinely newer event does apply.
    await upsertBillingSubscription({ ...base, status: "canceled", cancelAtPeriodEnd: true, eventCreatedAt: new Date("2026-08-14T13:00:00Z") });
    const latest = await read();
    assert.equal(latest?.status, "canceled");
    assert.equal(latest?.cancelAtPeriodEnd, true);
  } finally {
    await db.delete(billingSubscriptions).where(eq(billingSubscriptions.userId, owner));
  }
});

test("a dispute hold is its own outcome and reports the real balance", async () => {
  const suffix = crypto.randomUUID();
  const owner = `billing-hold-owner-${suffix}`;
  const disputeId = `dp_${suffix}`;
  const db = getDb();

  try {
    assert.equal(await readCreditBalance(owner), 10);
    await setBillingHold({ stripeDisputeId: disputeId, userId: owner, active: true });

    const held = await reserveGenerationCapacity({
      userId: owner,
      operationId: crypto.randomUUID(),
      model: "synthetic",
      imageCount: 1,
      providerUnits: 1,
      creditCost: 1,
    });
    assert.equal(held.status, "billing_hold");
    // Telling a held owner they have no credits contradicts /account, which is
    // showing the same real balance at the same moment.
    assert.equal(held.status === "billing_hold" ? held.creditsRemaining : null, 10);

    await setBillingHold({ stripeDisputeId: disputeId, userId: owner, active: false });
    const released = await reserveGenerationCapacity({
      userId: owner,
      operationId: crypto.randomUUID(),
      model: "synthetic",
      imageCount: 1,
      providerUnits: 1,
      creditCost: 1,
    });
    assert.equal(released.status, "accepted");
  } finally {
    await db.delete(billingHolds).where(eq(billingHolds.userId, owner));
    await db.delete(creditLedger).where(eq(creditLedger.userId, owner));
    await db.delete(creditReservations).where(eq(creditReservations.userId, owner));
    await db.delete(usageEvents).where(eq(usageEvents.userId, owner));
  }
});
