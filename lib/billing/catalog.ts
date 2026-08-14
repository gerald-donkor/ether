import "server-only";

import type Stripe from "stripe";
import { getStripe } from "./stripe";
import {
  stripeCatalogMetadataSchema,
  type BillingOfferKey,
} from "@/lib/validation/billing";

const APPROVED_OFFERS = {
  studio_monthly: {
    lookupKey: "ether_studio_monthly_v1",
    name: "Ether Studio",
    kind: "subscription",
    credits: 200,
    currency: "usd",
    unitAmount: 1500,
    interval: "month",
  },
  top_up_100: {
    lookupKey: "ether_top_up_100_v1",
    name: "100 credit top-up",
    kind: "top_up",
    credits: 100,
    currency: "usd",
    unitAmount: 1000,
    interval: null,
  },
} as const satisfies Record<BillingOfferKey, object>;

export type BillingOffer = {
  key: BillingOfferKey;
  priceId: string;
  name: string;
  kind: "subscription" | "top_up";
  credits: number;
  currency: string;
  unitAmount: number;
  interval: "month" | null;
};

function productName(product: string | Stripe.Product | Stripe.DeletedProduct) {
  return typeof product === "string" || product.deleted ? null : product.name;
}

function validatePrice(key: BillingOfferKey, price: Stripe.Price): BillingOffer {
  const expected = APPROVED_OFFERS[key];
  const metadata = stripeCatalogMetadataSchema.safeParse(price.metadata);
  const interval = price.recurring?.interval ?? null;
  if (
    !price.active ||
    price.livemode ||
    price.lookup_key !== expected.lookupKey ||
    price.currency !== expected.currency ||
    price.unit_amount !== expected.unitAmount ||
    interval !== expected.interval ||
    !metadata.success ||
    metadata.data.ether_offer_key !== key ||
    metadata.data.ether_kind !== expected.kind ||
    metadata.data.ether_credits !== expected.credits
  ) {
    throw new Error("Stripe catalog mismatch");
  }

  return {
    key,
    priceId: price.id,
    name: productName(price.product) ?? expected.name,
    kind: expected.kind,
    credits: expected.credits,
    currency: expected.currency,
    unitAmount: expected.unitAmount,
    interval: expected.interval,
  };
}

export async function getBillingCatalog() {
  const stripe = getStripe();
  const keys = Object.keys(APPROVED_OFFERS) as BillingOfferKey[];
  const lists = await Promise.all(
    keys.map((key) =>
      stripe.prices.list({
        active: true,
        lookup_keys: [APPROVED_OFFERS[key].lookupKey],
        expand: ["data.product"],
        limit: 1,
      }),
    ),
  );

  return keys.map((key, index) => {
    const price = lists[index]?.data[0];
    if (!price) throw new Error("Stripe catalog unavailable");
    return validatePrice(key, price);
  });
}

export async function getBillingOffer(key: BillingOfferKey) {
  const catalog = await getBillingCatalog();
  const offer = catalog.find((candidate) => candidate.key === key);
  if (!offer) throw new Error("Stripe offer unavailable");
  return offer;
}

export function formatOfferAmount(offer: BillingOffer) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: offer.currency,
    maximumFractionDigits: 0,
  }).format(offer.unitAmount / 100);
}
