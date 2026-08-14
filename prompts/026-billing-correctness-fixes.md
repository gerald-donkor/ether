# 026 - Billing correctness fixes and latest-docs verification

## Scope, and why it is next

Six defects found reviewing the committed implementation of
`prompts/025-hybrid-billing-and-credits.md` (`668cbc7`), plus the skill and
documentation-currency rule the user added to `AGENTS.md` in this session.
Nothing new is designed here. The credit ledger, the Stripe boundary, the
schema and the account surface stay exactly as 025 built them; this prompt
corrects the places where the implementation is wrong, silently under-recovers
money, or lies to the user.

**Why it is next.** Build steps 1 through 12 are committed. Steps 13 and 14 are
gated phase-three decisions. A shipped billing path with a known credit-recovery
bug and a webhook that can retry-storm is the highest-value work available, and
it blocks the activation gate `docs/backend.md` already records.

**Why it is not part of 025.** 025 is committed. `AGENTS.md` section 4 forbids
overwriting or reusing a prompt number; the correction is its own numbered
prompt.

## The defects, and the fix for each

Each is stated as the observable failure, not as a preference.

### 1. `getPurchaseGrantCredits` can read a reversal row as if it were the grant

`lib/db/billing.ts`. The query selects one `credit_ledger` row by
`stripe_object_id` with no reason filter and no ordering. `reverse_purchase_credits`
writes `stripe_object_id` onto its compensating rows too, and the partial unique
index `credit_ledger_purchase_object_idx` covers only the three grant reasons, so
several rows can share one object id.

**Failure:** on a second partial refund against one PaymentIntent, the query can
return the earlier reversal's negative delta. `maximum` in the webhook then goes
negative and `Math.max(1, maximum)` revokes exactly one credit instead of the
proportional amount. Money is under-recovered, silently.

**Fix:** filter the query to `reason in ('subscription_grant', 'top_up_grant')`,
which the partial unique index already guarantees is at most one row.

### 2. A subscription invoice with no PaymentIntent retry-storms and never grants

`app/api/stripe/webhook/route.ts`, the `invoice.paid` branch. It lists invoice
payments, takes the default payment's PaymentIntent, and throws
`Missing invoice PaymentIntent` when there is none. The throw returns 500, so
Stripe retries the same event for up to three days and the credits never land.

**Verified against live documentation this session** (2026-08-14,
`https://docs.stripe.com/billing/subscriptions/webhooks`): the documented rule is
"Sent when the invoice is successfully paid. You can provision access to your
product when you receive this event and the subscription `status` is `active`."
Nothing in that guidance involves a PaymentIntent, and an invoice can be settled
out of band or from the customer's credit balance. `Stripe.Invoice.id` is a
required `string` in the installed `stripe@22.5.0`
(`node_modules/stripe/esm/resources/Invoices.d.ts`), so it is always available as
an idempotency key.

**Fix:** key the subscription grant on the **invoice id**, not the PaymentIntent,
and drop the lookup and the throw. Grant only when the synced subscription status
is one the docs call provisionable (`active` or `trialing`); any other status
syncs the subscription row and grants nothing, which is a handled outcome and a
200, not a retry.

**Consequence to state, not to hide:** top-up grants stay keyed on the
PaymentIntent, so `refund.created` against a *subscription* invoice finds no
grant and reverses nothing. That matches the approved policy recorded in
`docs/backend.md`, which scopes refund reversal to "the associated top-up". No
new commercial rule is invented here.

### 3. A disputed account is told it has no credits

`drizzle` function `reserve_generation_capacity` returns `insufficient_credits`
with `credits_remaining = 0` when a `billing_holds` row is active, and
`app/(app)/generate/actions.ts` renders "You do not have enough credits for this
request." Meanwhile `/account` shows the owner's real, positive balance.

**Failure:** the two surfaces contradict each other and the message is untrue.
That is an §8.2 rule 4 problem: the failure is visible but not honest.

