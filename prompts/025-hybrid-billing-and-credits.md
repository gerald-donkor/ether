# 025 - Hybrid billing and credits

## Scope, and why it is next

Build step 12 of `AGENTS.md` section 5.2: **billing and credits**, using the
user-approved hybrid commercial model: recurring subscription credits plus
optional prepaid top-ups.

It is next because repository files and `git log` show steps 1 through 11 are
built and committed. The latest backend sequence commits are `2e1441e` for
atomic quotas, `02c4afa` for moderation, and `2fb7ea4` for account and data
rights. `prompts/024-feature-media-pill-lockups.md` is a later visual correction,
not a missing backend step. Step 12 was gated as a phase-three business decision;
the user explicitly approved the hybrid model before this prompt was written.

This prompt does **not** invent the commercial numbers that decision did not
supply. Execution begins with the decision checkpoint below and writes no app
code until it is resolved.

## Mandatory commercial decision checkpoint

Before provisioning Stripe or writing code, present one compact table and ask
the user to approve all of these real business values:

- billing currency;
- each recurring product's name, billing interval, price, and credits granted;
- each one-time top-up product's name, price, and credits granted;
- whether recurring credits expire at renewal or roll over, and any rollover
  cap;
- the credit cost of each closed model in `lib/ai/catalog.ts`;
- whether a failed, refused, moderated, or partially successful generation
  consumes credits, including the per-image rule for a partial success;
- whether a free allowance remains, and its exact grant and renewal rule;
- the refund and cancellation effect on already granted or already spent
  credits;
- the countries or regions in which Ether will sell at launch, so Stripe Tax
  registrations can be decided rather than merely toggling `automatic_tax`.

No placeholder price, trial, discount, allowance, credit ratio, expiry period,
or conversion rate may enter code, fixtures, tests, UI copy, Stripe metadata, or
documentation. If the user does not supply a value, stop at this checkpoint.

## Provider resolution and provisioning gate

Stripe is the required provider for this prompt. The installed official
`marketplace` skill selects Stripe for subscriptions and pay buttons without a
storefront catalog, and the official Stripe skill selects Billing plus hosted
Checkout for subscriptions and Checkout Sessions for one-time payments.

At execution time:

1. Run `vercel integration categories` and
   `vercel integration discover --category payments` again. These are read-only.
2. Confirm Stripe remains the relevant result. If live discovery disagrees,
   stop and report the discrepancy rather than silently changing providers.
3. Run `vercel integration add <stripe-name> --help` and read the exact options.
4. Show the exact resource, environment targets, plan or mode, and whether it is
   billable. Ask the user before `vercel integration add` because provisioning
   creates an external resource and billing relationship.
5. Provision the Stripe **sandbox/test** integration first. If Vercel or Stripe
   hands off to a browser, stop and ask the user to finish it.
6. Run `vercel env pull .env.local --yes`, inspect variable **names only**, and
   build against the names Vercel actually creates. Never predict them here.
7. Do not enable live payments, create live-mode products or prices, or copy
   sandbox identifiers into production without a separate explicit approval.

Prompt preparation verified on 2026-08-14 that `vercel env ls` contains no
Stripe variable names. `vercel integration categories` and `integration list`
were network-blocked in the local sandbox, so execution must repeat them in a
network-capable context. No Stripe resource was created while writing this
prompt.

## Reference material read for this prompt

- `AGENTS.md`: workflow; sections 5.2 step 12, 6, 7.2 through 7.5, 8, 9, 10,
  11, and 12.
- `design-system.md`: sections 1, 2.8, 3, and 6. `/account` is the existing
  account and usage surface; all site tokens and visual invariants remain
  binding.
- `docs/backend.md`: schema, quota reservation, generation ordering,
  moderation accounting, account deletion, verification history, and current
  provider boundaries.
- `docs/automation.md`: route-table comparison, environment-absent build,
  database inspection, and client-bundle secret scan.
- Source read: `lib/db/schema.ts`, `lib/db/quotas.ts`, `lib/ai/catalog.ts`,
  `app/(app)/generate/actions.ts`, `app/(app)/generate/page.tsx`,
  `app/(app)/account/page.tsx`, `app/(app)/account/actions.ts`, `proxy.ts`, and
  `package.json`.
- Next.js 16.3 local docs in `node_modules/next/dist/docs/`, including Route
  Handlers, Server Actions, forms, authentication, and environment variables.
