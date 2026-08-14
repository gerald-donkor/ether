import { z } from "zod";

export const BILLING_OFFER_KEYS = ["studio_monthly", "top_up_100"] as const;
export type BillingOfferKey = (typeof BILLING_OFFER_KEYS)[number];

export const BILLING_OFFER_FIELD = "offer";
export const billingOfferSchema = z.strictObject({
  offer: z.enum(BILLING_OFFER_KEYS, { error: "Choose an available credit offer." }),
});

export const BILLING_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "refund.created",
  "charge.dispute.created",
  "charge.dispute.closed",
] as const;

export const billingEventTypeSchema = z.enum(BILLING_EVENT_TYPES);

/**
 * The marker every Checkout Session this app creates carries in its own
 * metadata, and the only thing that makes a Session ours.
 *
 * Not strict, because Stripe may add metadata of its own and because the
 * subscription path sets the same marker on `subscription_data` as well. A
 * Session without it is somebody else's, including one made by
 * `stripe trigger`, and the webhook ignores it rather than failing on it.
 */
export const checkoutSessionMarkerSchema = z.object({
  ether_offer_key: z.enum(BILLING_OFFER_KEYS),
});

export const stripeCatalogMetadataSchema = z.strictObject({
  ether_catalog_version: z.literal("v1"),
  ether_offer_key: z.enum(BILLING_OFFER_KEYS),
  ether_kind: z.enum(["subscription", "top_up"]),
  ether_credits: z.coerce.number().int().positive(),
});
