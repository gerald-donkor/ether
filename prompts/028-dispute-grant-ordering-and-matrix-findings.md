# 028 — Dispute and grant ordering, and the rest of the prompt 027 findings

## Scope, and why it is next

Prompt 027 closed the Stripe activation gate and ran the sandbox matrix
(`988e041`, corrected in `c7e7c3c`). It left four things open on purpose, three
because they needed a decision and one because the only real fix needed a schema
change that 027 put out of scope. On 2026-08-14 the user asked for all of them,
at the recommended option for each.

This is the follow-through. It is not new product surface: every item is a
defect or a decision that prompt 027 demonstrated against the live sandbox.

**One item is deliberately not changed** and is carried forward as a question,
because changing it would alter a recorded commercial rule. See non-goals.

## Reference material read while writing this

| source | what it supplied |
| --- | --- |
| `docs/backend.md` §"Stripe activation and the provider matrix, prompt 027" | the four open items, the observed timeline, and what was already ruled out |
| `pg_proc.prosrc` for `reverse_purchase_credits` and `grant_purchase_credits`, read 2026-08-14 | the exact reason the race is silent, and the dedupe key both paths would share |
| `app/api/stripe/webhook/route.ts` | the two `setBillingHold` call sites and the top-up grant path |
| `lib/db/billing.ts:261` | `setBillingHold`'s current three-argument shape |
| `tests/billing-db.integration.ts:52-56` | the duplicate-reversal assertion passes the same key twice, so it does not depend on that key being an `event.id` |
| `app/(app)/account/billing/actions.ts` | every Checkout Session this app creates carries `metadata.ether_offer_key`, which is what makes item 2 possible |
| `app/(app)/account/page.tsx:182` | where the subscription line renders, for item 4 |

### The mechanism, quoted rather than described

`reverse_purchase_credits` is silent in the race for one specific reason:

```
SELECT * INTO "v_grant" FROM credit_ledger WHERE stripe_object_id = "p_object_id"
  AND reason IN ('subscription_grant','top_up_grant') FOR UPDATE;
IF NOT FOUND THEN RETURN 0; END IF;
```

No grant, no reversal, no error, and the caller returns the owner id so the event
is marked `processed` and never revisited.

Its idempotency is:

```
IF "v_revoke" > 0 AND NOT EXISTS (SELECT 1 FROM credit_ledger WHERE stripe_event_id = "p_event_id")
```

**That is the hinge of item 1.** The dedupe key is whatever the caller passes.
If both the dispute handler and a replay from the grant path pass the *same*
stable key, the reversal happens exactly once regardless of which arrives first,
with no new function and no change to this function's body.

## Item 1 — a dispute delivered before its grant must still revoke

**The defect, as measured on 2026-08-14.** `charge.dispute.created` processed at
11:45:03.003 and wrote no `dispute_reversal` because the grant did not exist yet;
`checkout.session.completed` wrote `top_up_grant +100` at 11:45:03.741. The owner
kept 100 credits for a charged-back payment. The ledger ended at 339 where the
recorded rule wants 239.

**Recommended fix, and why this one.** Make the dispute durable against the
PaymentIntent, and make the grant path replay it.

1. Migration: `billing_holds` gains `stripe_payment_intent_id text`, nullable,
   indexed. Nullable because the one existing row predates it, and a backfill of
   a single dev row is not worth a data migration.
2. **The dispute reversal is keyed on `dispute.id`, not `event.id`.** This is the
   load-bearing change. `du_…` is a stable provider object id that both the
   dispute handler and the grant-path replay can derive, so
   `reverse_purchase_credits`'s existing `stripe_event_id` dedupe makes the two
   paths idempotent against each other for free. Keyed on `event.id` they cannot
   be, because the grant path does not have the dispute's event id.
   `charge.dispute.closed` keeps setting the hold inactive and still writes no
   ledger row, so it needs no key.
3. The top-up grant path, after `grantPurchaseCredits` succeeds, looks up any
   recorded dispute for that PaymentIntent and calls the same reversal. A
   no-dispute lookup is one indexed query on a table with almost no rows.
4. `setBillingHold` takes the PaymentIntent id. The `charge.dispute.closed`
   branch passes it too, so a dispute first seen at close is still recorded.

**Scoped to top-up grants only, deliberately.** Correction 2 keys subscription
grants on the invoice id, and the recorded policy scopes reversal to the
associated top-up, so a dispute on a subscription invoice finds no grant by
design. That is existing recorded behaviour, not something this prompt changes.

