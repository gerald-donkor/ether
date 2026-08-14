# 029 — Refund ordering, and renewal and expiry verified rather than assumed

## Scope, and why it is next

**§5.2's ungated rows are exhausted.** Steps 1 to 11 are built and committed,
and step 12 landed over prompts 025 to 028 (`668cbc7`, `1965829`, `988e041`,
`43607b9`). Steps 13 and 14 are phase-three rows that "may not be started
without asking", and on 2026-08-14 the user was asked and chose not to open
either.

What remains, and what this prompt is, is the open list `docs/backend.md`
carries forward under "Still open, and deliberately not decided here" (line
2238). Four items sit there. Two are commercial rules and the user chose on
2026-08-14 to keep both carried forward. The other two are not decisions:

- **Item A, the `refund.created` ordering race.** A named defect with the
  identical silent-loss shape prompt 028 fixed for disputes. 028 declined to fix
  it because item 1's machinery did not generalise "without recording refunds
  too". Recording refunds too is exactly what this prompt does.
- **Item B, subscription renewal and credit expiry across a period boundary.**
  Never observed running, in any prompt. This is the core of the paid product:
  a monthly subscription that grants credits every period and expires the
  previous period's unspent ones. Both halves are implemented and neither has a
  single line of evidence behind it.

Neither needs a decision, and both are billing correctness. That is why they are
next.

## Reference material read while writing this

| source | what it supplied |
| --- | --- |
| `docs/backend.md:2238-2259` | the four carried-forward items, and which of them are decisions |
| `docs/backend.md:2075-2083` | 027's "Still not closed" list, which item 4 above inherits |
| `prompts/028-dispute-grant-ordering-and-matrix-findings.md` | the record-then-replay mechanism this prompt copies, and its explicit statement that it does not generalise to refunds |
| `app/api/stripe/webhook/route.ts`, the `refund.created` branch | the exact `return owner.userId` that loses the revocation |
| `lib/db/billing.ts:216-226` | `getPurchaseGrantCredits`, and why it filters on the grant reasons |
| `lib/db/billing.ts:261-300` | `setBillingHold` and `getDisputesForPaymentIntent`, the shape item A mirrors |
| `lib/billing/events.ts`, `revocableCreditsForRefund` | the proportional floor, unchanged here |
| `lib/db/schema.ts:248-311` | `billing_holds` and `credit_ledger`, including `credit_ledger_purchase_object_idx` |
| `drizzle/0008_nosy_doctor_octopus.sql:11-40` | `reconcile_credit_balance`, and that subscription expiry is keyed on `expires_at <= now()` |
| `drizzle/0008_nosy_doctor_octopus.sql:166+` | `reverse_purchase_credits`'s `stripe_event_id` dedupe, which both replays ride on |
| `tests/billing-db.integration.ts` | the existing dispute-ordering coverage to model item A's on, and the absence of any expiry coverage |
| docs.stripe.com/billing/testing/test-clocks/api-advanced-usage, searched through the `stripe-docs` MCP on **2026-08-14** | the renewal procedure: `Customer` created with the `test_clock` parameter, advance the clock a cycle, then advance a further hour because the renewal invoice sits in `draft` for about one hour before it finalises and pays |

### The defect, quoted rather than described

`app/api/stripe/webhook/route.ts`, the `refund.created` branch:

```ts
const grantCredits = await getPurchaseGrantCredits(paymentIntentId);
if (!grantCredits) return owner.userId;
```

No grant, no reversal, no error, and the caller returns the owner id so the
event is marked `processed` and never revisited. That is the same three lines of
consequence as the dispute race, reached from a different function.

**Why it can happen, given 028's argument that it normally cannot.** 028 said a
refund cannot be created before its payment succeeds, so the grant is normally
already written. The grant is not written by Stripe, it is written by *this
handler* on `checkout.session.completed`, and that handler makes two Stripe API
calls and a database write before it grants. A refund issued immediately after a
payment, and `checkout.session.async_payment_succeeded` for a delayed payment
method, both open a window in which `refund.created` is delivered and processed
first. "Normally" is not "never", and the failure is silent money.

## Item A — a refund delivered before its grant must still revoke

**The fix is 028 item 1's, applied to refunds.** Record the refund durably
against the PaymentIntent, and make the grant path replay it.