**Fix:** a distinct `billing_hold` outcome from the function, a distinct branch in
the action, and one plain sentence telling the user their account is on hold while
a payment dispute is open and that existing images are unaffected. No em-dash, no
apology, register per section 5. `credits_remaining` for that branch reports the
real balance rather than zero.

### 4. A refund too small to cost a credit still costs a credit

`Math.max(1, maximum)` in the `refund.created` branch. A refund whose
proportional share floors to zero revokes one credit anyway, which contradicts
the recorded "only the unspent proportional part" rule.

**Fix:** drop the floor to `Math.max(0, maximum)` and skip the reversal call
entirely at zero. `reverse_purchase_credits` already rejects a non-positive
maximum, so the guard belongs in the caller.

### 5. Env-free test coverage does not match what 025's checks claimed

`tests/billing.test.ts` covers three Zod schemas. 025's check 3 asked for
env-free tests of webhook parsing, allowlists, ledger settlement, duplicate and
out-of-order events, insufficient balance, partial success, refund reversal and
malformed metadata. The out-of-order guard (`setWhere` on
`upsertBillingSubscription`) and the refund proportional maths have no test at
all.

**Fix:** extract the two pure decisions currently inline in the webhook - the
refund's revocable amount, and whether an event's subscription status is
provisionable - into `lib/billing/events.ts`, and test them env-free along with
the closed status mapping. Extend `tests/billing-db.integration.ts` with the
out-of-order subscription update and the hold outcome. `npm test` gains
`--conditions=react-server` so an env-free test may import a `server-only`
module, exactly as `test:db` already does.

### 6. `BillingPanel` copies the pill class strings that 024 just centralised

`components/app/BillingPanel.tsx` hand-writes `bg-lime text-ink rounded-pill
inline-flex …` and the ghost equivalent. One commit earlier, prompt 024 extracted
`pillShape` and `pillGhostSurface` in `components/ui/Button.tsx` precisely so a
second copy could not drift.

**Fix:** export the pressable half and the primary surface alongside the two
existing halves and compose all three buttons from them. **`Button`'s rendered
class list must stay byte identical**, exactly as 024 required, because
`/g/[id]` depends on it. This is a `<button>` in a form, so it keeps the hover
and press response; only the duplication goes.

## The latest-documentation rule this prompt executes under

`AGENTS.md` section 1 step 2b was added in this session at the user's explicit
request and is binding here. Every Stripe surface this prompt touches is
verified against the live documentation or the installed `.d.ts` **during
execution**, not from this file and not from memory, and what was checked plus
the date goes in `docs/backend.md`.

Skills installed this session to satisfy section 1 step 2a, all recorded in
`skills-lock.json`:

- `stripe/ai@stripe-docs` - live Stripe documentation lookup, which is the
  current-docs source step 2b now prefers over a static skill.
- `clerk/skills@clerk-webhooks` and `clerk/skills@clerk-nextjs-patterns` - the
  **official** Clerk skills. 025 used the copy bundled inside
  `node_modules/next/dist/docs/.agents/`, which is a vendored snapshot.

Searched and **not** installed: no official PostgreSQL or plpgsql agent skill
exists. The candidates found are community repositories
(`wshobson/agents`, `Jeffallan/claude-skills`, `farmage/opencode-skills`) and one
`github/awesome-copilot` entry whose install did not resolve. Per step 2a the
result is stated rather than papered over: plpgsql work here is verified against
`neon-postgres` and the official PostgreSQL documentation.

## Reference material read for this prompt

- `prompts/025-hybrid-billing-and-credits.md`, in full.
- `docs/backend.md`, section "Hybrid billing and credits, prompt 025" - the
  approved commercial rules, which this prompt does not change.