- Clerk's current bundled `clerk-nextjs-patterns` skill in
  `node_modules/next/dist/docs/.agents/skills/`, including its Server Action and
  API-route references.
- Installed skills and their required references: `stripe-best-practices`
  billing, payments, security, and tax; `marketplace`; `env-vars`;
  `vercel-functions`; `next-best-practices`; `drizzle`;
  `drizzle-migrations`; `neon`; `neon-postgres`; `zod-4`; `tailwind-4`;
  `design-taste-frontend`; `frontend-design`; and
  `vercel-react-best-practices`.

## What this prompt builds

### 1. Stripe boundary

Add exactly one server-only Stripe module under `lib/billing/`. It constructs
the provider client lazily inside a function so the environment-absent build
still passes. No Stripe secret, webhook secret, customer id, subscription id,
Checkout Session id, or Price id enters a Client Component.

Use Stripe-hosted Checkout Sessions for both paths:

- `mode: "subscription"` for the recurring product;
- `mode: "payment"` for prepaid top-ups.

Omit `payment_method_types` so Stripe's configured dynamic payment methods are
used. Use Stripe's Customer Portal for subscription cancellation and payment
method management. Do not build card fields, renewal loops, invoices, proration,
or a custom payment-method UI.

The application owns no editable price list. After the commercial checkpoint,
create distinct Stripe Products for distinct recurring plans and top-up packs,
with immutable Prices. Store the user-approved credit grant and product kind in
closed, validated Stripe metadata. App code carries only allowlisted Price ids
or a server-read, tagged catalog. It never accepts an arbitrary Price id,
Product id, amount, currency, credit grant, success URL, or cancel URL from the
browser.

### 2. Local billing state and append-only credit ledger

Clerk remains the identity source. Do not create a `users` table. Add billing
application state keyed by the server-derived Clerk id:

- `billing_customers`: one owner to one Stripe Customer, with created and
  updated timestamps;
- `billing_subscriptions`: Stripe subscription identity, allowlisted Price,
  closed lifecycle status, current period bounds, cancel-at-period-end state,
  and provider timestamps;
- `credit_ledger`: append-only integer deltas with a closed reason enum, Stripe
  event or Checkout reference where applicable, generation reservation
  reference where applicable, created timestamp, and idempotency constraints;
- `billing_webhook_events`: Stripe event id, type, processing state, attempt
  timestamps, and an error **name/category only**, never the raw payload.

The exact SQL column types, indexes, foreign-key actions, and check constraints
are designed during execution, generated through the repository's existing
Drizzle workflow, read before application, and recorded in `docs/backend.md`.
Required invariants:

- monetary amounts are provider-owned integer minor units and never floats;
- credits are integers and no accepted debit can make the available balance
  negative;
- every provider event is idempotent by Stripe event id;
- every purchase grant is idempotent by its provider object;
- each generation reservation/debit is idempotent by an application-owned
  operation id;
- ledger rows are never updated or deleted to alter a balance. Reversals are
  new compensating rows;
- subscription and top-up grants are derived from allowlisted server-side
  catalog metadata, never from client fields or an untrusted webhook metadata
  value alone;
- account deletion removes the Stripe Customer only after local billing state
  has been reconciled according to the user-approved cancellation/refund rule.

The balance read is a sum of the ledger inside `lib/db/`. A PostgreSQL function
or one locked transaction must atomically reserve credits and enforce the
balance check. Follow the existing `reserve_generation_quota` advisory-lock
pattern where it applies, and verify the Neon HTTP driver's real transaction
capability from installed code before choosing the mechanism.

### 3. Generation write path

Extend the existing generation ordering without weakening either current
ceiling:

1. session;
2. shared Zod validation;
3. resolve the model and its approved credit cost from the closed catalog;
4. atomically reserve credits and the existing hourly/provider quota before
   any moderation or model call;
5. perform prompt moderation, image generation, output moderation, Blob writes,
   and row writes in the existing order;
6. settle or compensate the reserved credits according to the approved
   failure and partial-success policy;
7. revalidate only the surfaces whose data changed.

The existing hourly image limit remains abuse protection. The provider daily
units ceiling remains capacity protection. A positive credit balance bypasses
neither. Conversely, reaching the old hourly limit must not erase or refund a
credit balance.

