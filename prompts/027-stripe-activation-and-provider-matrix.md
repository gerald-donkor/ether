# 027 — Stripe activation, and the provider end-to-end matrix

## Scope, and why it is next

Build steps 1 through 12 are committed. `git log` shows `a367b09`, `4c5b9f7`,
`2389ddf`, `2b612af`, `8ed5482`, `754ddbf`, `813c477`, `ed8e75b`, `fa4747e`,
`2e1441e`, `02c4afa`, `2fb7ea4`, `668cbc7` and `1965829`; no `href="#"` remains
in `app/` or `components/`. Everything left in AGENTS.md §5.2 is phase three and
gated on a decision, so there is no unblocked build step to write.

What there is instead is an activation gate that the repository itself records
as open. `docs/backend.md` §"The activation gate is unchanged" states that
`which stripe` returns nothing, that `STRIPE_WEBHOOK_SECRET` is absent from
`.env.local`, and that **no Checkout, webhook delivery, portal, cancellation,
refund, dispute or duplicate-replay check has ever run against Stripe.** Both
committed billing prompts, 025 and 026, are argued from live documentation, the
installed types and the database — never from a delivered event. That is
money-handling code, on a path that grants and revokes credits, which has never
been executed by the provider that drives it.

**This prompt closes that gate.** It installs the Stripe CLI, obtains a signing
secret, runs the full sandbox matrix against the local dev server, records every
result in `docs/backend.md`, and fixes only the defects the matrix actually
proves. The user selected this scope over step 13, step 14 and the dispute-won
rule on 2026-08-14.

It is a verification prompt. **The expected code diff is empty**, and an empty
diff is a successful outcome, not a failed one.

## Reference material read while writing this

| source | what it supplied |
| --- | --- |
| `docs/backend.md` §1613–1874 (prompts 025 and 026) | the commercial contract, the catalog ids, the ledger reasons, the six corrections, and the open gate this prompt closes |
| `app/api/stripe/webhook/route.ts` | every handled event type and its exact failure mode |
| `app/(app)/account/billing/actions.ts`, `lib/billing/customer.ts` | the three account actions, the origin guard, and the Customer idempotency key |
| `package.json` | `stripe` 22.5.0, and the four existing test scripts |
| `docs/automation.md` §"Read the database read-only from a script", §"Check a secret never reached the browser" | the exact incantations this prompt's assertions reuse |
| `https://docs.stripe.com/webhooks/quickstart.md`, fetched 2026-08-14 | `npm install -g @stripe/cli`; `stripe listen --forward-to`; the signing secret comes from the `stripe listen` output; `stripe trigger` simulates events |
| `https://docs.stripe.com/stripe-cli.md`, fetched 2026-08-14 | `--api-key` is a global flag that overrides local configuration for one-off commands; `stripe listen` needs no Dashboard endpoint and **its signing secret does not change between restarts**; `--print-secret` prints it and exits; the complete `stripe trigger` event list |
| `https://docs.stripe.com/testing.md`, fetched 2026-08-14 | `4242424242424242` succeeds; `4000000000000259` succeeds and is then disputed as fraudulent |

**The `stripe-docs` skill could not be used to fetch any of this.** It requires
the CLI, which is not installed; the pages above were fetched directly, which is
the fallback the skill's own precondition leaves. Once step S1 installs the CLI,
**every further documentation lookup in this prompt uses `stripe docs`**, and
the prompt records which route each fact came from.

## Two facts that shape the matrix, and are not assumptions

1. **`stripe trigger` cannot produce `refund.created` or
   `charge.dispute.closed`.** The complete supported list on
   `docs.stripe.com/stripe-cli.md` contains `charge.dispute.created`,
   `charge.refunded` and `charge.refund.updated`, and none of the other two.
   Those two events are therefore produced by acting on **real objects** created
   by real Checkout Sessions, not by a trigger.
2. **`stripe trigger` objects belong to customers this database has never
   seen.** `ownerFor` in the webhook throws `Unknown Stripe customer` for them.
   That makes triggers useful only as negative tests. **Every positive test in
   the matrix is driven through the application's own Checkout**, so the
   Customer, the PaymentIntent and the ledger row all belong to a real signed-in
   owner.

## Prerequisites the user must supply

State these before starting, and stop if any is refused.

