import "server-only";

/**
 * The decisions the Stripe webhook makes that are pure: a closed status lookup
 * and one piece of arithmetic. They live here, apart from the handler, because
 * the handler cannot be exercised without a signing secret and a network,
 * while these can be tested with neither.
 *
 * Nothing in this module reads the environment, the database or Stripe.
 */

/**
 * The statuses `billing_subscriptions.status` models, in the order the enum
 * declares them. Stripe types `Subscription.status` as its own union widened
 * by `OtherString`, so an unmodelled status has to be rejected rather than
 * cast into the column.
 */
export const BILLING_SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type BillingSubscriptionStatus =
  (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

export function toBillingSubscriptionStatus(
  value: string,
): BillingSubscriptionStatus | undefined {
  return BILLING_SUBSCRIPTION_STATUSES.find(
    (candidate) => candidate === value,
  );
}

/**
 * The statuses that provision credits.
 *
 * docs.stripe.com/billing/subscriptions/webhooks, read 2026-08-14: `invoice.paid`
 * is "Sent when the invoice is successfully paid. You can provision access to
 * your product when you receive this event and the subscription `status` is
 * `active`." The same page's status table adds `trialing`, where "you can
 * safely provision your product for your customer". No other status does, and
 * the page says to revoke access on `canceled` and `unpaid`.
 */
export const PROVISIONABLE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
] as const satisfies readonly BillingSubscriptionStatus[];

export function isProvisionableStatus(status: string) {
  return PROVISIONABLE_SUBSCRIPTION_STATUSES.some(
    (candidate) => candidate === status,
  );
}

/**
 * Whether a subscription has a cancellation pending at the end of the period
 * the customer has already paid for.
 *
 * `Subscription.cancel_at_period_end` alone is not enough, and this is measured
 * rather than assumed. On 2026-08-14, against API version `2026-07-29.dahlia`,
 * cancelling through the hosted Customer Portal produced a subscription with
 * `cancel_at_period_end: false`, `cancel_at` set to exactly the item's
 * `current_period_end`, `canceled_at` set, and
 * `cancellation_details.reason: "cancellation_requested"`. Reading only the
 * boolean recorded that subscription as renewing, and `/account` told the
 * customer "Renews" on the very date Stripe was going to cancel them.
 *
 * docs.stripe.com/billing/subscriptions/cancel, read the same day, still says
 * the period-end path "is set to true", so the live provider disagrees with its
 * own documentation here. Both signals are therefore read, and the absolute
 * timestamp is trusted when the boolean is not set.
 *
 * A `cancel_at` beyond this item's period end is a future-dated cancellation,
 * not a cancellation at the end of the current period, so it does not set the
 * flag: the column keeps exactly the meaning its name and Stripe's own field
 * description give it.
 */
export function isPendingPeriodEndCancellation(input: {
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  currentPeriodEnd: number;
}) {
  if (input.cancelAtPeriodEnd) return true;
  if (!Number.isSafeInteger(input.cancelAt)) return false;
  if (!Number.isSafeInteger(input.currentPeriodEnd)) return false;
  return (input.cancelAt as number) <= input.currentPeriodEnd;
}

/**
 * The credits a refund may revoke: the unspent proportional part of the
 * purchase, which is the rule `docs/backend.md` records.
 *
 * It floors, and a refund whose share floors to zero revokes nothing. Rounding
 * a sub-credit refund up to one credit would take a credit the customer paid
 * for, which is the opposite of what a refund is.
 */
export function revocableCreditsForRefund(input: {
  grantCredits: number;
  refundAmount: number;
  chargedAmount: number;
}) {
  const { grantCredits, refundAmount, chargedAmount } = input;
  if (!Number.isSafeInteger(grantCredits) || grantCredits <= 0) return 0;
  if (!Number.isSafeInteger(refundAmount) || refundAmount <= 0) return 0;
  if (!Number.isSafeInteger(chargedAmount) || chargedAmount <= 0) return 0;
  return Math.min(
    grantCredits,
    Math.floor((grantCredits * refundAmount) / chargedAmount),
  );
}
