"use client";

import { useActionState } from "react";
import { openBillingPortal, startSubscriptionCheckout, startTopUpCheckout, type BillingActionState } from "@/app/(app)/account/billing/actions";
import type { BillingOffer } from "@/lib/billing/catalog";

const initialState: BillingActionState = { ok: null, error: null };

type DisplayOffer = BillingOffer & { amount: string };

function OfferForm({ offer, label }: { offer: DisplayOffer; label: string }) {
  const action = offer.kind === "subscription" ? startSubscriptionCheckout : startTopUpCheckout;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="mt-5">
      <input type="hidden" name="offer" value={offer.key} />
      <button disabled={pending} className="bg-lime text-ink rounded-pill inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-[14px] font-medium transition-transform duration-200 ease-(--ease-out) active:scale-[0.98] disabled:opacity-60">
        {pending ? "Opening Checkout" : label}
      </button>
      <p aria-live="polite" className="text-text-2 mt-3 min-h-[26px] text-[14px] leading-[26px]">{state.error}</p>
    </form>
  );
}

export function BillingPanel({ offers, hasCustomer }: { offers: DisplayOffer[]; hasCustomer: boolean }) {
  const subscription = offers.find((offer) => offer.kind === "subscription");
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
  return <form action={formAction} className="sm:col-span-2"><button disabled={pending} className="border-line text-text hover:border-text-3 rounded-pill inline-flex min-h-11 items-center justify-center border px-5 py-2.5 text-[14px] font-medium transition-transform duration-200 ease-(--ease-out) active:scale-[0.98] disabled:opacity-60">{pending ? "Opening billing" : "Manage billing"}</button><p aria-live="polite" className="text-text-2 mt-3 min-h-[26px] text-[14px] leading-[26px]">{state.error}</p></form>;
}
