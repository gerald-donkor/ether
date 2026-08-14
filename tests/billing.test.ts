import test from "node:test";
import assert from "node:assert/strict";
import {
  billingEventTypeSchema,
  billingOfferSchema,
  checkoutSessionMarkerSchema,
  stripeCatalogMetadataSchema,
} from "../lib/validation/billing";
import {
  BILLING_SUBSCRIPTION_STATUSES,
  ENDED_SUBSCRIPTION_STATUSES,
  hasLiveSubscription,
  isPendingPeriodEndCancellation,
  isProvisionableStatus,
  revocableCreditsForRefund,
  toBillingSubscriptionStatus,
} from "../lib/billing/events";

test("billing accepts only closed offers and webhook event types", () => {
  assert.equal(billingOfferSchema.safeParse({ offer: "studio_monthly" }).success, true);
  assert.equal(billingOfferSchema.safeParse({ offer: "price_arbitrary" }).success, false);
  assert.equal(billingOfferSchema.safeParse({ offer: "top_up_100", amount: 1 }).success, false);
  assert.equal(billingEventTypeSchema.safeParse("invoice.paid").success, true);
  assert.equal(billingEventTypeSchema.safeParse("payment_intent.created").success, false);
});

test("Stripe catalog metadata is strict and coerces integer credits", () => {
  const valid = stripeCatalogMetadataSchema.safeParse({
    ether_catalog_version: "v1",
    ether_offer_key: "top_up_100",
    ether_kind: "top_up",
    ether_credits: "100",
  });
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.ether_credits, 100);
  assert.equal(stripeCatalogMetadataSchema.safeParse({
    ether_catalog_version: "v1",
    ether_offer_key: "top_up_100",
    ether_kind: "top_up",
    ether_credits: "100.5",
  }).success, false);
});

test("the subscription status mapping is closed", () => {
  assert.equal(toBillingSubscriptionStatus("active"), "active");
  assert.equal(toBillingSubscriptionStatus("trialing"), "trialing");
  assert.equal(toBillingSubscriptionStatus("paused"), "paused");
  // Stripe widens its own union with OtherString, so anything the column does
  // not model has to come back undefined rather than be cast into it.
  assert.equal(toBillingSubscriptionStatus("ended"), undefined);
  assert.equal(toBillingSubscriptionStatus("all"), undefined);
  assert.equal(toBillingSubscriptionStatus(""), undefined);
  assert.equal(BILLING_SUBSCRIPTION_STATUSES.length, 8);
});

test("only active and trialing subscriptions provision credits", () => {
  assert.equal(isProvisionableStatus("active"), true);
  assert.equal(isProvisionableStatus("trialing"), true);
  for (const status of ["incomplete", "incomplete_expired", "past_due", "canceled", "unpaid", "paused", "ended"]) {
    assert.equal(isProvisionableStatus(status), false, status);
  }
});

test("a pending cancellation is read from cancel_at as well as the boolean", () => {
  const periodEnd = 1789384481;

  // The boolean alone, which is what the documentation describes.
  assert.equal(isPendingPeriodEndCancellation({ cancelAtPeriodEnd: true, cancelAt: null, currentPeriodEnd: periodEnd }), true);

  // What the hosted Customer Portal actually produced on 2026-08-14: the
  // boolean false, and cancel_at exactly equal to the item period end.
  assert.equal(isPendingPeriodEndCancellation({ cancelAtPeriodEnd: false, cancelAt: periodEnd, currentPeriodEnd: periodEnd }), true);

  // A cancellation earlier than the period end is still pending.
  assert.equal(isPendingPeriodEndCancellation({ cancelAtPeriodEnd: false, cancelAt: periodEnd - 1, currentPeriodEnd: periodEnd }), true);

  // No cancellation at all.
  assert.equal(isPendingPeriodEndCancellation({ cancelAtPeriodEnd: false, cancelAt: null, currentPeriodEnd: periodEnd }), false);

  // A future-dated cancellation beyond this period is not a period-end one.
  assert.equal(isPendingPeriodEndCancellation({ cancelAtPeriodEnd: false, cancelAt: periodEnd + 1, currentPeriodEnd: periodEnd }), false);

  // Malformed input never invents a cancellation.
  assert.equal(isPendingPeriodEndCancellation({ cancelAtPeriodEnd: false, cancelAt: Number.NaN, currentPeriodEnd: periodEnd }), false);
  assert.equal(isPendingPeriodEndCancellation({ cancelAtPeriodEnd: false, cancelAt: periodEnd, currentPeriodEnd: Number.NaN }), false);

  // The boolean still wins outright, whatever the timestamps say.
  assert.equal(isPendingPeriodEndCancellation({ cancelAtPeriodEnd: true, cancelAt: periodEnd + 1, currentPeriodEnd: periodEnd }), true);
});