The implementation must explicitly solve crash recovery between credit
reservation and generation completion. A reservation cannot remain permanently
stranded because a function terminated, and a retry cannot debit twice. Prefer
a durable reservation state and a bounded reconciliation operation over an
in-memory timeout. If this requires a scheduled job or a provider capability
not already provisioned, stop and apply the new skill/provider rule before
adding it.

### 4. Checkout, portal, and webhook request paths

App-owned mutations remain Server Actions:

- `startSubscriptionCheckout`;
- `startTopUpCheckout`;
- `openBillingPortal`.

Each action begins with `await auth()`, validates one closed catalog key with a
shared Zod schema, resolves the owner-to-customer mapping server-side, creates
the Stripe session server-side, and returns or redirects only to an HTTPS Stripe
URL returned by Stripe. The browser never supplies an amount or redirect URL.

The Stripe webhook is the required external-caller Route Handler at
`app/api/stripe/webhook/route.ts`, Node.js runtime and dynamic. It must:

- read the raw request body before any JSON parsing;
- verify the Stripe signature against the actual provisioned signing-secret
  variable;
- reject missing or invalid signatures with a non-2xx response;
- persist and claim event ids idempotently before applying a grant or reversal;
- handle only the minimal event set required by the chosen Checkout,
  subscription, refund, dispute, cancellation, and portal flows;
- return success for verified, already-processed events;
- log event id, type, and error name only. Never log the request body, Stripe
  object, customer email, Clerk id, prompt, or secret;
- tolerate duplicate delivery and out-of-order events without double credit or
  regressing subscription state.

Checkout success pages are acknowledgements, not authority. They may tell the
user that payment is being confirmed, but only a verified webhook grants or
reverses credits.

### 5. Account billing surface

Extend `/account` with one billing group below current generation usage and
above data rights. It shows only real database and Stripe catalog values:

- available credits;
- current subscription status and renewal/expiry wording when one exists;
- approved recurring offers and top-up packs;
- a manage-billing control that opens the Stripe Customer Portal;
- a mounted, announced result state when Checkout or the portal is unavailable.

This is not a pricing landing page and not a dashboard redesign. Reuse the
existing `/account` section family: `border-line mt-12 border-t pt-8`, the
22px/30px heading role, 12px uppercase labels, 15px/26px explanatory copy,
existing pill controls, and the global lime focus ring. Lime remains an action;
violet identifies; no new palette, radius, z-index, or motion enters.

Do not display an invented savings claim, popularity badge, customer count,
percentage, or price comparison. Currency and amounts come from Stripe's real
Price objects and are formatted server-side.

## Stripe Tax

The commercial checkpoint must include launch regions and tax registrations.
Enable `automatic_tax` only after the user confirms Stripe Tax registration for
the jurisdictions in which Ether will sell. Enabling the flag without an active
registration can collect no tax without failing, so it is not a substitute for
the decision. Record the approved tax posture in `docs/backend.md`.

## Render impact

- `/account`: already dynamic. Gains the billing group and real billing reads.
- `/generate`: already dynamic. Its action adds credit reservation and
  settlement; the page may show the real balance or a handled insufficient-
  credit state without restructuring the workspace.
- `/api/stripe/webhook`: new dynamic external Route Handler.
- Any Checkout return route required by the verified Stripe flow: new dynamic
  route, named in the route-table diff after the SDK and integration are real.
- `/`: no markup or render-mode change. It must remain byte-identical.
- `/community`, `/library`, `/g/[id]`, every marketing route, auth screens, and
  the existing export handler: no render-mode change unless the approved
  commercial cancellation flow gives one of them a documented reason.

## Trust boundary

| path | input crossing the browser boundary | authorisation and validation | source of truth |
| --- | --- | --- | --- |
| subscription Checkout action | closed offer key only | `await auth()` plus shared Zod schema | allowlisted Stripe Price and metadata on the server |
| top-up Checkout action | closed pack key only | same | allowlisted Stripe Price and metadata on the server |
| portal action | no customer id | `await auth()` | server-owned customer mapping |
| generate action | existing prompt/model/size/count/publish fields | existing shared schema plus atomic balance/quota reservation | session owner, catalog credit cost, ledger balance |
| Stripe webhook | raw bytes and signature header from Stripe | verified signature, closed event parser, idempotent event claim | verified Stripe event plus server allowlist |

No client user id, customer id, subscription id, Price id, amount, currency,
credit delta, event status, success URL, or cancel URL is trusted.

## Secrets and data

