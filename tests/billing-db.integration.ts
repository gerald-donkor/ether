import test from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { revocableCreditsForRefund } from "../lib/billing/events";
import {
  getDisputesForPaymentIntent,
  getPurchaseGrantCredits,
  getRefundsForPaymentIntent,
  grantPurchaseCredits,
  readCreditBalance,
  recordBillingRefund,
  reserveGenerationCapacity,
  reversePurchaseCredits,
  setBillingHold,
  settleGenerationCredits,
  upsertBillingSubscription,
} from "../lib/db/billing";
import { getDb } from "../lib/db/index";
import {
  billingHolds,
  billingRefunds,
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

test("a refund revokes exactly once whichever order it and its grant arrive in", async () => {
  const suffix = crypto.randomUUID();
  const db = getDb();
  const GRANT_CREDITS = 100;
  const CHARGED = 10000;
  const REFUNDED = 2500;

  // The same machinery the webhook uses: the refund row records the payment
  // and both provider amounts, the grant path replays whatever is recorded,
  // and both reversals are keyed on the refund id rather than on an event id.
  const replayGrantPath = async (paymentIntentId: string) => {
    for (const refund of await getRefundsForPaymentIntent(paymentIntentId)) {
      const maximum = revocableCreditsForRefund({ grantCredits: GRANT_CREDITS, refundAmount: refund.refundAmount, chargedAmount: refund.chargedAmount });
      if (maximum === 0) continue;
      await reversePurchaseCredits({ stripeObjectId: paymentIntentId, stripeEventId: refund.stripeRefundId, reason: "refund_reversal", maximumCredits: maximum });
    }
  };
  const reversals = async (owner: string) => db
    .select({ delta: creditLedger.delta, key: creditLedger.stripeEventId })
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, owner), eq(creditLedger.reason, "refund_reversal")));

  const before = { owner: `refund-before-${suffix}`, refund: `re_before_${suffix}`, payment: `pi_refund_before_${suffix}` };
  const after = { owner: `refund-after-${suffix}`, refund: `re_after_${suffix}`, payment: `pi_refund_after_${suffix}` };

  // What the refund handler does, in the order it does it: record, then try to
  // reverse against whatever grant exists.
  const refundHandler = async (side: typeof before) => {
    await recordBillingRefund({ stripeRefundId: side.refund, userId: side.owner, stripePaymentIntentId: side.payment, refundAmount: REFUNDED, chargedAmount: CHARGED });
    const grantCredits = await getPurchaseGrantCredits(side.payment);
    if (!grantCredits) return;
    const maximum = revocableCreditsForRefund({ grantCredits, refundAmount: REFUNDED, chargedAmount: CHARGED });
    if (maximum === 0) return;
    await reversePurchaseCredits({ stripeObjectId: side.payment, stripeEventId: side.refund, reason: "refund_reversal", maximumCredits: maximum });
  };

  try {
    // Direction one: the refund is delivered first, finds no grant, and writes
    // no ledger row. Before this change that revocation was lost for good.
    assert.equal(await readCreditBalance(before.owner), 10);
    await refundHandler(before);
    assert.equal((await reversals(before.owner)).length, 0);

    // The grant lands, and replaying the recorded refund takes back its
    // proportional share. A quarter of the charge is a quarter of the credits.
    await grantPurchaseCredits({ userId: before.owner, credits: GRANT_CREDITS, reason: "top_up_grant", stripeEventId: `evt_refund_before_${suffix}`, stripeObjectId: before.payment });
    assert.equal(await readCreditBalance(before.owner), 110);
    await replayGrantPath(before.payment);
    assert.equal(await readCreditBalance(before.owner), 85);

    // A redelivery of either event writes nothing further, which is what
    // keying on the refund id buys.
    await replayGrantPath(before.payment);
    await refundHandler(before);
    assert.equal(await readCreditBalance(before.owner), 85);
    const beforeRows = await reversals(before.owner);
    assert.equal(beforeRows.length, 1);
    assert.equal(beforeRows[0]?.delta, -25);
    assert.equal(beforeRows[0]?.key, before.refund);

    // Direction two, the ordinary one: the grant lands first, the grant path
    // finds no refund to replay, and the refund handler does the revoking.
    await grantPurchaseCredits({ userId: after.owner, credits: GRANT_CREDITS, reason: "top_up_grant", stripeEventId: `evt_refund_after_${suffix}`, stripeObjectId: after.payment });
    await replayGrantPath(after.payment);
    assert.equal(await readCreditBalance(after.owner), 110);

    await refundHandler(after);
    assert.equal(await readCreditBalance(after.owner), 85);

    // And the same redelivery guarantee from the other side: a late replay of
    // the grant path must not revoke a second time.
    await replayGrantPath(after.payment);
    assert.equal(await readCreditBalance(after.owner), 85);
    const afterRows = await reversals(after.owner);
    assert.equal(afterRows.length, 1);
    assert.equal(afterRows[0]?.delta, -25);
    assert.equal(afterRows[0]?.key, after.refund);
  } finally {
    for (const owner of [before.owner, after.owner]) {
      await db.delete(creditLedger).where(eq(creditLedger.userId, owner));
      await db.delete(billingRefunds).where(eq(billingRefunds.userId, owner));
    }
  }
});