- **Two Clerk test identities**, or one and an explicit "one is enough". M11 is
  skipped and recorded as skipped if only one exists. `docs/backend.md` already
  records that the two-account boundary could not be run at prompt 016.
- **Permission for browser automation on `localhost:3000`, `checkout.stripe.com`
  and `billing.stripe.com`**, so Checkout and the Portal can be driven with
  `mcp__claude-in-chrome__*`. If it is refused, the fallback is that the user
  completes each hosted step manually and says when it is done; the matrix still
  runs, and the prompt records which steps were human-driven.
- **Confirmation that the sandbox may be charged with test cards.** No real
  money is involved — `STRIPE_SECRET_KEY` is the sandbox key and the webhook
  rejects `event.livemode`.

## Setup

- **S1.** `npm install -g @stripe/cli`, then `stripe version`. The npm prefix is
  `/home/gdk26/.npm-global`, which is user-owned and already on `PATH`, so no
  `sudo`. Record the installed version.
- **S2.** **No `stripe login`.** Every command carries
  `--api-key "$STRIPE_SECRET_KEY"`, read from `.env.local` and never echoed,
  which guarantees the commands hit the same sandbox the application does. Prove
  it before trusting it: retrieve `price_1U4GMqBm5a4nTCBVKiPHN9Fq` and confirm
  `livemode: false`, `active: true`, and lookup key `ether_studio_monthly_v1`,
  matching the catalog table in `docs/backend.md`. If the key turns out to be
  scoped in a way that refuses the CLI, stop and report it rather than falling
  back to an interactive login that could select a different account.
- **S3.** `stripe listen --api-key "$STRIPE_SECRET_KEY" --print-secret` to obtain
  the signing secret, and write it into `.env.local` as `STRIPE_WEBHOOK_SECRET`
  with a file edit. **Never print it**, never quote it, never put it in
  `docs/backend.md`. The docs say it is stable across restarts, so this is
  written once. `.env.local` is gitignored and stays that way.
- **S4.** `npm run dev` and
  `stripe listen --api-key "$STRIPE_SECRET_KEY" --forward-to http://localhost:3000/api/stripe/webhook`,
  both in the background, with their output captured to the scratchpad. The
  forwarder's per-event lines are the delivery evidence the matrix quotes.
- **S5.** A read-only assertion script in the scratchpad, built on
  `docs/automation.md` §"Read the database read-only from a script", printing
  `billing_customers`, `billing_subscriptions`, `billing_holds`,
  `billing_webhook_events`, `credit_reservations` and `credit_ledger` for one
  owner. **It never selects `prompt`, and never selects `image_url`** (§8.3
  rule 2, and the recorded `image_url` gap). It is re-run after each matrix step
  and its output diffed against the previous run, so each assertion is about
  what changed.

## The matrix

Each row states what is done, what must be true afterwards, and where the truth
is read. A row that cannot run is **recorded as not run, with the reason** —
never quietly dropped, and never described as passed (§12 rule 3).

