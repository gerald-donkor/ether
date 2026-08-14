"use client";

import { useActionState } from "react";
import { openBillingPortal, startSubscriptionCheckout, startTopUpCheckout, type BillingActionState } from "@/app/(app)/account/billing/actions";
import type { BillingOffer } from "@/lib/billing/catalog";
import {
  pillGhostSurface,
  pillPressable,
  pillPrimarySurface,
  pillShape,
} from "@/components/ui/Button";

const initialState: BillingActionState = { ok: null, error: null };

// These are `<button>`s in forms, so they keep the pressable response. The
// shape, surface and response come from the pill halves in `Button`, not from
// a second copy of the class strings (design-system.md 2.4).
const pillSize = "min-h-11 px-5 py-2.5 text-[14px] disabled:opacity-60";
const primaryPill = `${pillShape} ${pillPressable} ${pillPrimarySurface} ${pillSize}`;
const ghostPill = `${pillShape} ${pillPressable} ${pillGhostSurface} hover:border-text-3 ${pillSize}`;

type DisplayOffer = BillingOffer & { amount: string };

function OfferForm({ offer, label }: { offer: DisplayOffer; label: string }) {
  const action = offer.kind === "subscription" ? startSubscriptionCheckout : startTopUpCheckout;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="mt-5">
      <input type="hidden" name="offer" value={offer.key} />
      <button disabled={pending} className={primaryPill}>
        {pending ? "Opening Checkout" : label}
      </button>
      <p aria-live="polite" className="text-text-2 mt-3 min-h-[26px] text-[14px] leading-[26px]">{state.error}</p>
    </form>
  );
}

export function BillingPanel({ offers, hasCustomer, canSubscribe }: { offers: DisplayOffer[]; hasCustomer: boolean; canSubscribe: boolean }) {
  // An owner who already has a subscription is offered the top-up and the
  // portal, not a second copy of what they are already paying for. The action
  // refuses it either way; this only stops the page offering it.
  const subscription = canSubscribe ? offers.find((offer) => offer.kind === "subscription") : undefined;
  const topUp = offers.find((offer) => offer.kind === "top_up");
  return (
    <div className="mt-8 grid gap-8 sm:grid-cols-2">
      {subscription ? <div><p className="text-text text-[17px]">{subscription.name}</p><p className="text-text-2 mt-2 text-[15px] leading-[26px]">{subscription.amount} per month for {subscription.credits} credits</p><OfferForm offer={subscription} label="Subscribe" /></div> : null}
      {topUp ? <div><p className="text-text text-[17px]">{topUp.name}</p><p className="text-text-2 mt-2 text-[15px] leading-[26px]">{topUp.amount} · Credits do not expire</p><OfferForm offer={topUp} label="Buy credits" /></div> : null}
      {hasCustomer ? <PortalForm /> : null}
    </div>
  );
}

function PortalForm() {
  const [state, formAction, pending] = useActionState(openBillingPortal, initialState);
  return <form action={formAction} className="sm:col-span-2"><button disabled={pending} className={ghostPill}>{pending ? "Opening billing" : "Manage billing"}</button><p aria-live="polite" className="text-text-2 mt-3 min-h-[26px] text-[14px] leading-[26px]">{state.error}</p></form>;
}
