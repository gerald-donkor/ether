import test from "node:test";
import assert from "node:assert/strict";
import {
  billingEventTypeSchema,
  billingOfferSchema,
  stripeCatalogMetadataSchema,
} from "../lib/validation/billing";

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
