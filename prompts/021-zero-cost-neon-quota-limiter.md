# 021 - Zero-cost Neon quota limiter

## Scope, and why it is next

**Build step 9, quotas and real rate limiting, revised to use the existing Neon
database instead of a paid Redis integration.** Replace the generation action's
non-atomic indexed count with a concurrency-safe PostgreSQL reservation
function, preserve the existing 20-image rolling-hour account cap, protect the
shared Cloudflare Workers AI daily neuron allocation, record every accepted
reservation in `usage_events`, and add an owner-scoped usage reading to
`/account`.

This prompt supersedes the unexecuted
`prompts/020-quotas-and-real-rate-limiting.md`. Prompt 020 remains unchanged as
the record of the first intention. Its provisioning checkpoint proved that the
only Upstash Redis Marketplace plans currently offered by Vercel are billable.
The user then explicitly required a completely free alternative, so adding
Upstash, `@upstash/redis`, or `@upstash/ratelimit` is no longer approved.

This is still the next build step because phase one and build steps 5 through 8
are committed, while the generation action still contains the temporary step 9
upgrade comment and `countRecentGenerationsForUser` check. Step 10 depends on a
real quota boundary, so moderation must not start first.

The alternative creates no provider resource, package, secret, or new billing
relationship. It uses the already-connected Neon database and therefore adds
no separate service charge. This is not a claim of unlimited free capacity:
Neon's live pricing page describes a bounded $0 Free plan, and the Vercel CLI
does not expose the connected resource's plan. The implementation must not
claim that the existing database can exceed its current plan allowance without
cost.

## Reference material read for this prompt

- `AGENTS.md` - §1 workflow, §2 checks, §4 prompt contract, §5.2 build step 9,
  §5.3 metering, §6 data boundary, §7 provider rules, §8 standing backend
  rules, §9 `usage_event`, §10 write path, §11 authorization, and §12
  anti-fabrication.
- `design-system.md` - §1 foundations, §2.8 application shell, §3 motion, §5
  skill constraints, and §6 non-negotiables.
- `docs/backend.md` - schema and migration history, query boundary, generation
  action, verified Workers AI model behavior and costs, environment variables,
  routes, user data, and verification records.
- `docs/automation.md` - direct read-only database checks, route comparison,
  environment-absent build, landing HTML comparison, client secret scan, and
  owner-boundary procedure.
- `app/(app)/generate/actions.ts`, `app/(app)/account/page.tsx`,
  `lib/ai/catalog.ts`, `lib/db/index.ts`, `lib/db/queries.ts`,
  `lib/db/schema.ts`, and all committed migrations and migration metadata.
- Next.js 16.3 local documentation at
  `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`,
  `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, and
  `node_modules/next/dist/docs/01-app/02-guides/forms.md`.
- Installed `@neondatabase/serverless` and `drizzle-orm/neon-http`
  declarations. The Neon HTTP driver supports one-shot queries and
  non-interactive transactions. Drizzle's Neon HTTP `db.transaction()` method
  is not an interactive transaction surface, so the implementation must not
  invent one.
- Neon's official serverless-driver documentation, fetched 2026-08-13, which
  confirms HTTP one-shot transactions and reserves WebSockets for interactive
  transactions:
  `https://neon.com/docs/serverless/serverless-driver`.
- Neon's official connection-pooling documentation, fetched 2026-08-13, which
  says PgBouncer transaction mode does not support session-level advisory
  locks. This design uses a transaction-level advisory lock only:
  `https://neon.com/docs/connect/connection-pooling`.
- PostgreSQL's official advisory-lock documentation, fetched 2026-08-13, which
  defines `pg_advisory_xact_lock` as an exclusive lock released at transaction
  end: `https://www.postgresql.org/docs/current/explicit-locking.html` and
  `https://www.postgresql.org/docs/current/functions-admin.html`.
- Neon's official pricing page, fetched 2026-08-13. It describes the Free plan
  as $0 with no card and finite compute and storage allowances:
  `https://neon.com/pricing`.
