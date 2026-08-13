# 020 - Quotas and real rate limiting

## Scope, and why it is next

**Build step 9, quotas and real rate limiting.** Replace the generation
action's indexed Postgres count with an Upstash-backed distributed limiter,
preserve the existing per-account cap, protect Cloudflare Workers AI's shared
daily neuron allocation, record accepted quota spend in `usage_event`, and
make `/account` show an owner-scoped usage reading.

It is next because phase one and build steps 5 through 8 are present and
committed. This was resolved from the repository and `git log`, not from the
existence of prompt files:

- step 1 is committed at `a367b09`;
- steps 2 through 4 are committed at `4c5b9f7`, `2389ddf`, and `2b612af`;
- steps 5 through 8 are committed from `8ed5482` through `fa4747e`;
- `app/(app)/generate/actions.ts` still contains the explicit step 9 upgrade
  comment and calls `countRecentGenerationsForUser` before model work;
- `app/(app)/account/page.tsx` still shows only identity and lifetime live-image
  inventory;
- neither `@upstash/redis` nor `@upstash/ratelimit` is a direct dependency;
- the live Vercel project has Clerk and Neon integration resources only, and
  `vercel env ls` contains no Upstash-provided variable name.

Step 9 depends on step 1 and on its temporary indexed count. Both are present.
Step 10 depends on this work, so moderation must not start first.

The existing **20 images per rolling hour** is retained. It is an already
shipped product limit, not a new statistic. A request for 1, 2, or 4 images
must consume that many units in one distributed decision before the first
model call. Failed, refused, or partially successful model work does not refund
the reservation: the limiter protects attempted paid work, not the number of
rows that happen to survive storage.

The provider guard is separate. Cloudflare's verified free allocation is
10,000 neurons per day account-wide, and the default model's verified cost is
57.60 neurons for one measured 1024 x 1024 result. SDXL Lightning was measured
with `cf-ai-neurons: 0.00`. Re-fetch the pricing pages and re-measure the
response headers before execution depends on either value. Represent the
provider budget with exact integer quota units, never floating-point Redis
counters, and record the scale in `docs/backend.md`. A model whose verified
neuron cost is zero skips this neuron guard but still passes the per-account
image limiter.

## Reference material read for this prompt

Read before this file was written:

- `AGENTS.md` - §1 workflow, §2 checks, §4 prompt contract, §5.2 step 9, §5.3
  metering, §6 boundaries, §7 provider rules, §8 standing backend rules, §9
  `usage_event`, §10 write path, §11 authorization, and §12 anti-fabrication.
- `design-system.md` - §1 foundations, §2.8 application shell, §3 motion, §5
  skill constraints, §6 non-negotiables, and §7 backend record.
- `docs/backend.md` - full schema and migration history, database boundary,
  generation action, model costs and measured response behavior, routes,
  environment variables, user data, and prior verification records.
- `docs/automation.md` - read-only database queries, route-table comparison,
  environment-absent build, landing HTML comparison, secret scan, and isolated
  owner-boundary procedure.
- `app/(app)/generate/actions.ts`, `app/(app)/generate/page.tsx`,
  `app/(app)/account/page.tsx`, `app/(app)/layout.tsx`.
- `lib/ai/catalog.ts`, `lib/ai/generate.ts`, `lib/auth/index.ts`,
  `lib/db/index.ts`, `lib/db/queries.ts`, `lib/db/schema.ts`,
  `lib/validation/generation.ts`.
- `drizzle.config.ts`, all committed migrations and migration metadata,
  `package.json`, and `package-lock.json`.