1. **Migration:** a `billing_refunds` table. `stripe_refund_id` text primary key,
   `user_id` text not null, `stripe_payment_intent_id` text not null and
   indexed, `refund_amount` integer not null, `charged_amount` integer not null,
   `created_at` timestamptz not null default now.

   **Why the two amounts are stored** rather than re-fetched: the replay runs
   inside the grant path and must compute `revocableCreditsForRefund` without a
   second `paymentIntents.retrieve`, and both figures are provider amounts in
   minor units — a charge total and a refund total, not user content (§8.3).
   Not nullable, unlike `billing_holds.stripe_payment_intent_id`, because there
   is no pre-existing row to accommodate: the table is new.

2. **The reversal is keyed on `refund.id`, not `event.id`.** This is the
   load-bearing change and the reason it works at all. `re_…` is the one
   identifier both the refund handler and the grant-path replay can derive, so
   `reverse_purchase_credits`'s existing
   `NOT EXISTS (… WHERE stripe_event_id = p_event_id)` makes the two paths
   idempotent against each other with **no new PL/pgSQL function and no change
   to `reverse_purchase_credits`**. Keyed on `event.id` they cannot be, because
   the grant path does not have the refund's event id.

   `refund.created` fires once per refund, so this is a 1:1 substitution and
   loses no idempotency: a resent event carrying the same refund still dedupes.

3. **The refund handler records first, then reverses**, in that order, exactly as
   the dispute handler does and for the same reason. If the grant is still in
   flight the row is what the grant path will find; if the grant has landed the
   reversal below writes the ledger row itself.

4. **The grant path replays refunds before disputes.** Both replays go in the
   top-up branch after `grantPurchaseCredits` succeeds. Refunds first, because a
   dispute revokes everything and `reverse_purchase_credits` caps at whatever is
   left unspent — running the dispute first would leave a partial refund's
   proportional row with nothing to take, and the ledger would no longer read as
   the history that actually happened. The **total** is the same either way; the
   ordering is about the ledger telling the truth.

5. `getPurchaseGrantCredits` returning nothing keeps answering 200 and doing no
   reversal. It is now correct rather than lossy, because the recorded row is
   what makes the revocation happen later.

**Scoped to top-up grants only, deliberately, and this is existing recorded
behaviour rather than a choice made here.** A subscription grant is keyed on the
invoice id, so `getPurchaseGrantCredits(paymentIntentId)` finds nothing for a
refunded subscription invoice and the replay never fires. That is the same
scoping 028 recorded for disputes.

**The residual window, stated rather than hidden.** A refund recorded after the
grant path's replay lookup and never followed by another refund event cannot
strand a revocation: the refund handler always attempts its own reversal after
recording, and by then the grant exists.

## Item B — renewal and expiry, and why they need two different procedures

**They cannot be verified by the same mechanism, and that is the finding this
item turns on.** A Stripe test clock moves *Stripe's* clock.
`reconcile_credit_balance` expires a subscription grant on
`g.expires_at <= now()`, where `now()` is *PostgreSQL's* clock. Advancing a test
clock past a period end does not move the database one second, so a test-clock
run can prove the renewal and can prove nothing at all about the expiry.
Verifying both with one procedure would be a fabricated measurement (§12 rule 4).

### B1 — renewal, against the live sandbox with a test clock

Procedure, per the Stripe docs read 2026-08-14:

1. Create a test clock with `frozen_time` set to **the real current time or
   later**, so the periods it produces are in the real future and the two clocks
   do not silently interact.
2. Create a `Customer` with the `test_clock` parameter set to that clock, attach
   test card `4242424242424242`, and set it as
   `invoice_settings.default_payment_method`.
3. **Insert a `billing_customers` row** mapping a throwaway user id to that
   customer, or `ownerFor` throws `Unknown Stripe customer` and every event
   fails. This is a dev-database write and it is stated here rather than done
   quietly, exactly as 028 item 3's single-row reset was. It is deleted, with
   the ledger rows it produced, when the run finishes.
4. Create a subscription for that customer **at the catalog `studio_monthly`
   price id**, not an ad-hoc price — `syncSubscription` rejects an unapproved
   price, and the run has to exercise the real path.
