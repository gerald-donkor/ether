import test from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  getDisputesForPaymentIntent,
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

test("a dispute revokes exactly once whichever order it and its grant arrive in", async () => {
  const suffix = crypto.randomUUID();
  const db = getDb();

  // Both directions use the same machinery the webhook uses: the hold row
  // records the payment, the grant path replays whatever is recorded, and both
  // reversals are keyed on the dispute id rather than on an event id.
  const replayGrantPath = async (paymentIntentId: string) => {
    for (const disputeId of await getDisputesForPaymentIntent(paymentIntentId)) {
      await reversePurchaseCredits({ stripeObjectId: paymentIntentId, stripeEventId: disputeId, reason: "dispute_reversal", maximumCredits: 2147483647 });
    }
  };
  const reversals = async (owner: string) => {
    const rows = await db.select({ delta: creditLedger.delta, key: creditLedger.stripeEventId })
      .from(creditLedger)
      .where(and(eq(creditLedger.userId, owner), eq(creditLedger.reason, "dispute_reversal")));
    return rows;
  };

  const before = { owner: `dispute-before-${suffix}`, dispute: `du_before_${suffix}`, payment: `pi_before_${suffix}` };
  const after = { owner: `dispute-after-${suffix}`, dispute: `du_after_${suffix}`, payment: `pi_after_${suffix}` };

  try {
    // Direction one, the M7a shape: the dispute is delivered first, finds no
    // grant, and writes no ledger row. This is the money-loss path.
    assert.equal(await readCreditBalance(before.owner), 10);
    await setBillingHold({ stripeDisputeId: before.dispute, userId: before.owner, active: true, stripePaymentIntentId: before.payment });
    await reversePurchaseCredits({ stripeObjectId: before.payment, stripeEventId: before.dispute, reason: "dispute_reversal", maximumCredits: 2147483647 });
    assert.equal((await reversals(before.owner)).length, 0);

    // The grant lands, and replaying the recorded dispute takes it straight
    // back. Before this change the 100 stayed.
    await grantPurchaseCredits({ userId: before.owner, credits: 100, reason: "top_up_grant", stripeEventId: `evt_before_${suffix}`, stripeObjectId: before.payment });
    assert.equal(await readCreditBalance(before.owner), 110);
    await replayGrantPath(before.payment);
    assert.equal(await readCreditBalance(before.owner), 10);

    // A redelivery of either event writes nothing further, which is what
    // keying on the dispute id buys.
    await replayGrantPath(before.payment);
    await reversePurchaseCredits({ stripeObjectId: before.payment, stripeEventId: before.dispute, reason: "dispute_reversal", maximumCredits: 2147483647 });
    assert.equal(await readCreditBalance(before.owner), 10);
    const beforeRows = await reversals(before.owner);
    assert.equal(beforeRows.length, 1);
    assert.equal(beforeRows[0]?.delta, -100);
    assert.equal(beforeRows[0]?.key, before.dispute);

    // Direction two, the ordinary one: the grant lands first, the grant path
    // finds no dispute to replay, and the dispute handler does the revoking.
    await grantPurchaseCredits({ userId: after.owner, credits: 100, reason: "top_up_grant", stripeEventId: `evt_after_${suffix}`, stripeObjectId: after.payment });
    await replayGrantPath(after.payment);
    assert.equal(await readCreditBalance(after.owner), 110);

    await setBillingHold({ stripeDisputeId: after.dispute, userId: after.owner, active: true, stripePaymentIntentId: after.payment });
    await reversePurchaseCredits({ stripeObjectId: after.payment, stripeEventId: after.dispute, reason: "dispute_reversal", maximumCredits: 2147483647 });
    assert.equal(await readCreditBalance(after.owner), 10);

    // And the same redelivery guarantee from the other side: a late replay of
    // the grant path must not revoke a second time.
    await replayGrantPath(after.payment);
    assert.equal(await readCreditBalance(after.owner), 10);
    const afterRows = await reversals(after.owner);
    assert.equal(afterRows.length, 1);
    assert.equal(afterRows[0]?.delta, -100);
    assert.equal(afterRows[0]?.key, after.dispute);
  } finally {
    for (const owner of [before.owner, after.owner]) {
      await db.delete(creditLedger).where(eq(creditLedger.userId, owner));
      await db.delete(billingHolds).where(eq(billingHolds.userId, owner));
    }
  }
});

test("a hold keeps the payment it was first recorded against", async () => {
  const suffix = crypto.randomUUID();
  const owner = `dispute-close-${suffix}`;
  const disputeId = `du_close_${suffix}`;
  const paymentIntentId = `pi_close_${suffix}`;
  const db = getDb();

  const read = async () => {
    const [row] = await db.select().from(billingHolds)
      .where(eq(billingHolds.stripeDisputeId, disputeId)).limit(1);
    return row;
  };

  try {
    // A dispute seen for the first time at close still records its payment, so
    // a grant that has not landed yet can still find it.
    await setBillingHold({ stripeDisputeId: disputeId, userId: owner, active: false, stripePaymentIntentId: paymentIntentId });
    assert.equal((await read())?.stripePaymentIntentId, paymentIntentId);
    assert.deepEqual(await getDisputesForPaymentIntent(paymentIntentId), [disputeId]);

    // An event that cannot resolve the payment must not erase one that could.
    await setBillingHold({ stripeDisputeId: disputeId, userId: owner, active: true });
    const held = await read();
    assert.equal(held?.stripePaymentIntentId, paymentIntentId);
    assert.equal(held?.active, true);
    assert.equal(held?.resolvedAt, null);
  } finally {
    await db.delete(billingHolds).where(eq(billingHolds.userId, owner));
  }
});