| # | action | must be true |
| --- | --- | --- |
| M1 | Sign in, `/account`, top-up Checkout with `4242424242424242` | `checkout.session.completed` delivered and answered 200; exactly one `credit_ledger` row, `top_up_grant`, `+100`, keyed on the PaymentIntent; one `billing_webhook_events` row in the completed state; `/account` shows the new balance; the return lands on `/account?billing=confirmed` and **grants nothing by itself** |
| M2 | Resend M1's event with the CLI | 200, `{"received":true}`, **no second ledger row** and no second grant. This is the claim replay path |
| M3 | Subscription Checkout with `4242424242424242` | `customer.subscription.created` and `invoice.paid` both delivered; `billing_subscriptions` row `active` on `price_1U4GMqBm5a4nTCBVKiPHN9Fq`; one `subscription_grant` of `+200` keyed on the **invoice id**, with `expires_at` equal to the item period end. This is correction 2 executed for the first time |
| M4 | Resend an earlier `customer.subscription.updated` after a later one | the row does not regress; the provider event time guard holds; 200 either way |
| M5 | `openBillingPortal`, then cancel at period end in the Portal | redirect host is `billing.stripe.com`; `customer.subscription.updated` sets `cancel_at_period_end`; **credits stay spendable through the paid period**, checked by generating one image |
| M6a | Refund the M1 PaymentIntent by an amount whose proportional share floors to zero | `refund.created` delivered, **zero ledger rows written**. This is correction 4 |
| M6b | Then a partial refund of the same PaymentIntent | exactly one `refund_reversal` row, for the proportional unspent part, and the grant lookup still resolves the original `+100` and not the reversal row. This is correction 1's regression, executed against Stripe |
| M7a | A fresh top-up Checkout with `4000000000000259` | `charge.dispute.created` delivered; a `dispute_reversal` of the remaining grant; `billing_holds` active |
| M7b | Attempt a generation while held | `reserve_generation_capacity` returns `billing_hold` **with the real balance**, and `/generate` renders the one plain sentence. This is correction 3 |
| M7c | Close the dispute | `charge.dispute.closed` delivered; the hold clears; a generation succeeds again. **The dispute-won policy is not changed here** — the open question at the end of `docs/backend.md` stays open and is restated, not resolved |
| M8 | `POST /api/stripe/webhook` with no `stripe-signature`, then with a forged one | 400 both times, the two distinct error bodies, **and no `billing_webhook_events` row written for either** |
| M9 | `stripe trigger customer.updated` | 200, ignored by the event-type schema, no row |
| M10 | `stripe trigger checkout.session.completed` | records the **actual** outcome. The handler reaches the metadata parse and throws, so a foreign session is expected to answer 500 and be retried by Stripe for three days. If that is what happens, it is a finding, and the fix below applies |
| M11 | The second identity reads `/account` and the export | no row, balance, subscription or ledger entry from the first owner appears. Skipped and recorded if there is only one identity |
| M12 | Keyboard traversal of the `/account` billing controls | every control reachable in order, the 2px lime focus ring visible at each stop, and no layout shift when a pending state appears |

## Fixing what the matrix proves

**Only defects the matrix demonstrates may be fixed, and each fix is recorded
with the observation that caused it.** No refactor, no tidying, no change to any
commercial rule, price, grant, allowance, expiry rule, refund policy or tax
posture. If a finding needs a commercial decision — M10's retry behaviour may,
because "ignore a foreign Checkout Session with 200" is a policy as much as a
bug fix — **state it and ask rather than deciding it here** (§12 rule 9).

If the matrix passes clean, the code diff is empty and the prompt still ships:
the record, the automation entry and the environment variable are the
deliverable.

## Render impact

**None.** No route's output or render mode changes. `/api/stripe/webhook` is
already `force-dynamic` and Node.js; `/account` and `/generate` are already
dynamic. Setting `STRIPE_WEBHOOK_SECRET` in `.env.local` changes no rendering.
This is verified, not assumed: `docs/automation.md` §"Compare a build's route
table across a change" and §"Prove the landing page's output did not change" are
both run, and `/` must come back `IDENTICAL`.

## Trust boundary

Nothing new crosses it. The matrix exercises the boundary that already exists:
`POST /api/stripe/webhook` verifies `stripe-signature` against
`STRIPE_WEBHOOK_SECRET`, rejects `livemode`, ignores unmodelled event types with
200, claims each event before doing work, and returns 200 for a duplicate. M8 is
the explicit rejection test and M2 the explicit replay test. The three account
actions still take only an offer key, still derive the owner from Clerk, and
still accept only Stripe-hosted HTTPS return URLs — the `http://localhost:3000`
origin is admitted by the existing localhost carve-out in `origin()`, which is
worth naming because the matrix depends on it.

## Secrets and data

- **Reads:** `STRIPE_SECRET_KEY` (CLI and app), `DATABASE_URL_UNPOOLED`
  (assertion script only), and the existing Clerk, Blob, Cloudflare and database
  variables the app already reads.
- **Writes:** `STRIPE_WEBHOOK_SECRET` into gitignored `.env.local` only. It is
  never printed, never committed, never recorded in any doc.