- New environment-variable **names are not specified until provisioning**.
  The expected categories are a server-only Stripe API credential and webhook
  signing secret. Use the exact Vercel-created names. No new `NEXT_PUBLIC_*`
  variable is expected or permitted without a written reason.
- Stored data: Clerk owner id linked to Stripe customer id, subscription state,
  append-only credit transactions, Checkout/provider references needed for
  idempotency, and minimal webhook processing metadata.
- Stripe receives the authenticated customer's identity and payment/billing
  data needed for Checkout. It never receives prompts, image bytes, Blob URLs,
  generation content, moderation results, or Cloudflare credentials.
- Logs contain no email, customer object, request body, prompt, payment method,
  secret, or raw provider error. Event ids and error names are sufficient.
- The account export must be extended with the owner's billing and credit data,
  excluding secrets and raw webhook payloads. Account deletion must implement
  the approved subscription/customer cleanup rule and retain no local billing
  row that the user asked to erase unless law requires retention; any legal
  retention requirement must be stated before implementation rather than
  assumed.

## Non-goals

- No live-mode launch in the same approval as sandbox implementation.
- No free trial, coupon, promotion code, discount, referral credit, gift credit,
  annual plan, multiple currency, seat billing, enterprise invoice, or usage-
  based postpaid billing unless present in the approved commercial table.
- No custom card form, Payment Element, Charges API, Sources API, raw
  PaymentIntent renewal loop, or manually selected payment methods.
- No Metronome integration. This approved model is prepaid credits granted by
  subscription and one-time Checkout, not postpaid usage-based invoicing. If
  the business model changes to metered postpaid billing, stop and revisit the
  provider architecture.
- No admin billing UI, manual balance editor, or customer-support console.
- No model, provider, moderation, storage, gallery, marketing, or motion change.
- No claim that purchased credits remove the existing abuse or provider
  ceilings.

## Files

The exact file list is finalized only after Stripe provisioning exposes its
package and environment contract. Expected scope:

**Create**

- `lib/billing/**`: server-only Stripe client, closed catalog resolver, typed
  provider adapters, and reconciliation helpers.
- `lib/db/billing.ts`: all billing and ledger queries.
- `lib/validation/billing.ts`: browser-safe closed schemas and field constants.
- `app/(app)/account/billing/actions.ts`: Checkout and portal actions, or the
  smallest equivalent colocated action file.
- `app/api/stripe/webhook/route.ts`: thin verified external webhook.
- `components/app/BillingPanel.tsx`: the smallest necessary client leaf.
- generated `drizzle/0007_*.sql` and metadata, using the next actual number.
- focused environment-free parser/state tests and database integration tests as
  needed. Add script names to `package.json` only when the scripts actually
  exist.

**Modify**

- `lib/db/schema.ts`.
- `lib/db/quotas.ts` and the reservation migration/function, or a separate
  billing reservation module if that keeps each boundary clearer.
- `lib/ai/catalog.ts` only to attach the user-approved integer credit costs to
  its existing closed model registry.
- `app/(app)/generate/actions.ts`.
- `app/(app)/account/page.tsx` and `app/(app)/account/actions.ts` as required by
  billing reads and deletion.
- `app/(app)/account/export/route.ts` and `lib/db/account.ts` for export/deletion
  completeness.
- `proxy.ts` only if a new authenticated return route requires a matcher change.
- `package.json` and lockfile only for the package the provisioned integration
  and live docs require.
- `docs/backend.md`, `design-system.md` section 2.8, `README.md`, and
  `docs/automation.md` only where the implemented contract or a repeated check
  requires it.

**Must not touch**

`app/(marketing)/**`, `components/sections/**`, `components/brand/**`,
`components/motion/**`, `app/globals.css`, `lib/z.ts`, `lib/ai/generate.ts`,
`lib/ai/moderation.ts`, gallery/community queries, image assets, or the landing
page. `AGENTS.md` may change only for a genuine section 12 rule 8 correction or
a new site-wide invariant that meets its cap rule, stated before editing.

## Checks to run, and where to record them

Report exact outputs. Do not claim an unavailable check passed.

1. In Stripe sandbox, create the approved Products and immutable Prices, then
   read them back and verify amounts, currency, recurrence, active state, and
   credit metadata without printing secrets.
2. `npm run db:generate`; read the SQL; `npm run db:migrate`; run read-only
   schema, constraint, index, and function checks from `docs/automation.md`.
3. Environment-free tests for webhook parsing, allowlists, ledger settlement,
   duplicate and out-of-order events, insufficient balance, partial success,
   refund/reversal, and malformed metadata.