- The live Vercel CLI on 2026-08-13. `vercel integration list` showed the
  existing available resource `neon-gray-anchor`; it exposed no plan name.
  `vercel integration add upstash/upstash-kv --help` showed only billable
  Redis plans, starting with pay-as-you-go command pricing.

No installed skill covers Drizzle, PostgreSQL function authoring, Cloudflare
Workers AI, Clerk, Zod, or Next.js 16 directly. Use installed declarations,
local Next.js docs, and official live provider documentation for those
surfaces. Do not substitute remembered tutorial syntax.

## Design read and measurements

Reading this as a preserve-mode extension of Ether's signed-in studio console
for working creatives, with the existing dark technical language and token
system. The dials remain **variance 4, motion 1, density 5**.

`design-taste-frontend` excludes dense product UI, so its landing-page layout
defaults do not govern `/account`. Its preserve-mode, copy, accessibility,
theme, shape, and anti-fabrication checks still apply. `design-system.md` is
binding.

The account extension uses existing measurements only:

- `Container` and `--container`, never `--container-wide`;
- the existing account H1 role,
  `text-[clamp(36px,7vw,64px)] leading-[1.2]`;
- 15px on 26px explanatory copy, existing 12px uppercase labels, and existing
  real-result number roles;
- the 4px spacing scale and one `--line` hairline between identity and usage;
- existing color and radius tokens only;
- a strict single-column mobile reading order below `sm`;
- no new card, shadow, icon, z-index, raw hex, token, or radius exception;
- no new motion, so `design-system.md` §3 gains no row.

Every rendered usage number comes from an owner-filtered database query. When
the database read fails, render `Usage unavailable` rather than a fabricated
zero. Never expose the application's global neuron balance on `/account`.

## Implementation contract

### 1. Provider and dependency boundary

- Do not provision Upstash or any other service.
- Do not install a rate-limit package.
- Do not add an environment variable. Runtime quota work uses the existing
  lazy pooled `DATABASE_URL`; migrations use `DATABASE_URL_UNPOOLED`.
- Keep every database read and write under `lib/db/`. The Server Action calls a
  typed query-layer function and contains no SQL.
- Update the present-tense provider contract in `AGENTS.md`: build step 9 uses
  the existing Neon database, the provider table must no longer predict
  Upstash, and §8.4 must contain no placeholder Upstash variable names.

### 2. Durable usage events

Add `usage_events` through the Drizzle schema:

- `id`, UUID primary key with a database default;
- `user_id`, Clerk owner id, not null;
- `model`, validated closed-list model id, not null;
- `image_count`, accepted batch amount, not null;
- `provider_units`, exact scaled neuron reservation for the batch, not null and
  allowed to be zero for a verified zero-neuron model;
- `created_at`, timestamp with time zone, not null with `now()` default;
- an index on `(user_id, created_at desc)` for the account window and owner
  reading;
- an index on `created_at desc` only if `EXPLAIN` against the bounded global
  daily query proves it is needed. Do not add it speculatively.

Do not add a foreign key to `generations`. An accepted attempt remains spent
when provider, Blob, or row work fails, and it survives generation removal or
permanent deletion.

Use integer quota units. Before implementation, re-fetch the two live model
pages and Workers AI pricing page, then re-measure response neuron headers if a
safe live call is available. Encode the smallest documented exact scale that
represents every verified catalog cost without floating-point arithmetic. The
scale, model-unit mapping, daily ceiling, sources, and verification date belong
in `docs/backend.md`.

### 3. Atomic PostgreSQL reservation function

Generate the next Drizzle migration for `usage_events`, inspect it, then append
one reviewed PostgreSQL function to that same migration. Drizzle remains the
only migration owner; do not run ad hoc DDL outside the migration.

The function is the concurrency boundary:

- accept only server-derived owner id plus already-validated model, image
  count, and integer provider units;
- acquire one Ether-namespaced **transaction-level** advisory lock before any
  quota read. Do not use a session-level lock, because the pooled application
  connection cannot preserve session state;
- use one global lock for the short check-and-insert transaction. This
  serializes reservations across instances without holding a lock during the
  model call;