**The residual window, stated rather than hidden.** If the dispute row is written
between the grant's insert and the grant path's replay lookup, the replay still
finds it, because the lookup happens after the grant. If the dispute arrives
before the *grant path even starts*, the row is there and the replay finds it.
The only remaining gap is a dispute recorded after the replay lookup and never
followed by another dispute event, which cannot happen: the dispute handler
always attempts its own reversal after recording, and by then the grant exists.

## Item 2 — a foreign Checkout Session must not answer 500

**Recommended fix: tell "not ours" apart from "ours and broken", and answer each
correctly.** Every Session this app creates sets
`metadata: { ether_offer_key: offer.key }` in
`app/(app)/account/billing/actions.ts`. A `stripe trigger` session has no such
metadata.

- Session lacking a valid `ether_offer_key` in its own metadata: **200, ignored,
  no work.** It is not ours, and the current 500 makes Stripe retry something
  that will never succeed.
- Session carrying our marker whose customer this database does not know:
  **still 500.** That is a genuine misconfiguration, such as the webhook pointed
  at the wrong sandbox, and swallowing it is exactly what should not happen.

This keeps the misconfiguration signal that made the blanket-200 option
unattractive, and needs no schema change. Validate the marker with the existing
`BILLING_OFFER_KEYS` enum rather than a bare string check, so an unknown offer
key is treated as not ours.

## Item 3 — correct the leftover ledger state

The dev ledger sits at **338** and still contains the `+100 top_up_grant` for
disputed PaymentIntent `pi_3U4JXhBm5a4nTCBV…` (`obj` tail `jK4c7g`).

**Recommended fix: replay the real dispute event through the fixed code, rather
than hand-writing a compensating row.** `stripe events resend
evt_1U4JXjBm5a4nTCBVKzwFsz9Z` will not work on its own, because that event is
already `processed` and short-circuits at the claim. So the correction is:

1. Set that one event's `billing_webhook_events` row back to `failed`, which is
   the state `claimBillingWebhook` already reclaims immediately. This is a single
   dev-database row and it is stated here rather than done quietly.
2. Resend the dispute event. The fixed handler records the PaymentIntent and, the
   grant now existing, writes the `dispute_reversal`.
3. Assert the balance lands at **238**: 338 less the 100 revoked. The extra
   credit against 027's arithmetic is the second generation M7c ran.

This proves the fix on the exact data that exposed the defect, which a
hand-written SQL row would not.

## Item 4 — do not offer Subscribe to an active subscriber

`/account` renders `Subscribe` even when a subscription is `active`. The action
already refuses with "Manage your current subscription instead.", so this is
presentation only and never was a security issue.

**Recommended fix: render the subscribe control only when there is no
subscription in a non-terminal state**, reusing the exact status set the action
already tests, `canceled` and `incomplete_expired`, imported from one place
rather than restated. The server-side guard in the action **stays** — hiding a
control is presentation and never enforcement (§6.2, §11 rule 2).

## Non-goals

- **The per-refund proportional floor is not changed.** Many sub-credit refunds
  can each floor to zero and cumulatively return real money while revoking no
  credits. That follows directly from the recorded rule, "refunds revoke only the
  unspent proportional part", and changing it to accumulate across refunds would
  be a **new commercial rule**. It is carried forward as an open question in
  `docs/backend.md`, not decided here (§12 rule 9).
- **The dispute-won rule.** Still open, unchanged, and untouched by any item
  above.
- **The same ordering race for `refund.created`.** It has the identical `RETURN
  0` shape. It is not fixed here because a refund cannot be created before its
  payment succeeds, so the grant is normally already written, and the item 1
  machinery does not generalise to it without recording refunds too. **Named as
  a known gap, with its cause, rather than left to be rediscovered.**
- Live mode, Production, a Dashboard endpoint, and
  `STRIPE_WEBHOOK_SECRET` in the Vercel project. Unchanged from 027.
- The two-account browser boundary. Still blocked for the same reason.
- Any change to the landing page, the design system, or any marketing route.

## Render impact

**None expected, and it must be verified, not assumed.** No route's output or
render mode changes: `/api/stripe/webhook` is already `force-dynamic` and
Node.js, and `/account` is already dynamic. Item 4 changes what `/account`
renders for a signed-in subscriber, which is a dynamic per-user route and not a
prerendered one. `/` must come back `IDENTICAL`.

## Trust boundary

Unchanged in shape. The webhook still verifies `stripe-signature`, still rejects
`livemode`, still ignores unmodelled types with 200, and still claims each event
before work. Item 2 **narrows** what the handler acts on by requiring our own
metadata marker before it treats a Session as a purchase, which is a tightening.
Item 1 adds no request path. Item 4 removes a control from a page and changes no
authorisation: the action's own check is untouched.

