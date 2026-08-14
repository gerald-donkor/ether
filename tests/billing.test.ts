import test from "node:test";
import assert from "node:assert/strict";
import {
  billingEventTypeSchema,
  billingOfferSchema,
  stripeCatalogMetadataSchema,
} from "../lib/validation/billing";
import {
  BILLING_SUBSCRIPTION_STATUSES,
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