- compute the account's exact rolling-hour spend from `usage_events`, including
  removed and failed generations;
- compute the account-wide provider spend from the current Cloudflare UTC day;
- reject the whole batch when adding its image count would exceed the account
  cap, or when adding its nonzero provider units would exceed the verified
  daily ceiling;
- skip only the provider-capacity comparison for a model with verified zero
  neuron cost. The account image cap still applies;
- insert exactly one usage event only when both checks pass;
- return a small typed outcome containing `accepted`, `account_limit`, or
  `provider_capacity`, plus owner-window used, remaining, and a real reset time
  when derivable from stored events;
- calculate a rejected batch's retry time from real event timestamps. Do not
  return a guessed duration;
- expose no prompt, email, Blob URL, raw database error, or other owner's data.

The lock, both reads, decision, and event insert must occur inside the database
function's transaction. A concurrent test must prove that accepted batches
cannot collectively cross either ceiling. A crash after the reservation but
before the model call may conservatively consume quota; record that tradeoff in
`docs/backend.md`.

The migration must also add `npm run db:migrate` as
`dotenv -e .env.local -- drizzle-kit migrate`. Apply it through the existing
direct connection and update the command lists in `AGENTS.md` and `README.md`.
Do not use `db:push` for this migration.

### 4. Query-layer API

Create `lib/db/quotas.ts` with `import "server-only"` and typed wrappers for:

- reserving one validated generation batch by calling the database function;
- reading one owner's current rolling-hour usage and bounded durable usage
  summary for `/account` without mutating quota.

The owner id is present in every owner read predicate. The account snapshot
must not acquire the global reservation lock, insert an event, or return the
application-wide remaining capacity.

Delete `countRecentGenerationsForUser` and its comments only after no importer
remains. Keep `countGenerationsForUser`, which measures live inventory rather
than spend.

### 5. Generation action

Keep this exact order in `generateGeneration`:

1. await Clerk auth and reject anonymous use;
2. validate prompt, model, size, count, and publication with the existing
   shared schema;
3. resolve integer quota cost from the closed model catalog;
4. atomically reserve account and provider capacity through `lib/db/quotas.ts`;
5. only after an accepted result enter the existing sequential model, Blob,
   generation-row, and revalidation flow.

The database function inserts the durable usage event as part of step 4, so
there is no second event write that can drift from the quota decision.

Return existing discriminated action results with plain copy:

- account limit: state that the account reached its current generation limit,
  with a retry time only when the database returned a real timestamp;
- provider capacity: state that the generator's daily capacity was reached;
- database or malformed result: state that usage could not be checked and ask
  the user to try again shortly.

Database errors fail closed. No model call follows an unverified quota result.
Do not expose ceilings, neuron arithmetic, lock keys, SQL errors, or another
account's usage. Preserve the existing sequential generation and
partial-success behavior after reservation.

### 6. `/account` usage reading

Keep `/account` as a Server Component. After `requireUserId()` resolves, start
`currentUser()`, inventory count, and owner usage summary together and await
them with `Promise.all`.

Retain Email, Joined, and Images. Add one usage group below an existing
hairline that reports:

- images used and remaining in the current rolling-hour window;
- the real window reset time when available;
- the owner's accepted image count and provider units for the current usage
  period, in plain product language.

The page must not show the application's global remaining provider capacity.
If the owner usage read fails, render `Usage unavailable`; do not substitute
zero. Add no Client Component, polling, chart, progress bar, motion, or new
interaction.

### 7. Documentation

Update `docs/backend.md` with:

- why Prompt 020 was superseded and no Redis resource exists;
- the no-new-cost Neon boundary and the finite-plan caveat;
- `usage_events` column types and actual indexes;
- the migration and PostgreSQL function signature;
- advisory-lock scope, rolling and UTC-day windows, integer unit scale,
  failure policy, and conservative crash case;
- the generation action order and account reading;
- exact verification output and anything not run.