## Secrets and data

- **Reads:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`, and
  `DATABASE_URL_UNPOOLED` for the assertion scripts. No new variable.
- **Writes:** one new nullable column holding a Stripe PaymentIntent id, which
  is a provider object reference and not user content.
- **Stores:** nothing new about a person. No prompt, no email address, no
  `image_url` in any output.
- The client-bundle secret scan is re-run by name and by value.

## Files

**Creates:** one Drizzle migration under `drizzle/`, generated by
`npm run db:generate`, never hand-numbered.

**Modifies:**

- `lib/db/schema.ts` — the one new column and its index.
- `lib/db/billing.ts` — `setBillingHold` takes the PaymentIntent id; a lookup for
  a recorded dispute by PaymentIntent.
- `app/api/stripe/webhook/route.ts` — items 1 and 2.
- `app/(app)/account/page.tsx` and/or the billing panel component — item 4,
  presentation only.
- `lib/validation/billing.ts` or `lib/billing/events.ts` — only if item 2's
  marker check or item 4's status set genuinely belongs in one of them rather
  than at the call site.
- `tests/billing.test.ts` and `tests/billing-db.integration.ts` — the ordering
  case in both directions, and the foreign-session case.
- `docs/backend.md` — a prompt 028 section: what changed, what was verified
  against Stripe, the corrected balance, and the two carried-forward questions.
- `docs/automation.md` — only if a step here is worked out a second time.

**Must not touch:** `app/(marketing)/**`, `components/sections/**`,
`components/brand/**`, `components/motion/**`, `app/globals.css`,
`design-system.md`, `lib/z.ts`, `lib/billing/catalog.ts`'s prices and credit
values, the committed migrations 0007 to 0009, and every prompt file below 028.

## Verification

The ordering fix must be proved **in both directions against the live sandbox**,
not only by unit test:

- A dispute arriving **before** its grant: the M7a shape, reproduced by the
  item 3 replay, ending at a balance of 238.
- A dispute arriving **after** its grant: a second top-up with
  `4000000000000259` on a card whose payment settles before the dispute, or the
  existing committed integration coverage if the sandbox will not order it that
  way. **If it cannot be forced, say so and record which direction was covered
  how** (§12 rule 3).
- The reversal is written **exactly once** in both directions, which is the whole
  point of keying on `dispute.id`.
- A foreign `stripe trigger checkout.session.completed` answers **200** with no
  grant, and a session carrying our marker with an unknown customer still
  answers 500.

## Checks

Run all of them and quote the exact output (§2, §12 rule 3):

- `npm run db:generate`, then `npm run db:migrate`
- `npm run lint`
- `npm test`
- `npm run test:db`
- `npm run test:billing-db`
- `npm run build`, with its route table diffed against a baseline of `c7e7c3c`
- the prerendered `/` comparison, which must return `IDENTICAL`
- the environment-absent build, and confirm `.env.local` is restored
- the client-bundle secret scan, by name and by value

Results go in `docs/backend.md` (§8.5). The expected `AGENTS.md` diff is
**empty**: §8.4 already lists every variable and no new one is introduced.

## SKILLS USED

- `stripe-docs` — the CLI-backed live docs, for `charge.dispute.created` and
  `charge.dispute.closed` field guarantees, whether `dispute.id` is stable across
  a dispute's lifecycle, and Checkout Session metadata behaviour. It is the
  live-docs skill §1 step 2b prefers.
- `stripe:stripe-best-practices` — webhook ordering, idempotency and replay
  expectations to check the design against.
- `stripe:explain-error` — for any Stripe error code the verification surfaces.
- `stripe:test-cards` — the dispute card, and any card that settles before it
  disputes, for the after-the-grant direction.
- `drizzle-docs` — the column addition and the migration, since a schema change
  is in scope here where it was not in 027.
- `neon-postgres` — direct versus pooled, for the migration and the read-only
  assertion scripts.
- `claude-in-chrome` — required before any `mcp__claude-in-chrome__*` call, for
  the Checkout runs and for checking item 4 on `/account`.
- `zod-docs` — only if item 2's marker validation is expressed as a schema.
- `vercel:nextjs` — Route Handler and Server Action behaviour in Next.js 16.3,
  read from `node_modules/next/dist/docs/` where a framework fact is needed.
- `web-design-guidelines` — item 4's effect on the `/account` control order and
  focus traversal.
- `vercel:marketplace` — **expected use is none.** No new provider is in scope.
