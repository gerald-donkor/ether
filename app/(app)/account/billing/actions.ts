"use server";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkoutIntegrationIdentifier, getOrCreateStripeCustomer } from "@/lib/billing/customer";
import { getBillingOffer } from "@/lib/billing/catalog";
import { hasLiveSubscription } from "@/lib/billing/events";
import { getStripe } from "@/lib/billing/stripe";
import { billingOfferSchema } from "@/lib/validation/billing";
import { readBillingSummary } from "@/lib/db/billing";

export type BillingActionState = { ok: null | false; error: string | null };

async function origin() {
  const values = await headers();
  const host = values.get("x-forwarded-host") ?? values.get("host");
  const protocol = values.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (!host || (protocol !== "https" && !(protocol === "http" && host.startsWith("localhost")))) {
    throw new Error("Invalid request origin");
  }
  return `${protocol}://${host}`;
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "Unknown error";
}

async function startCheckout(formData: FormData, expected: "subscription" | "top_up"): Promise<{ url: string } | BillingActionState> {
  const { userId } = await auth();
  if (!userId) return { ok: false as const, error: "Sign in to continue." };
  const parsed = billingOfferSchema.safeParse({ offer: formData.get("offer") });
  if (!parsed.success) return { ok: false as const, error: "That billing option is unavailable." };

  try {
    const offer = await getBillingOffer(parsed.data.offer);
    if (offer.kind !== expected) return { ok: false as const, error: "That billing option is unavailable." };
    if (expected === "subscription") {
      const current = await readBillingSummary(userId);
      if (hasLiveSubscription(current.subscription?.status)) {
        return { ok: false as const, error: "Manage your current subscription instead." };
      }
    }
    const customer = await getOrCreateStripeCustomer(userId);
    const base = await origin();
    const session = await getStripe().checkout.sessions.create({
      customer,
      mode: expected === "subscription" ? "subscription" : "payment",
      line_items: [{ price: offer.priceId, quantity: 1 }],
      success_url: `${base}/account?billing=confirmed`,
      cancel_url: `${base}/account?billing=cancelled`,
      metadata: { ether_offer_key: offer.key },
      ...(expected === "subscription"
        ? { subscription_data: { metadata: { ether_offer_key: offer.key } } }
        : {}),
      integration_identifier: checkoutIntegrationIdentifier(),
    });
    if (!session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("Invalid Checkout URL");
    return { url: session.url };
  } catch (error) {
    console.error("Stripe Checkout creation failed.", errorName(error));
    return { ok: false as const, error: "Checkout is unavailable. Try again shortly." };
  }
}

export async function startSubscriptionCheckout(_state: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const result = await startCheckout(formData, "subscription");
  if ("url" in result) redirect(result.url);
  return result;
}

export async function startTopUpCheckout(_state: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const result = await startCheckout(formData, "top_up");
  if ("url" in result) redirect(result.url);
  return result;
}

export async function openBillingPortal(_state: BillingActionState, _formData: FormData): Promise<BillingActionState> {
  void _state;
  void _formData;
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Sign in to manage billing." };
  try {
    const customer = await getOrCreateStripeCustomer(userId);
    const session = await getStripe().billingPortal.sessions.create({ customer, return_url: `${await origin()}/account` });
    if (!session.url.startsWith("https://billing.stripe.com/")) throw new Error("Invalid portal URL");
    redirect(session.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("Stripe portal creation failed.", errorName(error));
    return { ok: false, error: "Billing management is unavailable. Try again shortly." };
  }
}
