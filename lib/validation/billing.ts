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

export const stripeCatalogMetadataSchema = z.strictObject({
  ether_catalog_version: z.literal("v1"),
  ether_offer_key: z.enum(BILLING_OFFER_KEYS),
  ether_kind: z.enum(["subscription", "top_up"]),
  ether_credits: z.coerce.number().int().positive(),
});
