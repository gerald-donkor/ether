import type Stripe from "stripe";
import { getBillingOffer } from "@/lib/billing/catalog";
import {
  isPendingPeriodEndCancellation,
  isProvisionableStatus,
  revocableCreditsForRefund,
  toBillingSubscriptionStatus,
} from "@/lib/billing/events";
import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripe";
import {
  claimBillingWebhook,
  completeBillingWebhook,
  failBillingWebhook,
  getDisputesForPaymentIntent,
  getOwnerForStripeCustomer,
  getPurchaseGrantCredits,
  grantPurchaseCredits,
  reversePurchaseCredits,
  setBillingHold,
  upsertBillingSubscription,
} from "@/lib/db/billing";
import { billingEventTypeSchema, checkoutSessionMarkerSchema, stripeCatalogMetadataSchema } from "@/lib/validation/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A dispute takes back the whole payment, so the reversal's ceiling is only
 * there because `reverse_purchase_credits` rejects a non-positive maximum. The
 * function itself caps the revocation at whatever the grant has left unspent.
 * This is the largest `integer` PostgreSQL accepts for that argument.
 */
const DISPUTE_REVOKES_EVERYTHING = 2147483647;

function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "Unknown error";
}

async function ownerFor(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  const customerId = id(customer);
  if (!customerId) throw new Error("Missing Stripe customer");
  const userId = await getOwnerForStripeCustomer(customerId);
  if (!userId) throw new Error("Unknown Stripe customer");
  return { userId, stripeCustomerId: customerId };
}

async function syncSubscription(subscription: Stripe.Subscription, event: Stripe.Event) {
  const owner = await ownerFor(subscription.customer);
  const item = subscription.items.data[0];
  if (!item || subscription.items.data.length !== 1) throw new Error("Invalid subscription items");
  const offer = await getBillingOffer("studio_monthly");
  if (item.price.id !== offer.priceId) throw new Error("Unapproved subscription price");
  const status = toBillingSubscriptionStatus(subscription.status);
  if (!status) throw new Error("Unsupported subscription status");
  await upsertBillingSubscription({
    stripeSubscriptionId: subscription.id,
    ...owner,
    stripePriceId: item.price.id,
    status,
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: isPendingPeriodEndCancellation({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at,
      currentPeriodEnd: item.current_period_end,
    }),
    eventCreatedAt: new Date(event.created * 1000),
  });
  return { ...owner, offer, item, status };
}