- Next.js 16.3 local docs at
  `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`,
  `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, and
  `node_modules/next/dist/docs/01-app/02-guides/forms.md`.
- Upstash's live TypeScript rate-limit overview, methods, features, algorithms,
  getting-started guide, and Vercel integration guide, fetched 2026-08-13 from
  `upstash.com/docs/redis/sdks/ratelimit-ts/` and
  `upstash.com/docs/redis/howto/vercelintegration`.
- Vercel's live Marketplace storage and `vercel integration` documentation,
  fetched 2026-08-13 from `vercel.com/docs/marketplace-storage` and
  `vercel.com/docs/cli/integration`.

The live docs verify that `Ratelimit.limit(identifier, { rate })` consumes a
custom batch amount and returns `success`, `limit`, `remaining`, `reset`,
`pending`, and an optional `reason`; `getRemaining(identifier)` is read-only;
and a timeout may return `success: true` with `reason: "timeout"`. Ether must
treat that timeout reason as a failed quota check because this endpoint spends
provider capacity. The implementation must re-check the installed package
types after installation rather than copying this prompt's API shape from
memory.

No installed skill covers Upstash, Cloudflare Workers AI, Clerk, Drizzle, Zod,
Tailwind CSS 4, Vercel Marketplace provisioning, or Next.js 16 directly. The
implementation must use official live docs, local Next.js docs, and installed
package declarations for those surfaces. Do not substitute tutorial syntax.

## Provisioning checkpoint

Upstash is not currently provisioned. `vercel integration list` on 2026-08-13
returned only `clerk-byzantine-curtain` and `neon-gray-anchor`, both available.
`vercel env ls` returned no Upstash-owned variable name.

Provisioning creates an external resource and may create billing state. Prompt
approval is approval of this implementation scope, not silent permission to
provision it. During execution:

1. Run the read-only `vercel integration discover` and
   `vercel integration add upstash/redis --help` commands.
2. Report the offered plan, region choices, metadata, and whether a payment
   method or billable plan is required.
3. Ask the user for explicit approval before `vercel integration add`.
4. If the CLI hands off to a browser, stop and ask the user to finish it.
5. After connection, read the exact variable names from `vercel env ls`, pull
   `.env.local`, and verify the integration resource. Never predict a
   provider-owned name and never print a value.

If provisioning cannot be completed, stop and report the block. Do not ship a
mock limiter or keep the Postgres floor while claiming step 9 is complete.

## Design read and measurements

Reading this as a preserve-mode extension of Ether's signed-in studio console
for working creatives. It is not a redesign. The design dials are **variance
4, motion 1, density 5**: `/account` is a compact factual record, and quota
state needs clarity rather than a new visual signature.

`design-taste-frontend` explicitly excludes dense product UI, so its marketing
layout defaults do not control this surface. Its copy, accessibility, theme,
shape, and anti-fabrication checks still apply. `design-system.md` remains the
binding source.

The account change uses existing measurements only:

- `Container` and `--container`, never `--container-wide`;
- the existing account H1 role,
  `text-[clamp(36px,7vw,64px)] leading-[1.2]`;
- 15px on 26px for explanatory copy, 12px uppercase labels already present on
  the route, and existing real-result number roles;
- the 4px spacing scale and a single `--line` hairline between identity and
  usage groups;
- existing `--text`, `--text-2`, `--text-3`, `--surface`, `--surface-2`,
  `--lime`, and `--violet` tokens only;
- no new card, radius exception, raw hex, shadow, z-index level, or icon;
- a strict single-column mobile reading order below `sm`;
- no new motion. Existing link and button feedback remains the whole motion
  allowance, so `design-system.md` §3 gains no row.

The usage reading may render only values returned by the owner's live quota
snapshot or an owner-filtered database query. It must not show the global
account-wide remaining capacity because that would expose aggregate use by
other accounts. When Redis is unavailable or unconfigured, render `Usage
unavailable` in the existing plain register while keeping identity and image
inventory usable. Do not render zero, because zero would be a fabricated
measurement.

## Implementation contract

### 1. Provision and install

After the provisioning checkpoint is explicitly approved and completed:

- install `@upstash/redis` and `@upstash/ratelimit` together;
- read the installed versions and record them in `docs/backend.md`;
- read the installed declarations for `Redis`, `Ratelimit`, custom `rate`,
  timeout behavior, fixed/sliding windows, and `getRemaining`;
- use the exact environment names injected by the connected resource. If they
  do not match `Redis.fromEnv()`'s installed expectation, construct `Redis`
  explicitly from the verified names inside the lazy getter. Do not rename or
  duplicate provider variables merely to make a helper convenient.

### 2. Server-only rate-limit boundary

Create `lib/rate-limit/generation.ts` with `import "server-only"`.

- Read all Upstash environment values inside a function, never at module
  evaluation, so the environment-absent build still passes.
- Cache initialized clients or limiter objects only after that lazy read. Do
  not keep request state in module-level mutable storage.
- Hash the Clerk user id with SHA-256 before using it as an Upstash identifier.
  Upstash needs a stable opaque key, not the raw identity value.
- Give every Redis key an Ether-specific prefix so this resource can be shared
  without collisions.
- Preserve the current rolling behavior with a per-account sliding window of
  20 image units per hour. Call `limit` with the validated requested count as
  its custom rate.
- Add an account-wide fixed daily neuron-capacity limiter, keyed by one
  application constant and charged with the request's validated model cost
  multiplied by count using an exact integer scale. The ceiling and model
  costs must be re-verified before being encoded.
- Read global remaining capacity first. Then consume the per-account
  reservation, then atomically consume the global reservation. This avoids
  charging a user's hourly allowance when global capacity is already known to
  be exhausted. Document the narrow race at the global boundary: if another
  request consumes capacity between the read and reservation, the account
  reservation remains spent. Do not hide this tradeoff.
- Reject `reason: "timeout"`, missing configuration, Redis errors, and
  malformed responses with a typed `quota_unavailable` result. This is
  fail-closed: no model call follows an unverified quota state.
- Return typed outcomes that distinguish account limit, provider capacity,
  and infrastructure failure, carrying a real reset timestamp only when the
  limiter returned one. No raw Redis error reaches the client.
- Expose a read-only owner quota snapshot for `/account` using the same hashed
  identifier and limiter. The snapshot returns an unavailable state instead
  of throwing when Redis cannot be read.

Do not put rate limiting in `proxy.ts`. Proxy remains an optimistic auth gate,
and the expensive mutation must enforce its own limit after server-side auth
and validation.

### 3. Durable usage events

Add `usage_events` through Drizzle. The table records accepted quota spend,
not generated-image inventory:

- `id`, UUID primary key with a database default;
- `user_id`, Clerk owner id, not null;
- `model`, the validated model id, not null;
- `image_count`, the accepted batch amount, not null;
- `provider_units`, the exact scaled neuron reservation for the batch, not
  null and allowed to be zero for a verified zero-neuron model;
- `created_at`, timestamp with time zone, not null with `now()` default;
- an index on `(user_id, created_at desc)` for the owner usage reading, and an
  index on `created_at desc` only if the account-wide verification query proves
  it is needed. Do not add an index speculatively.

Do not add a foreign key to `generations`. Usage survives remove and permanent
delete because provider capacity was already spent, and a failed provider or
storage path may have no generation row to reference.

Add query-layer functions only under `lib/db/` to insert one accepted batch
reservation and read one owner's bounded usage summary. The owner id is always
part of the read predicate. Do not select or log event ids or owner ids during
verification.

Write the usage event after both Redis reservations succeed and before the
first model call. If the event write fails, return a handled usage-check error
and make no provider call. Redis capacity may already be consumed in that
failure case; this conservative under-use is safer than an unmetered model
call and must be recorded in `docs/backend.md`.

Generate and inspect the next Drizzle migration. Because prompt 018 established
the migration journal, add the missing `db:migrate` script as
`dotenv -e .env.local -- drizzle-kit migrate`, update the command list in
`AGENTS.md`, and apply through the direct connection. Do not use the pooled URL
for migration work and do not use schema push for this migration.

### 4. Generation action

Keep the established order in `generateGeneration`:

1. await Clerk auth and reject anonymous use;
2. validate prompt, model, size, count, and publication through the existing
   shared schema;
3. resolve the verified quota cost from the closed model catalog;
4. reserve per-account and global capacity through the server-only limiter;
5. write the accepted usage event;
6. only then enter the existing sequential model, Blob, row, and revalidation
   flow.

Delete `countRecentGenerationsForUser` and its comments only after no importer
remains. Keep `countGenerationsForUser`, which is inventory for `/account`, not
quota enforcement.

The rejection copy stays plain and actionable:

- account limit: say the account has reached its current generation limit and
  include a retry time only when the limiter returned a valid reset;
- global capacity: say the generator's daily capacity has been reached;
- limiter or event failure: say usage could not be checked and ask the user to
  try again shortly.

Do not expose configured ceiling numbers, neuron arithmetic, Upstash error
strings, hashed identifiers, or another account's usage. Keep the existing
partial-success contract and sequential generation loop unchanged after the
reservation succeeds.

### 5. `/account` usage reading

Keep `/account` as a Server Component. Start independent Clerk, inventory,
quota-snapshot, and owner-usage reads together and await them without a serial
waterfall.

Retain Email, Joined, and Images. Add a separate usage group below one existing
hairline that reports:

- generation capacity used and remaining in the current limiter window, from
  the live Upstash snapshot;
- the real reset time when present;
- the owner's accepted image count and provider units for the current usage
  period from `usage_events`, labelled in plain product language rather than
  infrastructure terminology.

If a value is unavailable, state that. Never substitute zero. Do not show the
global application's remaining neuron capacity. No Client Component, polling,
chart, progress bar, animation, or new interaction is needed.

### 6. Documentation and environment contract

Update `docs/backend.md` with the installed package versions, exact provider
variable names, resource name and plan, limiter algorithms and prefixes,
hashing boundary, integer quota scale, failure policy, `usage_events` column
types and indexes, migration, action order, account reading, measured reset
behavior, and verification results.

Extend `design-system.md` §2.8 with the account usage group and its measured
layout. Add no §3 motion row.

Update `README.md` with the exact new server-only environment names and normal
local setup only after provisioning supplies them. Update `AGENTS.md` only to
correct present-tense facts: add the real provider environment names to §8.4,
mark the provider table as provisioned, and add the newly created
`npm run db:migrate` command to §2. Do not add build-record detail there.

## Render impact

- **`/account` - deliberate visible change.** It remains a protected dynamic
  Server Component and gains the owner-scoped usage reading described above.
- **`/generate` - action behavior changes, initial layout does not.** It remains
  protected and dynamic. Accepted requests render through the existing result
  slots. Limit and capacity rejections use the existing accessible status
  region. No initial page markup, control, history shape, or motion changes.
- **`/` - output and render mode must stay identical.** This task does not
  modify its data source, components, tokens, or settled motion.
- **`/g/[id]`, `/library`, `/community`, auth routes, and all other marketing
  routes - unchanged.** Verify the built route table rather than assuming it.

No cache setting changes. No new route or Route Handler is created.

## Trust boundary

The browser still sends only the five existing `FormData` fields: `prompt`,
`model`, `size`, `count`, and `publish`. The action treats all five as hostile,
reads the Clerk user id from the server session, and validates the existing
closed lists before any quota or model work. A browser-supplied user id,
limiter key, cost, ceiling, or reset value is never accepted.

The server hashes the authenticated Clerk id before sending an identifier to
Upstash. The raw owner id remains in Neon because owner-scoped durable usage is
part of the existing data-layer model. Both Redis reservations and the usage
event occur before the expensive call. Every rejection is a discriminated,
handled action result; raw provider, Redis, database, and environment detail
stays server-side.

`/account` accepts no request payload. It re-reads the session, hashes that
server-derived id for the live quota snapshot, and filters the usage query on
the raw owner id inside `lib/db/queries.ts`.

## Secrets and data

- Exact Upstash environment names are unknown until provisioning and must be
  read from `vercel env ls`. Every one is server-only. None may use a
  `NEXT_PUBLIC_*` name or enter a client module.
- Existing `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, Clerk, Blob, and Cloudflare
  variables keep their current boundaries.