4. Database integration tests proving two concurrent reservations cannot
   overspend, duplicate webhooks cannot double-grant, compensations cannot
   double-refund, and one owner's balance is never visible or spendable by
   another.
5. Stripe sandbox end to end: subscription Checkout, verified webhook grant,
   one generation debit, top-up Checkout and grant, portal access, cancellation,
   refund/dispute behaviour required by the approved policy, and duplicate
   webhook replay. Use the provider's test clock where relevant; do not use
   invented production data.
6. `npm run lint`, `npm test`, `npm run test:db`, and any newly added billing
   test script.
7. `npm run build`, with route-table comparison against the pre-change build.
8. The environment-absent build with `.env.local` safely moved aside and
   restored.
9. Client-bundle scans for every Stripe secret **value**, every existing secret
   value, and the new server-only variable names as applicable. Name-only
   framework hits are distinguished from value leaks.
10. Landing HTML comparison against `main`, using `docs/automation.md`, proving
    `/` remains byte-identical.
11. Keyboard, focus, pending, success, cancellation, insufficient-credit, and
    mobile checks for the `/account` billing group and `/generate` state. If a
    reusable authenticated Clerk browser session is unavailable, state exactly
    which browser checks could not run.
12. Extend the account export verification and deletion test so billing data is
    exported and local/Stripe cleanup follows the approved policy.

Record provider choice, actual variable names, package/API version, Stripe
Products and Prices, tax posture, schema DDL, webhook events, ledger semantics,
commercial decisions, failure settlement, and all verification results in
`docs/backend.md` under `## Hybrid billing and credits, prompt 025`. Record only
the `/account` surface extension in `design-system.md` section 2.8. Never put
prices or mutable provider facts in `AGENTS.md`.

## SKILLS USED

- **`skill-installer`**: installs missing trustworthy technology skills before
  execution. Loaded while preparing this prompt.
- **`find-skills`**: searches the web/open skill ecosystem for missing coverage.
  Loaded while preparing this prompt.
- **`stripe-best-practices`**: Billing, hosted Checkout, Customer Portal,
  webhook security, dynamic payment methods, and Stripe Tax. Installed and
  loaded while preparing this prompt.
- **`marketplace`**: Stripe discovery, Vercel provisioning, and the mandatory
  resource-creation approval gate. Installed and loaded while preparing this
  prompt.
- **`env-vars`**: actual Vercel-created variable names, sensitive server-only
  values, environment scopes, and `.env.local` refresh. Installed and loaded
  while preparing this prompt.
- **`vercel-functions`**: Node.js webhook Route Handler and Vercel function
  constraints. Installed and loaded while preparing this prompt.
- **`next-best-practices`**: Next.js 16 Server Action, Route Handler, data, and
  error boundaries. Installed and loaded while preparing this prompt.
- **`clerk-nextjs-patterns`**: async Clerk auth and protected actions/routes.
  The official skill is bundled under `node_modules/next/dist/docs/.agents/`
  and was loaded while preparing this prompt.
- **`drizzle`**: type-safe schema, transactions, and query patterns. Installed
  and loaded while preparing this prompt.
- **`drizzle-migrations`**: generated migration and schema verification
  workflow. Installed and loaded while preparing this prompt. Where its generic
  migration-first advice conflicts with this repository's established
  `db:generate` workflow, the repository contract wins.
- **`neon`** and **`neon-postgres`**: Lakebase/Neon transaction, pooled runtime,
  and direct migration boundaries. Loaded while preparing this prompt.
- **`zod-4`**: closed shared request and provider-event schemas. Installed and
  loaded while preparing this prompt.
- **`tailwind-4`**: Tailwind CSS 4 token-safe account styling. Installed and
  loaded while preparing this prompt.
- **`design-taste-frontend`** and **`frontend-design`**: preserve the existing
  account layout family and avoid a templated pricing dashboard. Loaded while
  preparing this prompt.
- **`vercel-react-best-practices`**: keep billing UI a small client leaf and
  server-owned reads parallel where safe. Loaded while preparing this prompt.

An official Cloudflare skill was found on the web, but its registry installation
timed out twice at the approval layer. Prompt 025 does not change the Workers AI
API call, so execution must not touch that surface. If it becomes necessary,
retry installation of `cloudflare/skills@cloudflare` and load its Workers AI
reference before proceeding.