Extend `design-system.md` §2.8 with the measured account usage group. Add no
motion row. Update `README.md` only for the migration command; there are no new
environment variables. Update `AGENTS.md` only to correct the provider and
command contracts, not to store build-record detail.

## Render impact

- **`/account` - deliberate visible change.** It remains a protected dynamic
  Server Component and gains an owner-scoped usage reading.
- **`/generate` - action behavior changes, initial layout does not.** It remains
  protected and dynamic. The existing status region carries quota failures.
- **`/` - output and render mode must stay identical.** This work does not
  modify its data source, markup, settled components, tokens, or motion.
- **`/g/[id]`, `/library`, `/community`, auth routes, and every marketing route
  - unchanged.** Verify this with the built route table.

No route, Route Handler, cache setting, or runtime setting is added.

## Trust boundary

The browser still sends only `prompt`, `model`, `size`, `count`, and `publish`
as `FormData`. The action treats every field as hostile, derives the Clerk owner
id from the server session, and validates the existing closed lists before the
quota function runs. The browser never supplies an owner id, quota key, cost,
ceiling, reset timestamp, or provider balance.

The PostgreSQL function receives only server-derived and validated values. It
serializes reservations inside the database transaction, inserts the usage
event only for an accepted batch, and returns a bounded typed decision. The
query layer maps database errors to a fixed unavailable result; raw SQL and
database detail never cross into the action result.

`/account` accepts no payload. It re-reads the session and filters the usage
summary on that owner inside `lib/db/quotas.ts`.

## Secrets and data

- No new secret or environment variable is introduced.
- Runtime quota reads use existing server-only `DATABASE_URL`; migration and
  verification use existing `DATABASE_URL_UNPOOLED`.
- Existing Clerk, Blob, and Cloudflare variables keep their current boundary.
- Neon stores the raw Clerk owner id, validated model id, accepted image count,
  scaled provider units, and timestamp in `usage_events`.
- No prompt, email, Blob URL, provider error, IP address, browser fingerprint,
  or request body enters `usage_events`.
- Logs contain fixed messages and sanitized error names only. Never log an
  owner id, prompt, email, row id, lock key, SQL body, or environment value.

## Files

Expected creates:

- `lib/db/quotas.ts`
- the next generated `drizzle/NNNN-*.sql` migration and matching metadata

Expected modifications:

- `app/(app)/generate/actions.ts`
- `app/(app)/account/page.tsx`
- `lib/ai/catalog.ts`
- `lib/db/schema.ts`
- `lib/db/queries.ts`
- `package.json`
- `README.md`
- `AGENTS.md`
- `design-system.md`
- `docs/backend.md`

`package-lock.json` should not change because no package is added. Modify
another file only when installed declarations or a failed check proves it
necessary, and record why.

Must not touch:

- `app/(marketing)/page.tsx`
- `app/globals.css`
- `components/motion/`, `components/brand/`, `components/sections/`, and
  settled landing `components/ui/` surfaces
- `components/app/GeneratorWorkspace.tsx` unless the existing action-state
  type requires a compile-only adjustment with no rendered change
- `proxy.ts`, `lib/z.ts`, storage helpers, visibility, sharing, library,
  deletion, and public-gallery code
- existing migrations

Delete only the obsolete recent-generation quota query and its imports and
comments. Delete no row, Blob, integration, or provider resource.

## Non-goals

- No Redis, Upstash, Vercel Marketplace provisioning, KV store, external rate
  limiter, or paid plan.
- No unlimited-capacity claim. The existing Neon and Cloudflare free
  allocations remain finite.
- No billing, credits, tiers, account plans, or payment method.
- No moderation, report flow, or takedown state. Those remain build step 10.
- No account export, defaults, or deletion. Those remain build step 11.
- No anonymous or IP-based limiter. Anonymous users cannot generate.
- No client-side quota enforcement, polling, dashboard, chart, progress bar,
  analytics product, or new route.
- No separate API server, Route Handler, Worker, Durable Object, or second
  database.
- No mock, in-memory fallback, or continued non-atomic count presented as a
  completed limiter.

## Checks and completion record