async function applyEvent(event: Stripe.Event) {
  const stripe = getStripe();
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    if (session.mode !== "payment" || session.payment_status !== "paid") return undefined;

    // "Not ours" and "ours and broken" are different answers. Every Session
    // this app creates sets `ether_offer_key` in its own metadata, so a Session
    // without a valid one is somebody else's and is ignored with a 200. A
    // Session that carries the marker and then fails still throws, because that
    // is a misconfiguration and swallowing it would hide it.
    if (!checkoutSessionMarkerSchema.safeParse(session.metadata).success) return undefined;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
    const linePriceId = lineItems.data[0]?.price?.id;
    if (!linePriceId || lineItems.data.length !== 1 || lineItems.data[0]?.quantity !== 1) throw new Error("Invalid top-up line items");
    const metadata = stripeCatalogMetadataSchema.safeParse((await stripe.prices.retrieve(linePriceId)).metadata);
    if (!metadata.success || metadata.data.ether_kind !== "top_up") throw new Error("Invalid top-up metadata");
    const offer = await getBillingOffer(metadata.data.ether_offer_key);
    const owner = await ownerFor(session.customer);
    const paymentIntent = id(session.payment_intent);
    if (!paymentIntent || offer.kind !== "top_up" || offer.priceId !== linePriceId) throw new Error("Invalid top-up Checkout");
    await grantPurchaseCredits({ ...owner, credits: offer.credits, reason: "top_up_grant", stripeEventId: event.id, stripeObjectId: paymentIntent, checkoutSessionId: session.id });

    // A dispute delivered before this grant wrote a hold and no ledger row,
    // because `reverse_purchase_credits` finds no grant and returns 0. Replay
    // it now that the grant exists. Keyed on the dispute id, so it collides
    // with the dispute handler's own reversal and lands exactly once.
    for (const disputeId of await getDisputesForPaymentIntent(paymentIntent)) {
      await reversePurchaseCredits({ stripeObjectId: paymentIntent, stripeEventId: disputeId, reason: "dispute_reversal", maximumCredits: DISPUTE_REVOKES_EVERYTHING });
    }
    return owner.userId;
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const current = await stripe.subscriptions.retrieve(event.data.object.id);
    return (await syncSubscription(current, event)).userId;
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    const subscriptionId = id(invoice.parent?.subscription_details?.subscription);
    if (!subscriptionId) return undefined;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const synced = await syncSubscription(subscription, event);

    // Provisioning is what the docs tie to this event, and it is tied to the
    // subscription's status, not to a payment object. Any other status has
    // synced the row and is a handled outcome, so it answers 200 rather than
    // making Stripe retry the same event for three days.
    if (!isProvisionableStatus(synced.status)) return synced.userId;

    // The invoice is the idempotency key, not a PaymentIntent: an invoice can
    // be paid out of band or from the customer's credit balance and then have
    // none, while `Invoice.id` is a required string in stripe@22.5.0.
    await grantPurchaseCredits({ userId: synced.userId, credits: synced.offer.credits, reason: "subscription_grant", stripeEventId: event.id, stripeObjectId: invoice.id, expiresAt: new Date(synced.item.current_period_end * 1000) });
    return synced.userId;
  }

  if (event.type === "refund.created") {
    const refund = event.data.object;
    const paymentIntentId = id(refund.payment_intent);
    if (!paymentIntentId) return undefined;
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const owner = await ownerFor(intent.customer);
    const grantCredits = await getPurchaseGrantCredits(paymentIntentId);
    if (!grantCredits) return owner.userId;
    const maximum = revocableCreditsForRefund({ grantCredits, refundAmount: refund.amount, chargedAmount: intent.amount });

    // A refund too small to be worth a credit revokes none. The reversal
    // function rejects a non-positive maximum, so the caller does not call it.
    if (maximum === 0) return owner.userId;
    await reversePurchaseCredits({ stripeObjectId: paymentIntentId, stripeEventId: event.id, reason: "refund_reversal", maximumCredits: maximum });
    return owner.userId;
  }

  if (event.type !== "charge.dispute.created" && event.type !== "charge.dispute.closed") return undefined;
  const dispute = event.data.object;
  const paymentIntentId = id(dispute.payment_intent);
  if (!paymentIntentId) return undefined;
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const owner = await ownerFor(intent.customer);

  // Recorded before the reversal is attempted, and that order is the fix. If
  // the grant is still in flight this row is what its own path will find; if
  // the grant has already landed, the reversal below writes the row itself.
  // Either way the dispute is durable against the payment.
  await setBillingHold({ stripeDisputeId: dispute.id, userId: owner.userId, active: event.type === "charge.dispute.created", stripePaymentIntentId: paymentIntentId });

  // Keyed on `dispute.id`, not `event.id`. `du_…` is the one identifier both
  // this handler and the grant path can derive, so the existing
  // `stripe_event_id` dedupe in `reverse_purchase_credits` makes the two paths
  // idempotent against each other with no new function and no new column.
  if (event.type === "charge.dispute.created") {
    await reversePurchaseCredits({ stripeObjectId: paymentIntentId, stripeEventId: dispute.id, reason: "dispute_reversal", maximumCredits: DISPUTE_REVOKES_EVERYTHING });
  }
  return owner.userId;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("Stripe webhook signature rejected.", errorName(error));
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.livemode) return Response.json({ error: "Live events are disabled" }, { status: 400 });
  if (!billingEventTypeSchema.safeParse(event.type).success) return Response.json({ received: true });
  const claim = await claimBillingWebhook({ id: event.id, type: event.type, created: new Date(event.created * 1000) });
  if (claim !== "claimed") return Response.json({ received: true });
  try {
    const userId = await applyEvent(event);
    await completeBillingWebhook(event.id, userId);
    return Response.json({ received: true });
  } catch (error) {
    const category = errorName(error);
    await failBillingWebhook(event.id, category);
    console.error("Stripe webhook processing failed.", event.id, event.type, category);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