5. `stripe listen` forwarding to the local dev server throughout, as
   `docs/automation.md` §"Run the Stripe sandbox matrix against the local dev
   server" already sets up.
6. Advance the clock one month, then advance it a further hour, because the
   renewal invoice sits in `draft` for about an hour before it finalises and
   pays.

Assertions:

- **Two `invoice.paid` events, two `subscription_grant` rows**, keyed on two
  different invoice ids — the first period's and the renewal's.
- The renewal grant's `expires_at` equals the **new** period end, not the old
  one.
- The `billing_subscriptions` row's period moved forward and its status is still
  `active`.
- **Exactly one grant per invoice.** Re-delivering the renewal invoice event
  writes no second row.

### B2 — expiry, in `tests/billing-db.integration.ts`

Driven by writing a grant whose `expires_at` is in the **real** past, which is
the only thing `reconcile_credit_balance` responds to. There is no expiry
coverage in that file today. Assertions:

- A fully unspent expired `subscription_grant` produces one `subscription_expiry`
  row for its whole remainder, and the balance drops by exactly that.
- A **partially spent** expired grant expires only the remainder, never the
  spent part.
- Running the reconcile twice writes the expiry **once** — the function's
  `NOT EXISTS (… reason = 'subscription_expiry')` guard, exercised rather than
  read.
- A `top_up_grant` with a null `expires_at` is untouched, which is what makes
  bought credits permanent and granted ones monthly.

**If the test clock cannot be driven to completion**, say so and record which
half was covered how, rather than reporting a renewal that was not observed
(§12 rule 3).

## Non-goals

- **The per-refund proportional floor is not changed.** The user chose on
  2026-08-14 to keep it carried forward. Accumulating the unrevoked remainder
  across refunds is a new commercial rule.
- **The dispute-won rule is not changed**, for the same reason and by the same
  decision. `charge.dispute.closed` keeps lifting the hold for every outcome and
  restoring nothing.
- **Steps 13 and 14 stay closed.** The user declined to open either on
  2026-08-14.
- **No shared "provider claim" table.** Merging `billing_holds` and
  `billing_refunds` into one table would be a refactor with no defect behind it,
  and the two have different lifecycles — a hold is active or resolved, a refund
  is a one-shot amount.
- Live mode, Production, a Dashboard webhook endpoint, and
  `STRIPE_WEBHOOK_SECRET` in the Vercel project. Unchanged from 027 and 028.
- The two-account boundary through the browser. Still blocked for the same
  reason.
- Any change to the landing page, the design system, the motion table, or any
  marketing route.

## Render impact

**`none — no existing route changes`, and it must be verified rather than
assumed.** `/api/stripe/webhook` is already `runtime = "nodejs"` and
`dynamic = "force-dynamic"`; item A changes its body and neither. `/account` is
untouched by this prompt. No page's markup or render mode changes, so `/` must
come back `IDENTICAL` and the route table must diff clean against a baseline of
`9398b8b`.

## Trust boundary

Unchanged in shape. The webhook still verifies `stripe-signature`, still rejects
`livemode`, still ignores unmodelled types with 200, and still claims each event
before doing work. `refund.created` is already in `BILLING_EVENT_TYPES`, so item
A adds no accepted event type and no new request path. Item B adds no route at
all: it is a script run against the sandbox plus an integration test, both
server-side and neither reachable from a browser.

## Secrets and data