Run and report exact output. Record any check not run and why.

### Before implementation

1. Re-read this approved prompt and load every skill under `SKILLS USED`.
2. Re-read the relevant local Next.js docs and installed Neon and Drizzle
   declarations.
3. Re-fetch official Neon connection, pooling, pricing, PostgreSQL advisory
   lock, and Cloudflare model and pricing pages.
4. Verify the current schema and migration journal before generating anything.

### Migration and static checks

1. `npm run db:generate`, then inspect the SQL and snapshot. Append only the
   reviewed quota function. Stop on a destructive statement or unrelated diff.
2. `npm run db:migrate` through `DATABASE_URL_UNPOOLED`.
3. Use `docs/automation.md`'s direct read-only procedure to verify table
   columns, defaults, indexes, and the exact function signature.
4. Run `EXPLAIN` for the owner rolling-window and global UTC-day reads without
   selecting user data. Add the global time index only if the plan proves it is
   needed, then regenerate and review the migration before applying.
5. `npm run lint`.
6. `node_modules/.bin/tsc --noEmit`. Do not invent a typecheck script.
7. `git diff --check` and a visible-copy audit for em-dashes, en-dashes used as
   separators, exclamation marks, invented figures, hype, raw hex, and
   arbitrary z-index values.

### Quota behavior

Use synthetic owner ids and clean all rows in `finally`. Print booleans,
limits, remaining amounts, and reset validity only. Never print an owner id,
prompt, row id, model request, Blob URL, SQL body, or secret.

Verify:

- a count of 1 consumes one account unit and a count of 4 consumes four;
- a batch that would cross the rolling cap is rejected before any model call;
- concurrent reservations cannot collectively pass the account cap;
- concurrent reservations from different owners cannot collectively pass the
  global provider ceiling;
- a verified zero-neuron model does not consume provider capacity but still
  consumes account image capacity;
- the charged model consumes the exact scaled cost multiplied by count;
- a rejected reservation inserts no usage event;
- a database failure and malformed function result fail closed;
- the read-only owner snapshot mutates nothing;
- two owners receive isolated usage summaries;
- removed and permanently deleted generations do not alter usage;
- every synthetic usage event is deleted in cleanup and an aggregate follow-up
  proves none remain.

If a reusable signed-in browser session exists, make one real generation and
verify `/account` changes consistently. If not, mark that check not run and
exercise the action's database boundary without forging Clerk authentication.

### Build, routes, landing, and secrets

1. `npm run build` with the environment present.
2. Run the documented environment-absent build and restore `.env.local` even
   on failure.
3. Compare route tables before and after. `/account` and `/generate` remain
   dynamic, `/` remains static, and no route is added.
4. Compare `/`'s prerendered HTML through the documented normalization. It must
   be identical.
5. Search `.next/static/` for `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED`, and for their actual values without printing the
   values. Value hits must be zero; inspect every name-only hit.
6. Confirm anonymous `/generate` and `/account` requests remain Clerk-gated and
   `/` remains public.

Record the completed backend result in `docs/backend.md` and the account visual
contract in `design-system.md`. Update `docs/automation.md` only if this work
solves a repeated manual procedure for the second time. Commit Prompt 020,
Prompt 021, and the complete executed change to `main`; do not push.

## SKILLS USED

- `neon` - keep the quota boundary inside the existing Neon backend and verify
  current free-plan and serverless-driver constraints from official sources.
- `neon-postgres` - guide the Drizzle migration, direct-versus-pooled
  connections, transaction-level advisory locking, schema verification, and
  scale-to-zero behavior.
- `design-taste-frontend` - apply preserve-mode, copy, accessibility, theme,
  shape, and anti-fabrication checks to the account extension only; its
  landing-page layout defaults remain out of scope.
- `frontend-design` - keep the usage reading specific to Ether's existing
  studio-console language and describe database concepts in plain user-facing
  terms.
- `vercel-react-best-practices` - keep `/account` server-rendered, parallelize
  independent reads, authenticate the Server Action, and avoid new client
  JavaScript or serialization.