test("an expired subscription grant expires its unspent remainder exactly once", async () => {
  const suffix = crypto.randomUUID();
  const unspent = `expiry-unspent-${suffix}`;
  const partial = `expiry-partial-${suffix}`;
  const db = getDb();

  // `reconcile_credit_balance` responds to `expires_at <= now()` and to nothing
  // else, so the grant is written with a future expiry and then moved into the
  // real past. A Stripe test clock cannot drive this: it moves Stripe's clock,
  // not PostgreSQL's.
  const expire = async (stripeObjectId: string) => {
    await db.update(creditLedger)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(creditLedger.stripeObjectId, stripeObjectId));
  };
  const expiries = async (owner: string) => db
    .select({ delta: creditLedger.delta })
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, owner), eq(creditLedger.reason, "subscription_expiry")));
  const nextMonth = new Date(Date.now() + 3_600_000);

  try {
    // A fully unspent grant expires whole, and the bought credits beside it do
    // not: a `top_up_grant` carries no `expires_at`, which is what makes bought
    // credits permanent and granted ones monthly.
    const subscriptionObject = `in_unspent_${suffix}`;
    await grantPurchaseCredits({ userId: unspent, credits: 50, reason: "subscription_grant", stripeEventId: `evt_sub_${suffix}`, stripeObjectId: subscriptionObject, expiresAt: nextMonth });
    await grantPurchaseCredits({ userId: unspent, credits: 25, reason: "top_up_grant", stripeEventId: `evt_top_${suffix}`, stripeObjectId: `pi_top_${suffix}` });
    assert.equal(await readCreditBalance(unspent), 85);

    await expire(subscriptionObject);
    assert.equal(await readCreditBalance(unspent), 35);
    const unspentRows = await expiries(unspent);
    assert.equal(unspentRows.length, 1);
    assert.equal(unspentRows[0]?.delta, -50);

    // Reconciling twice writes the expiry once, and leaves the permanent
    // credits alone.
    assert.equal(await readCreditBalance(unspent), 35);
    assert.equal((await expiries(unspent)).length, 1);

    // A partially spent grant expires only the remainder, never the spent part.
    const partialObject = `in_partial_${suffix}`;
    await grantPurchaseCredits({ userId: partial, credits: 100, reason: "subscription_grant", stripeEventId: `evt_sub_partial_${suffix}`, stripeObjectId: partialObject, expiresAt: nextMonth });
    assert.equal(await readCreditBalance(partial), 110);

    const operationId = crypto.randomUUID();
    const reserved = await reserveGenerationCapacity({ userId: partial, operationId, model: "synthetic", imageCount: 6, providerUnits: 1, creditCost: 1 });
    assert.equal(reserved.status, "accepted");
    assert.equal(await settleGenerationCredits(operationId, 6), 6);
    assert.equal(await readCreditBalance(partial), 104);

    await expire(partialObject);
    assert.equal(await readCreditBalance(partial), 10);
    const partialRows = await expiries(partial);
    assert.equal(partialRows.length, 1);
    assert.equal(partialRows[0]?.delta, -94);
  } finally {
    for (const owner of [unspent, partial]) {
      await db.delete(creditLedger).where(eq(creditLedger.userId, owner));
      await db.delete(creditReservations).where(eq(creditReservations.userId, owner));
      await db.delete(usageEvents).where(eq(usageEvents.userId, owner));
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