- **Reads:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`, and
  `DATABASE_URL_UNPOOLED` for the migration and the read-only assertions. **No
  new variable**, so the expected `AGENTS.md` §8.4 diff is empty.
- **Writes:** one new table holding a Stripe refund id, a Stripe PaymentIntent
  id, and two provider amounts in minor units.
- **Stores:** nothing new about a person. No prompt, no email address, no
  `image_url` in any output or any log line.
- The test-clock customer, its `billing_customers` mapping and its ledger rows
  are dev-only and are removed when the run finishes.
- The client-bundle secret scan is re-run by name and by value.

## Files

**Creates:**

- one Drizzle migration under `drizzle/`, generated by `npm run db:generate` and
  never hand-numbered.
- the test-clock script, in the session scratchpad. It is **not committed**
  unless the step is worked out a second time, at which point it goes into
  `docs/automation.md` as a command (§3).

**Modifies:**

- `lib/db/schema.ts` — the `billing_refunds` table and its PaymentIntent index.
- `lib/db/billing.ts` — `recordBillingRefund` and `getRefundsForPaymentIntent`,
  mirroring `setBillingHold` and `getDisputesForPaymentIntent`.
- `app/api/stripe/webhook/route.ts` — record before reversing in the
  `refund.created` branch, key on `refund.id`, and replay recorded refunds in
  the top-up grant path before the dispute replay.
- `tests/billing-db.integration.ts` — the refund ordering case in both
  directions, and item B2's four expiry assertions.
- `tests/billing.test.ts` — **only if** a pure function changes.
  `revocableCreditsForRefund` is not expected to, so the expected diff here is
  empty; say so if it stays empty rather than padding it.
- `docs/backend.md` — a prompt 029 section: the schema change, the refund
  ordering fix, what the test clock did and did not prove, the expiry
  assertions, and the carried-forward list reduced to the two commercial rules
  plus what is still not deployed.
- `docs/automation.md` — only if a step here is worked out a second time.

**Must not touch:** `app/(marketing)/**`, `components/sections/**`,
`components/brand/**`, `components/motion/**`, `app/globals.css`,
`design-system.md`, `lib/z.ts`, `lib/billing/catalog.ts`'s prices and credit
values, `reverse_purchase_credits` and `grant_purchase_credits` themselves, the
committed migrations `0007` to `0010`, and every prompt file below 029.

## Verification

Item A must be proved **in both directions**, as 028's was:

- A refund arriving **before** its grant: the reversal is stranded today, and
  after the fix the grant path's replay writes it.
- A refund arriving **after** its grant: unchanged behaviour, still exactly one
  reversal.
- **Written exactly once in both directions**, which is the entire point of
  keying on `refund.id`.
- A **partial** refund still revokes only its proportional share in both
  directions, so the reordering did not quietly change the amount.
- Against the live sandbox where the sandbox will order it that way, and in
  `tests/billing-db.integration.ts` where it will not. **Record which direction
  was covered how** (§12 rule 3).

Item B is B1's assertions and B2's assertions above, reported separately, with
the two clocks' independence stated in `docs/backend.md` so a later session does
not try to prove the expiry with a test clock.

## Checks

Run all of them and quote the exact output (§2, §12 rule 3):

- `npm run db:generate`, then `npm run db:migrate`
- `npm run lint`
- `npm test`
- `npm run test:db`
- `npm run test:billing-db`
- `npm run build`, with its route table diffed against a baseline of `9398b8b`
  per `docs/automation.md` §"Compare a build's route table across a change"
- the prerendered `/` comparison per `docs/automation.md` §"Prove the landing
  page's output did not change", which must return `IDENTICAL`
- the environment-absent build, and confirm `.env.local` is restored afterwards
- the client-bundle secret scan, by name and by value, per
  `docs/automation.md` §"Check a secret never reached the browser"

Results go in `docs/backend.md` (§8.5). The expected `AGENTS.md` diff is
**empty**.

## SKILLS USED

- `stripe-docs` — the live-docs skill §1 step 2b prefers. For test clock
  creation and advancement, the `test_clock` parameter on `Customer`, the draft
  invoice finalisation delay, `Refund` object field guarantees, and whether
  `refund.id` is stable across a refund's lifecycle.
- `stripe:stripe-best-practices` — webhook ordering, idempotency and replay
  expectations, to check item A's design against.
- `stripe:test-cards` — `4242424242424242` for the test-clock subscription, and
  any card needed to force a refund in each direction.
- `stripe:explain-error` — for any Stripe error code the test-clock run surfaces.
- `drizzle-docs` — the new table, its index, and the generated migration.
- `zod-docs` — only if any new provider payload field needs parsing. None is
  expected: `refund.created` is already an accepted type.
- `neon-postgres` — direct versus pooled, for the migration and the read-only
  assertion scripts.
- `vercel:nextjs` — Route Handler behaviour in Next.js 16.3, read from
  `node_modules/next/dist/docs/` where a framework fact is needed.
- `claude-in-chrome` — required before any `mcp__claude-in-chrome__*` call, only
  if a direction of item A has to be forced through hosted Checkout.
- `vercel:marketplace` — **expected use is none.** No new provider is in scope.