- Committed source: `lib/db/billing.ts`, `lib/billing/{stripe,catalog,customer}.ts`,
  `lib/validation/billing.ts`, `app/api/stripe/webhook/route.ts`,
  `app/(app)/account/billing/actions.ts`, `app/(app)/generate/actions.ts`,
  `components/app/BillingPanel.tsx`, `components/ui/Button.tsx`,
  `drizzle/0007_stiff_luke_cage.sql`, `drizzle/0008_nosy_doctor_octopus.sql`.
- `node_modules/stripe/esm/resources/{Invoices,Refunds,Disputes,Events}.d.ts` -
  `Invoice.id` required, `Refund.payment_intent` nullable, `Dispute.status` a
  closed union, `refund.created` a real event type in 22.5.0.
- `https://docs.stripe.com/billing/subscriptions/webhooks`, fetched 2026-08-14.
- `AGENTS.md` sections 1, 6.2, 6.3, 8.2, 8.3, 8.4, 10, 12.
- `design-system.md` sections 1.1, 2.2, 2.8, 6.

## Render impact

- `/account` - unchanged markup except that `BillingPanel`'s three buttons are
  composed from the shared pill halves. **Their rendered class lists must be
  identical to what they render today**, verified by string comparison, so the
  painted output does not move.
- `/generate` - one new failure branch renders one new sentence. No layout
  change, no new element, the existing result slot.
- `/g/[id]` - must not change. `Button` is shared and the export is the risk.
- `/` - byte-identical. Verified with the landing HTML comparison in
  `docs/automation.md`.
- `/api/stripe/webhook` - same route, same runtime, corrected handler.
- No route is added or removed and no render mode moves.

## Trust boundary

Unchanged from 025 in shape. No new input crosses the browser boundary: the
three actions still accept only a closed offer key, the webhook still accepts
only a signature-verified event, and the generate action's fields are untouched.
The one change is that a verified webhook now grants on a narrower condition
(provisionable subscription status) and reverses on a corrected amount. A
rejected request returns exactly what it returns today.

## Secrets and data

No new environment variable. No change to what is stored, logged or transmitted.
The `billing_hold` branch adds one user-facing sentence and no new log line; the
existing rule that logs carry event id, type and error name only still holds.
`STRIPE_WEBHOOK_SECRET` remains unset in this workspace, which is the activation
gate below.

## Non-goals

- **No commercial change.** No price, credit grant, allowance, expiry rule,
  refund policy or tax posture moves. Every number stays as `docs/backend.md`
  records it.
- **No live mode**, no Production credentials, no new Stripe Product or Price.
- **No restoring credits on a dispute won.** The approved policy does not say to,
  and inventing it here would be a fabricated commercial rule. Flag it for the
  user instead.
- **No redesign of `/account`**, no pricing page, no new component.
- **No change to the moderation, model, storage, gallery or marketing surfaces.**
- **No new provider, package or service.**
- No rewrite of the ledger, the reservation model or the quota functions beyond
  the one new outcome value.

## Files

**Modify**

- `lib/db/billing.ts` - defect 1's reason filter; the `billing_hold` outcome in
  `CapacityReservation` and its parser.
- `app/api/stripe/webhook/route.ts` - defects 2 and 4; calls into the extracted
  helpers.
- `app/(app)/generate/actions.ts` - defect 3's branch and its sentence.
- `components/ui/Button.tsx` - export the pressable half and the primary surface.
  Rendered output unchanged.
- `components/app/BillingPanel.tsx` - compose from those exports.
- `package.json` - `test` gains `--conditions=react-server`.
- `tests/billing.test.ts`, `tests/billing-db.integration.ts` - the new coverage.
- `docs/backend.md` - the corrections, what was verified against which document
  on which date, and the revised activation gate.
- `README.md` only if a script description changes.

**Create**

- `lib/billing/events.ts` - the two pure decisions, `server-only`, no
  environment read.
- `drizzle/0009_*.sql` and its metadata, generated by `npm run db:generate`,
  replacing `reserve_generation_capacity` with the `billing_hold` outcome. The
  actual number is whatever the tool produces.