- Upstash receives a SHA-256 digest of the Clerk user id, the Ether key prefix,
  requested image units, and aggregate provider quota units. It receives no
  prompt, email, model prompt body, generation id, Blob URL, or raw Clerk id.
- Neon stores the raw Clerk owner id, validated model id, requested image count,
  reserved provider units, and timestamp in `usage_events`. It stores no
  prompt, email, Redis token, reset value, or provider error in that table.
- Logs use fixed strings plus sanitized error names where needed. Never log a
  prompt, owner id, hashed identifier, email, request body, environment value,
  or Redis key.

## Files

Expected creates:

- `lib/rate-limit/generation.ts`
- the next generated `drizzle/NNNN-*.sql` migration and matching
  `drizzle/meta/*` files

Expected modifications:

- `app/(app)/generate/actions.ts`
- `app/(app)/account/page.tsx`
- `lib/ai/catalog.ts`
- `lib/db/schema.ts`
- `lib/db/queries.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `AGENTS.md`
- `design-system.md`
- `docs/backend.md`

Modify another file only when installed declarations or a failed check proves
it necessary, and record why.

Must not touch:

- `app/(marketing)/page.tsx`
- `app/globals.css`
- `components/motion/`, `components/brand/`, `components/sections/`, and
  settled landing `components/ui/` surfaces
- `components/app/GeneratorWorkspace.tsx` unless the existing action-state type
  requires a compile-only adjustment with no rendered change
- `proxy.ts`, `lib/z.ts`, storage helpers, generation visibility, library,
  sharing, deletion, or public-gallery code
- existing migrations

Delete only the obsolete recent-count query and its imports/comments after the
Upstash path is complete. Delete no user data, Blob, Redis database, or
integration resource.

## Non-goals

- No billing, credits, paid tier, plan selector, or account tier. Those remain
  phase-three decisions.
- No moderation, report flow, takedown state, or admin role. Those are step 10.
- No account export, defaults, or deletion. Those are step 11.
- No IP-based anonymous limiter. Anonymous users cannot generate, and the
  authenticated Clerk account is the authorization and quota identity.
- No client-side quota enforcement, polling, analytics dashboard, chart,
  progress bar, toast system, or new route.
- No Redis caching of generations or user records. Upstash is used only for
  quota enforcement in this step.
- No silently chosen paid provider plan and no temporary in-memory fallback.

## Checks and completion record

Run and report exact output. A check not run is recorded as not run with its
reason.

### Before implementation

1. Re-read this approved prompt and load every skill in `SKILLS USED`.
2. Re-read relevant local Next.js docs and installed Clerk, Drizzle, Zod,
   Cloudflare call-site, and new Upstash declarations.
3. Re-fetch official Upstash, Vercel, and Cloudflare pricing/model pages.
4. Complete the explicit provisioning checkpoint. Read back integration and
   environment names without values.

### Static and migration checks

1. `npm run db:generate`, inspect the generated SQL and snapshot, and stop on
   any destructive statement or unrelated schema diff.
2. `npm run db:migrate` over `DATABASE_URL_UNPOOLED` after the reviewed script
   exists.
3. Use the read-only direct-Neon procedure in `docs/automation.md` to verify
   `usage_events` columns, defaults, and actual indexes.
4. `npm run lint`.
5. `node_modules/.bin/tsc --noEmit`. There is still no typecheck script unless
   this prompt explicitly changes that fact, which it does not.
6. `git diff --check` and a copy audit for visible em-dashes, exclamation
   marks, invented figures, hype, raw hex, and new arbitrary z-index values.

### Quota behavior

Use unique synthetic hashed identifiers and an isolated Redis prefix. Print
booleans, limits, remaining counts, and reset validity only. Never print a raw
or hashed id, Redis key, token, owner id, prompt, or environment value.

Verify:

- count 1 consumes one account unit, count 4 consumes four, and an over-limit
  batch is rejected as one decision before any model call;
- concurrent requests cannot collectively pass the account cap;
- a timeout reason and a thrown Redis failure both fail closed;
- a zero-neuron verified model does not consume the global neuron budget;
- the charged model consumes its exact scaled request cost;
- the global guard rejects a request that would cross its remaining budget;
- `getRemaining` does not mutate quota;
- test keys are reset or deleted after the assertions.

Use two synthetic owners in Neon to prove each usage summary is owner-filtered,
removed generations do not affect usage, and permanent generation deletion
cannot delete a usage event. Clean all synthetic rows in `finally` and print
aggregate cleanup counts only.

If a real signed-in browser session is available, submit one existing-model
generation and verify the account usage reading changes consistently. If no
session is available, record the browser check as not run and exercise the
server-only limiter and query boundaries directly without forging Clerk auth.

### Build, routes, and secrets

1. `npm run build` with the environment present.
2. Run the documented environment-absent build and restore `.env.local` even
   when the build fails. The lazy Redis boundary must let this pass.
3. Compare the route table before and after. `/account` and `/generate` remain
   dynamic, `/` remains static, and no route is added.
4. Compare `/`'s prerendered HTML through the documented normalization. It must
   be identical.
5. Search `.next/static/` for every exact new environment variable name and
   for its actual value without printing the value. Both must have zero value
   hits; inspect and explain any name-only hit.
6. Confirm an anonymous `/generate` and `/account` request remains Clerk-gated
   while `/` remains public.

Record the completed backend result in `docs/backend.md` and the account visual
contract in `design-system.md`. Update `docs/automation.md` only if this work
solves a repeated manual procedure for the second time. Commit the complete
executed prompt to `main` and do not push.

## SKILLS USED

- `neon` - route the database work to the correct Lakebase Postgres workflow
  and preserve the project's existing provider boundaries.
- `neon-postgres` - guide the Drizzle migration, pooled runtime versus direct
  migration connection, schema verification, and scale-to-zero behavior.
- `design-taste-frontend` - apply its preserve-mode, copy, accessibility,
  theme, shape, and anti-fabrication checks only where they fit the account
  surface; its marketing layout defaults are out of scope.
- `frontend-design` - keep the usage reading specific to Ether's existing
  studio-console language and use plain user-facing vocabulary.
- `vercel-react-best-practices` - keep `/account` server-rendered, parallelize
  independent reads, isolate server-only secrets, and avoid unnecessary client
  JavaScript or serialization.