test("a refund revokes the floored proportional part and never more than the grant", () => {
  // Half of a 100 credit top-up.
  assert.equal(revocableCreditsForRefund({ grantCredits: 100, refundAmount: 500, chargedAmount: 1000 }), 50);
  // A full refund takes the whole grant, and no rounding overshoots it.
  assert.equal(revocableCreditsForRefund({ grantCredits: 100, refundAmount: 1000, chargedAmount: 1000 }), 100);
  assert.equal(revocableCreditsForRefund({ grantCredits: 100, refundAmount: 999, chargedAmount: 1000 }), 99);
  // A refund too small to be worth a credit revokes none, rather than one.
  assert.equal(revocableCreditsForRefund({ grantCredits: 100, refundAmount: 9, chargedAmount: 1000 }), 0);
  assert.equal(revocableCreditsForRefund({ grantCredits: 1, refundAmount: 1, chargedAmount: 1000 }), 0);
  // Nothing malformed produces a negative or fractional revocation.
  assert.equal(revocableCreditsForRefund({ grantCredits: -50, refundAmount: 500, chargedAmount: 1000 }), 0);
  assert.equal(revocableCreditsForRefund({ grantCredits: 100, refundAmount: 500, chargedAmount: 0 }), 0);
  assert.equal(revocableCreditsForRefund({ grantCredits: 100, refundAmount: -500, chargedAmount: 1000 }), 0);
  assert.equal(revocableCreditsForRefund({ grantCredits: 100, refundAmount: 1500, chargedAmount: 1000 }), 100);
  assert.equal(revocableCreditsForRefund({ grantCredits: Number.NaN, refundAmount: 500, chargedAmount: 1000 }), 0);
});

test("a Checkout Session is ours only when it carries a known offer marker", () => {
  // What the app's own Sessions carry. Stripe may add metadata of its own, so
  // the schema reads the marker rather than owning the whole object.
  assert.equal(checkoutSessionMarkerSchema.safeParse({ ether_offer_key: "top_up_100" }).success, true);
  assert.equal(checkoutSessionMarkerSchema.safeParse({ ether_offer_key: "studio_monthly", something_else: "x" }).success, true);

  // A `stripe trigger` Session, and anything else that is not ours. Each of
  // these is ignored with a 200 instead of failing the webhook.
  assert.equal(checkoutSessionMarkerSchema.safeParse({}).success, false);
  assert.equal(checkoutSessionMarkerSchema.safeParse(null).success, false);
  assert.equal(checkoutSessionMarkerSchema.safeParse({ ether_offer_key: "" }).success, false);

  // An offer key that is not in the closed list is not ours either, which is
  // why this reads the enum rather than checking the key is present.
  assert.equal(checkoutSessionMarkerSchema.safeParse({ ether_offer_key: "top_up_500" }).success, false);
});

test("a subscription is live until it is canceled or expired before it started", () => {
  // The set the Checkout action refuses on and the set /account hides the
  // control on are the same set, read from one place.
  assert.deepEqual([...ENDED_SUBSCRIPTION_STATUSES], ["canceled", "incomplete_expired"]);
  for (const status of ENDED_SUBSCRIPTION_STATUSES) {
    assert.equal(hasLiveSubscription(status), false);
  }
  for (const status of BILLING_SUBSCRIPTION_STATUSES) {
    const ended = ENDED_SUBSCRIPTION_STATUSES.some((candidate) => candidate === status);
    assert.equal(hasLiveSubscription(status), !ended);
  }

  // No stored subscription at all is the case a new owner is in, and it must
  // read as subscribable rather than as live.
  assert.equal(hasLiveSubscription(undefined), false);
  assert.equal(hasLiveSubscription(null), false);
  assert.equal(hasLiveSubscription(""), false);
});