**Delete** - none.

**Must not touch** - `app/(marketing)/**`, `components/sections/**`,
`components/brand/**`, `components/motion/**`, `app/globals.css`, `lib/z.ts`,
`lib/ai/generate.ts`, `lib/ai/moderation.ts`, `lib/ai/catalog.ts`,
`lib/storage/**`, `proxy.ts`, the gallery and community queries, and every
migration already applied. `AGENTS.md` is already edited for this session's rule
and needs nothing further.

## Checks to run, and where to record them

Report exact output. Do not claim an unavailable check passed.

1. `npm run db:generate`, read the generated SQL, `npm run db:migrate`, then the
   read-only function and constraint inspection from `docs/automation.md`.
2. `npm run lint`.
3. `npm test` - including the new env-free cases.
4. `npm run test:db` and `npm run test:billing-db`, with the new out-of-order and
   hold assertions.
5. `npm run build`, and a route-table diff against the pre-change build. It must
   be unchanged.
6. The environment-absent build from `docs/automation.md`, with `.env.local`
   restored and confirmed afterwards.
7. The landing HTML comparison from `docs/automation.md`, proving `/` is
   byte-identical.
8. String comparison of `Button`'s rendered class lists for both variants against
   the current build, and of `BillingPanel`'s three buttons, so defect 6's fix
   moves no pixel.
9. Client-bundle scan for the Stripe secret value and the other server-only
   secret values.
10. **The activation gate.** The Stripe CLI is **not installed in this
    workspace** (`which stripe` returns nothing) and `STRIPE_WEBHOOK_SECRET` is
    unset, so the sandbox end-to-end matrix still cannot run. Attempt it only if
    the user installs the CLI and completes its browser login; otherwise report
    which checks could not run, exactly as 025 did, rather than narrowing the
    claim. Do not create a webhook destination pointing at a URL that does not
    serve this commit.

**Where the result is recorded:** `docs/backend.md`, extending the prompt 025
section with a prompt 026 subsection - the corrected behaviour, the documents and
types checked with dates, and the unchanged activation gate. `design-system.md`
only if the pill-class extraction changes anything section 2.2 or 2.8 states.
Nothing goes in `AGENTS.md`.

## SKILLS USED

- **`stripe-docs`** - live Stripe documentation. The current-docs source for
  `invoice.paid` provisioning, refund and dispute event semantics, and Checkout
  and Portal options. Installed this session.
- **`stripe-best-practices`** - Billing, webhook security, idempotency and
  reversal patterns. Already installed.
- **`clerk-webhooks`** - official Clerk webhook skill, for the verified-external-
  caller pattern the Stripe route follows. Installed this session.
- **`clerk-nextjs-patterns`** - official Clerk skill for async `auth()` in Server
  Actions. Installed this session, replacing the vendored snapshot 025 used.
- **`next-best-practices`** - Next.js 16 Route Handler, Server Action and error
  boundaries.
- **`vercel-functions`** - Node.js runtime constraints on the webhook handler.
- **`drizzle`** and **`drizzle-migrations`** - schema and generated-migration
  workflow. Where their generic advice conflicts with this repository's
  `db:generate` contract, the repository wins.
- **`neon`** and **`neon-postgres`** - transaction, advisory-lock and pooled
  versus direct connection boundaries for the replaced function.
- **`zod-4`** - the closed schemas in `lib/validation/billing.ts`.
- **`tailwind-4`** - token-safe classes for the pill extraction.
- **`design-taste-frontend`** and **`frontend-design`** - the account surface
  stays the existing family; no pricing dashboard appears.
- **`vercel-react-best-practices`** - `BillingPanel` stays a small client leaf.
- **`web-design-guidelines`** - the new hold message is announced and legible
  without colour.

**No skill covers plpgsql**, and the search result is recorded above. The
function replacement is verified against `neon-postgres` and the official
PostgreSQL documentation fetched at execution time, per section 1 step 2b.