- **Public:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` exists in the environment and
  **no application code reads it**; that stays true.
- **Stores:** nothing new. Test-mode Stripe object ids, event ids and ledger
  rows are written by the existing code paths.
- **Transcript rule:** no card number beyond the two published test numbers, no
  prompt text, no email address, no `image_url`, and no secret value appears in
  any output this prompt produces.
- The client-bundle secret scan from `docs/automation.md` is re-run, and it now
  includes `STRIPE_WEBHOOK_SECRET` by name and by value.

## Non-goals

- **Live mode and Production.** Out of scope in 025 and still out of scope. The
  sandbox credentials are connected to Development and Preview only.
- **Deploying a Preview and registering a Dashboard webhook endpoint.**
  `stripe listen` needs neither, which is why this runs locally against
  `localhost:3000`. Setting `STRIPE_WEBHOOK_SECRET` in the Vercel project is a
  separate decision, taken when a deployment of this commit exists.
- **Subscription renewal and credit expiry across a period boundary.** That
  needs a test clock and a Customer created against it, which hosted Checkout
  does not give us. Named as an unclosed gap rather than faked.
- **The dispute-won rule.** Recorded as open at the end of `docs/backend.md` and
  left open.
- **Steps 13 and 14.** Phase three, unapproved.
- **Any change to the landing page, the design system, or any marketing route.**

## Files

**Creates:** nothing in the repository. The assertion script and the captured
logs live in the session scratchpad.

**Modifies:**

- `.env.local` — one added variable, gitignored, value never shown.
- `docs/backend.md` — a new section, `## Stripe activation and the provider
  matrix, prompt 027`: what the CLI reported, what each matrix row did, what was
  observed, what was not run and why, and every fix with its cause.
- `docs/automation.md` — a new section for running the sandbox matrix locally:
  the install, the `--api-key` pattern, the `listen` invocation, and the
  read-only assertion query. This is the second time a Stripe verification has
  been worked out by hand, which is exactly what §3 says to capture.
- `AGENTS.md` §8.4 — the environment table stops at Clerk and does not list any
  `STRIPE_*` variable, which contradicts `.env.local`, `README.md` lines 35–37
  and the committed billing code. Add the rows. This is §12 rule 8: the file is
  stale, and the change that notices says so.
- Application files **only** where the matrix proves a defect.

**Must not touch:** `app/(marketing)/**`, `components/sections/**`,
`components/brand/**`, `components/motion/**`, `app/globals.css`,
`design-system.md`, `lib/z.ts`, `drizzle/**` (no schema change is in scope),
`lib/billing/catalog.ts`'s prices and credit values, and every prompt file
numbered below 027.

## Checks

Run all of them and quote the exact output (§2, §12 rule 3):

- `npm run lint`
- `npm test`
- `npm run test:db`
- `npm run test:billing-db`
- `npm run build`, with its route table diffed against a baseline build of
  `1965829`
- the prerendered `/` comparison, which must return `IDENTICAL`
- the environment-absent build: `mv .env.local .env.local.bak`, build, restore,
  and confirm `.env.local` is back
- the client-bundle secret scan, extended with `STRIPE_WEBHOOK_SECRET`

Results go in `docs/backend.md` (§8.5). Nothing about this prompt's outcome is
recorded in `AGENTS.md` beyond the one index row, if the index row is earned at
all — `docs/automation.md` is already indexed, and `docs/backend.md` is already
indexed, so **the expected AGENTS.md diff is the §8.4 table rows and nothing
else.**

## SKILLS USED

- `stripe-docs` — every Stripe documentation lookup after S1 installs the CLI.
  It is the live-docs skill AGENTS.md §1 step 2b prefers over a static one.
- `stripe:stripe-best-practices` — webhook handling, idempotency and replay
  expectations to check the observed behaviour against.
- `stripe:explain-error` — for any Stripe error code the matrix surfaces, so the
  cause is read rather than guessed.
- `stripe:test-cards` — the card numbers, cross-checked against the fetched
  `testing.md`.
- `claude-in-chrome` — required before any `mcp__claude-in-chrome__*` call, for
  driving hosted Checkout, the Portal, and the M12 keyboard traversal.
- `neon-postgres` — the direct-versus-pooled connection rule for the read-only
  assertion script.
- `vercel:env-vars` — writing `STRIPE_WEBHOOK_SECRET` into `.env.local`, and the
  reasoning about what would be needed to set it in the Vercel project later.
- `vercel:nextjs` — Route Handler and Server Action behaviour in Next.js 16.3,
  read from `node_modules/next/dist/docs/` where the matrix needs a framework
  fact.
- `web-design-guidelines` — the M12 keyboard and focus pass.
- `vercel:marketplace` — only if a provisioning question arises. **No new
  provider is in scope**, so the expected use is none.
