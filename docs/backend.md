# Ether backend

This is the build record for Prompt 009. The product uses Next.js Server
Actions for its own mutations and Server Components for initial reads. There is
no separate API server and no app-owned Route Handler in this step.

## Stack and package versions

| Surface | Package | Installed version |
| --- | --- | --- |
| Identity | `@clerk/nextjs` | 7.7.4 |
| Postgres transport | `@neondatabase/serverless` | 1.1.0 |
| ORM | `drizzle-orm` | 0.45.2 |
| Migrations | `drizzle-kit` | 0.31.10 |
| Blob storage | `@vercel/blob` | 2.8.0 |
| Image model | Cloudflare Workers AI REST, called with `fetch` | no package |
| ~~AI Gateway~~ | `ai` | 7.0.64, installed but no longer imported anywhere |
| Validation | `zod` | 4.4.3 |
| Script environment loading | `dotenv-cli` | 11.0.0 |

Clerk owns identity. Ether does not duplicate users in Postgres.

## Data model

Drizzle owns the schema in `lib/db/schema.ts`. Committed migrations live under
`drizzle/` and the current schema includes prompt 018's visibility migration.

### `generations`

| Column | PostgreSQL type | Constraint or purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key, defaults to `gen_random_uuid()` |
| `user_id` | `text` | Not null, Clerk user id |
| `prompt` | `text` | Not null, the user's trimmed prompt |
| `image_url` | `text` | Not null, public Vercel Blob URL |
| `model` | `text` | Not null, the provider's model id. Holds `@cf/black-forest-labs/flux-1-schnell` from 2026-08-13; no migration was needed for the change |
| `width` | `integer` | Not null, decoded from the returned image |
| `height` | `integer` | Not null, decoded from the returned image |
| `visibility` | `generation_visibility` enum | Not null, defaults to `private`. Closed values: `private`, `unlisted`, `public` |
| `created_at` | `timestamp with time zone` | Not null, defaults to `now()` |
| `deleted_at` | `timestamp with time zone` | Nullable. The timestamp of a library removal. `NULL` means live. |

Indexes:

- `generations_pkey` on `id`.
- `generations_user_id_idx` on `user_id`.
- `generations_user_created_at_idx` on `user_id, created_at desc`.
- `generations_visibility_created_at_idx` on `visibility, created_at desc`.

The first migration was applied on 2026-08-12. A read-only query against
`pg_indexes` confirmed the table and its first three indexes.

`is_public` arrived with `drizzle/0001_tired_molten_man.sql` on 2026-08-12:

```sql
ALTER TABLE "generations" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
CREATE INDEX "generations_public_created_at_idx" ON "generations"
  USING btree ("is_public","created_at" DESC NULLS LAST);
```

The column default is what migrates every pre-existing row as private; the
migration opts nothing into public display. `drizzle-kit push` needs a TTY
because `strict` is set in `drizzle.config.ts`, so it was applied as
`dotenv -e .env.local -- drizzle-kit push --force` after both statements were
read and confirmed additive. A read-only `information_schema.columns` and
`pg_indexes` query then confirmed the type, the `false` default, `NOT NULL`,
and the new index.

`deleted_at` arrived with `drizzle/0002_natural_skin.sql` on 2026-08-13:

```sql
ALTER TABLE "generations" ADD COLUMN "deleted_at" timestamp with time zone;
```

The nullable column is the library's undo layer, not the permanent-delete
mechanism. Existing rows remain live without a backfill, and no index was
added: owner listings still enter through `generations_user_created_at_idx` on
`(user_id, created_at desc)`, then filter the narrowed rows by `deleted_at`.

Prompt 018 replaced that boolean with `generation_visibility` in
`drizzle/0003_spotty_sinister_six.sql`. The migration creates the enum and a
private-defaulted column, maps `is_public = true` to `public`, drops the old
column and index, then creates `generations_visibility_created_at_idx`.
Existing false rows remain private. The production result was 7 private rows,
0 unlisted rows and 1 public row, preserving all 8 records.

### `usage_events`

Prompt 021 adds durable accepted quota reservations. The table is deliberately
independent from `generations`: a provider, Blob, or row failure after
reservation still consumed shared capacity, and removing or permanently
deleting a generation does not refund it.

| Column | PostgreSQL type | Constraint or purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key, defaults to `gen_random_uuid()` |
| `user_id` | `text` | Not null, server-derived Clerk owner id |
| `model` | `text` | Not null, validated catalog model id |
| `image_count` | `integer` | Not null and greater than zero, accepted batch size |
| `provider_units` | `integer` | Not null and nonnegative, tenths of a neuron reserved for the batch |
| `created_at` | `timestamp with time zone` | Not null, defaults to `now()` |

Indexes are the primary key and
`usage_events_user_created_at_idx (user_id, created_at desc)`. `EXPLAIN` used
that index for the rolling owner query and used the same composite index for
the bounded UTC-day provider query. A second time-only index was therefore not
added.

`drizzle/0004_dry_sir_ram.sql` creates the table, constraints and index, then
adds
`reserve_generation_quota(text, text, integer, integer)`. The function returns
`outcome`, `owner_window_used`, `owner_window_remaining`, and a real
`reset_at` when one is derivable. Its outcomes are `accepted`,
`account_limit`, and `provider_capacity`.

The database predated Drizzle's migration journal because migrations 0000
through 0002 had been applied with schema push. Consequently the CLI migration
wrapper could not safely infer history. Prompt 018 applied migration 0003 with
Drizzle's official transactional Neon migrator against a baseline folder
containing only 0003, which both established migration history and applied the
pending SQL. Read-only checks then confirmed the enum values, private default,
`NOT NULL`, new index, and complete removal of `is_public`.

## Database boundary

`lib/db/index.ts` constructs the Drizzle client lazily through `getDb()`. The
runtime uses pooled `DATABASE_URL`; Drizzle Kit uses direct
`DATABASE_URL_UNPOOLED`. Only modules in `lib/db/` query Postgres. Every user
content read includes the Clerk owner id in the query.

Available queries:

- list the newest 24 generations for one owner;
- count all generations for one owner;
- insert one generation and return the stored row;
- list the newest public generations for the landing gallery and Community;
- read one generation by id **and** owner;
- read the consent-safe anonymous projection for one shareable generation;
- update one live generation's visibility by id **and** owner;
- delete one generation by id **and** owner, returning its id.

`lib/db/quotas.ts` is the separate quota query boundary. It calls the database
function once to reserve a validated batch and reads one owner's rolling-hour
and current-UTC-day usage for `/account`. The owner id appears in every owner
predicate. The account read takes no lock, inserts nothing, and returns no
application-wide provider balance.

### The public gallery read

`listPublicGenerations(limit)` is the only query in the codebase that does not
filter on an owner, because it filters on `visibility = 'public'` instead. Its
projection is the privacy boundary: it selects `id`, `image_url`, `width`, and
`height`, and never `user_id`, `prompt`, or `model`. It orders by `created_at
desc` and takes the `limit` the caller passes, which is the gallery's
photographic slot count counted off the component's own column data.

Cache Components is not enabled, so the documented primitive for a non-`fetch`
read applies: `unstable_cache` with the tag `public-generations` and no
`revalidate`. There is no polling interval because the strip only changes when
someone publishes, and the generation action expires the tag when they do.

`getPublicGalleryImages(limit)` wraps that cached read in the failure path. The
`try` is deliberately outside the cached function, so a database outage is
never what gets cached. A missing `DATABASE_URL` during `next build`, or a
failed read at render time, resolves to an empty array, and the gallery falls
back to its artboard images rather than throwing or rendering an empty strip.
The log line is the fixed string `The public gallery read failed.` and carries
no row, prompt, or owner.

Prompt 018 resolved the pathname privacy gap. Every stored URL now uses
`generations/<generation-uuid>.<ext>`, including all 8 pre-existing objects.
The migration moved 8 objects on its first pass, skipped all 8 on its
idempotence pass, and left 0 noncanonical URLs and 0 owner ids in URLs.

## Generation action

`app/(app)/generate/actions.ts` exports `generateGeneration`. Its browser input
is five `FormData` fields: `prompt`, `model`, `size`, `count` and `publish`.
The action:

1. reads the Clerk session and rejects an anonymous request;
2. validates all five fields together through the shared Zod schema, including
   the model-and-size pair;
3. resolves the batch's integer provider cost from the closed model catalog and
   atomically reserves owner and shared provider capacity in Neon;
4. calls Cloudflare Workers AI, once per requested image, sequentially;
5. writes each returned image's bytes to public Blob storage;
6. writes each generation row, including the validated visibility;
7. revalidates `/generate` once, when at least one row was written;
8. expires the `public-generations` tag and revalidates `/` and `/community`
   once, but only when at least one row that was written is public;
9. returns a discriminated result carrying every generation that succeeded and
   a count of the ones that did not.

The prompt must contain content after trimming and may contain at most 500
characters.

### The three controls, and partial success (prompt 015)

`model`, `size` and `count` are closed lists validated against
`lib/ai/catalog.ts`. `count` is one of `1`, `2` or `4`. The model and size are
only valid as a pair: each model declares its own sizes, and a `superRefine`
rejects a size the chosen model does not declare, before any provider call.

The quota reservation is count-aware. A request for 1, 2, or 4 images reserves
that whole batch before the first model call, so concurrent requests cannot
walk past either the rolling account limit or the shared provider ceiling.

Generation is **sequential, not parallel**: per-account concurrency on Workers
AI is unverified, and a serial loop keeps a partial failure legible.

**A request for several images can succeed in part.** Rows and blobs are
written per image as each one succeeds, and the result is:

```ts
{ ok, error, generations: GenerationResult[], failed: number }
```

`ok: true` with a non-zero `failed` is a truthful partial result, reported to
the user as such. Only a request where nothing was written is `ok: false`. The
per-image blob cleanup on a failed row insert is unchanged.

### Publication consent

`lib/validation/generation.ts` exports `generationRequestSchema`, which both
the client leaf and the action use. `publish` accepts the literal `"public"`
and nothing else; `null` and `undefined` mean private, and any other value is a
validation error. Truthiness is never consulted, so an unexpected value is
rejected rather than read as consent.

The control is one unchecked native checkbox rendered by `PromptField` under
`showPublishOption`, which only `/generate` passes. The landing page's copy of
the same component renders no checkbox and its markup is unchanged. The
checkbox's `name` and `value` are written literally in the component rather
than imported from the schema module, so the marketing bundle does not pull in
Zod; the schema module exports `PUBLISH_FIELD` and `PUBLISH_VALUE` for the
server side.

Step 8 expiry uses `updateTag`, not `revalidateTag`. `updateTag` is Server
Action only and expires immediately, which is the read-your-own-writes
behaviour this needs; the single-argument `revalidateTag` form is deprecated in
Next 16. Both were read from `node_modules/next/dist/docs` and from
`server/web/spec-extension/revalidate.js` on 2026-08-12, which confirmed that
an ASCII tag passes through `encodeCacheTag` unchanged and therefore matches
the tag `unstable_cache` stored.

There is no mutation for changing an existing generation's visibility. No
client-supplied generation id is accepted **on the generate path**; prompt 016
adds the first action that accepts one, and the rules it validates and
authorises that id against are below. The durable reservation described below
is the only generation quota decision.

Provider, Blob, and database failures become actionable client messages. Server
logs remove the user's prompt before recording error details. If the Blob write
succeeds but the database insert fails, the action attempts to delete the Blob.

## Quotas and usage reading (prompt 021)

Prompt 020 first proposed Upstash. The live Vercel Marketplace checkpoint
showed only billable Redis plans, and the user required a completely free
alternative. Prompt 021 superseded it with the already-connected Neon database.
No Redis resource, package, variable, or billing relationship exists. This
introduces no new service charge, but it does not make Neon unlimited: the
existing database remains subject to its finite plan allowances.

`reserve_generation_quota` acquires one Ether-namespaced
`pg_advisory_xact_lock` before either quota read. It is transaction-level, not
session-level, so it is compatible with the application's pooled PgBouncer
transaction mode and is released automatically at statement transaction end.
One short global critical section serializes all instances; the lock is never
held during a model call.

Inside that transaction the function:

1. sums one owner's accepted `image_count` over the exact preceding hour;
2. calculates a rejected batch's usable retry time from stored event expiries;
3. sums all `provider_units` since 00:00 UTC;
4. rejects a batch that would cross either ceiling;
5. inserts exactly one `usage_events` row only when both checks pass.

The account ceiling remains 20 accepted images per rolling hour. Provider
reservations use tenths of a neuron, the smallest integer scale that represents
both verified catalog costs. The shared daily ceiling is therefore 100,000
units. FLUX reserves 1,728 units per image from the live 172.80-neuron response
header measured on 2026-08-13. SDXL Lightning reserves zero, matching its live
`0.00` header, but still consumes account image capacity.

Database errors and malformed function results fail closed as
`quota_unavailable`; no model call follows. Account-limit copy includes a time
only when the database returned a real event-derived timestamp. Provider-limit
copy exposes neither the ceiling nor aggregate use.

A crash after acceptance but before the provider call conservatively leaves the
reservation spent. That is intentional: refunding across model, storage and row
failures would require a second distributed state machine and would weaken the
capacity boundary the reservation exists to enforce.

The counter begins with migration 0004. Calls made earlier in the same UTC day
have no durable reservation to backfill without inventing an owner, so the
first partial day can understate provider use. Cloudflare's own hard free-plan
refusal remains the final boundary for that one transition day; every accepted
application request after the migration is represented.

`/account` starts Clerk identity, live-image inventory and its owner-only usage
summary together. It reports rolling used and remaining images, the next real
window expiry, and that owner's accepted image count and compute use for the
current UTC day. A failed usage read renders `Usage unavailable`; global
remaining provider capacity is never selected or rendered.

## The generation permalink and its delete (prompt 016)

`/g/[id]` is one generation's record: the image at its own stored ratio, then
prompt, model, size, created date and visibility, then a download link and a
delete control. Prompt 016 shipped it owner-only; prompt 018's sharing section
below supersedes that access rule and layout ownership.

`app/(app)/g/[id]/page.tsx` awaits `params` (a Promise in Next 16), reads the
session through `requireUserId()` rather than trusting the proxy, parses the
segment with `generationIdSchema`, and calls `getGenerationForOwner(id,
userId)`. A failed parse and a missing row are both `notFound()`. The metadata
title is the static string `Image | Ether`: the prompt is the user's data and a
title lands in the tab, the history, and any screenshot.

**Two new queries in `lib/db/queries.ts`**, both filtering on `id` and
`user_id` together:

- `getGenerationForOwner(id, userId)` returns the row or `undefined`.
- `deleteGenerationForOwner(id, userId)` deletes and returns `{ id }`, or
  `undefined` when nothing matched.

**One new storage helper.** `generationDownloadUrl(url)` wraps `getDownloadUrl`
from `@vercel/blob`, verified on 2026-08-13 at
`node_modules/@vercel/blob/dist/create-folder-BM6BTlko.d.ts:134` with the
signature `(blobUrl: string) => string` and re-exported from the package root.
It exists because Blob is a different origin, where the `download` attribute is
ignored: the plain url answers `Content-Disposition: inline` and opens the
image, and the wrapped url answers `attachment` and saves it. Both were
measured, and the measurement is under the prompt 016 verification below.

### `deleteGeneration`, and why it is ordered the way it is

`app/(app)/g/[id]/actions.ts` follows `AGENTS.md` §10's stages:

1. read the Clerk session; no session is a typed failure;
2. parse `generationId` from `FormData` with `generationIdSchema`;
3. **no quota check**, and the omission is commented: deleting spends no
   provider money and frees storage;
4. authorise by reading the row through `getGenerationForOwner`;
5. delete the Blob object;
6. delete the row, filtering on the owner again rather than trusting stage 4;
7. `revalidatePath("/generate")`, plus `updateTag(PUBLIC_GALLERY_TAG)` and
   `revalidatePath("/")` only when the row was public;
8. `redirect("/generate")`.

**Deletion is permanent: the Blob object and the row both go.** This diverges
from `AGENTS.md` §9 rule 5, which prefers a soft delete, and from §9.1, which
schedules a soft-delete state at step 7. The user chose permanence on
2026-08-13 because a row marked deleted while its image stays fetchable at a
public Blob url is a broken promise rather than an audit trail. **Step 7's
soft-delete state is therefore an undo layer over the library, not the delete
mechanism**, and step 7's prompt has to say so.

**The Blob goes before the row, and the ordering is the privacy argument.** If
the Blob delete fails, nothing is removed, the user gets a typed failure, and
the row still renders: a recoverable state. If the Blob delete succeeds and the
row delete then fails, what is left is a row pointing at a dead url, which is a
rendering defect. Row-first would invert that into a live public url sitting
behind a success message, which is a privacy breach. The rendering defect is
the one worth taking.

**Not found and not yours return the same message**, `That image could not be
found.`, on the page and in the action. A distinct refusal would confirm that a
given id exists, which is enough to enumerate other people's generations.

**The redirect is a stated deviation from `AGENTS.md` §10 rule 5.** Rule 5
forbids redirecting on success because a navigation discards the generate
form's scroll and motion state. Here the page's entire subject ceases to exist,
so there is no slot to render a result into and staying is not an option.
`redirect()` signals by throwing, so it is called after every `try` rather than
inside one that would swallow it as a failure.

**Logging.** Every `console.error` on this path is a fixed string plus an
error name and message with the row's prompt **and its Blob url** replaced. The
url remains sensitive user data even though prompt 018 removed owner ids from
canonical pathnames.

Prompt 016 added `/g` to both proxy matchers. Prompt 018 removed it from the
protected matcher while retaining it in `config.matcher`, because optional
`auth()` still needs Clerk middleware context. `/generate`'s
history cards become links to `/g/<id>`; the card's markup gains a `Link`
wrapper and a hover colour transition on the caption, and nothing else changes.

## The generation library (prompt 017)

`/library` is a protected dynamic Server Component. It awaits its query
parameters, reads the owner through `requireUserId()`, and renders an
owner-filtered ledger. `proxy.ts` includes `/library` in both protected-route
matchers, but the page still checks its own session.

`lib/validation/library.ts` owns the `q`, `page`, and `view` query names. The
search is trimmed and capped at 500 characters, page is a positive integer up
to 500, and view is the closed `active | removed` list. Invalid or repeated URL
values fall back safely, so hand-edited URLs render the default view instead of
throwing. The native GET form retains the current view, and the shared URL
builder keeps search and paging links consistent.

The query layer now filters live rows with `deleted_at IS NULL` in
`listGenerationsForUser`, `countGenerationsForUser`,
`getGenerationForOwner`, and `listPublicGenerations`. Quota spend no longer
reads generation inventory at all; durable `usage_events` survive every
generation lifecycle state. `listLibraryPage` filters on owner and the selected
lifecycle state, escapes `\\`, `%`, and `_` before an `ilike` search, orders
newest first, and reads one extra row to determine whether an older page exists
without a second count. The `public-generations` cache tag is expired only when
a changed row was public.

`removeGeneration` and `restoreGeneration` are Server Actions in
`app/(app)/library/actions.ts`. Both authenticate with Clerk, validate the
generation UUID, authorise within an owner-filtered update, return a
discriminated result, and revalidate `/library` and `/generate`. A public row
also expires the landing gallery tag and revalidates `/`. Neither action runs a
quota check because neither spends provider money. Not-found and not-owned both
return `That image could not be found.`

`getGenerationForOwnerIncludingRemoved` is restricted to permanent deletion.
The existing deletion action uses it so a removed row can still be destroyed
from the Removed view. Its optional `returnTo` field is accepted only as
`/generate` or `/library`, with `/generate` as the fallback; it cannot become
an open redirect. It now revalidates `/library` as well as the existing
surfaces.

## Sharing and the community showcase (prompt 018)

Visibility is one client-safe closed definition in
`lib/generations/visibility.ts`: `private | unlisted | public`. The schema,
validation, actions, library labels and generation result state import it
rather than redeclaring competing unions. The state contract is:

| Visibility | Owner | Exact-link visitor | Landing and Community |
| --- | --- | --- | --- |
| `private` | Full record and controls | 404 | Absent |
| `unlisted` | Full record and controls | Redacted image record | Absent |
| `public` | Full record and controls | Redacted image record | Present |

`/g/[id]` now lives in `app/(generation)/` under a compact public shell. It
parses the route id, optionally reads Clerk identity, and tries the existing
owner-filtered live query first. A visitor who is not the owner can only reach
`getShareableGeneration`, whose projection contains `id`, image URL, model,
dimensions, visibility and creation time. It does not select the prompt or
owner id. Private, removed, malformed and missing ids all resolve to 404.

The owner-only client leaf submits exactly `generationId` and `visibility` to
`changeGenerationVisibility`. The Server Action authenticates, validates the
closed enum, performs one owner-filtered live-row update, returns the same
not-found result for a foreign id, expires `public-generations`, and
revalidates `/`, `/community`, `/generate`, `/library`, and the exact record.
Shareable states expose both an ordinary `/g/<id>` anchor and a progressively
enhanced clipboard control with a mounted status announcement. The prompt is
never copied or rendered anonymously.

`/community` is an async Server Component backed by a cached, bounded query for
the newest 12 live public rows. The projection contains only id, image URL,
dimensions and creation time. The page renders an asymmetric proof sheet with
uncropped intrinsic-ratio images, or a factual Generate empty state. Cache-hit
dates are normalized back to `Date` objects at the query boundary because the
Next.js data cache serializes them.

The same `public-generations` tag owns the landing and Community public reads.
Generate, visibility changes, remove, restore and permanent delete also
revalidate `/community` whenever a public row may have changed. There is no
polling interval and no model or Blob call on a visibility change.

## AI model

`lib/ai/model.ts` exports one model id:
`@cf/black-forest-labs/flux-1-schnell`, served by **Cloudflare Workers AI**.

### Why the provider changed, on 2026-08-13

Prompt 009 built the generation path on the Vercel AI Gateway with
`google/imagen-4.0-fast-generate-001`. It never served a request. The linked
team `dgsloxx417s-projects` has no payment method, and the Gateway refuses every
request from such a team:

```
Image generation failed. GatewayInternalServerError: AI Gateway requires a valid
credit card on file to service requests.
```

Prompt 014 moved the call to Cloudflare Workers AI at the user's explicit
request. **The deciding property is that Workers AI's free tier refuses rather
than bills.** Quoted from the pricing page: *"If you exceed any one of the above
limits, further operations will fail with an error."* The allocation is *"10,000
Neurons per day at no charge"*. Hugging Face Inference Providers was read and
rejected: a free account receives $0.10 per month, which is a handful of images.

`AGENTS.md` §5.3 rule 1 and the §7.2 provider table were rewritten in the same
change rather than left stale. The `ai` package stays installed and `lib/ai/`
is now its only former caller, so the Gateway is one edit away if a card is
ever added.

### The verified provider facts

All fetched live on 2026-08-13, from Cloudflare's own documentation, and
re-fetched at execution time rather than carried over from the prompt file.

| Fact | Value | Source page |
| --- | --- | --- |
| Endpoint | `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}` | `workers-ai/get-started/rest-api/` |
| Auth header | `Authorization: Bearer {API_TOKEN}` | same |
| Token permissions | both `Workers AI - Read` and `Workers AI - Edit` | same |
| Response envelope | `success`, `errors`, `messages`, `result` | same |
| Model id | `@cf/black-forest-labs/flux-1-schnell` | `workers-ai/models/flux-1-schnell/` |
| Inputs | `prompt` (required, 1 to 2048 chars), `seed` (optional), `steps` (default 4, max 8) | same |
| Output | `result.image`, a base64 string. **No `width` or `height` input exists** | same |
| Free allocation | 10,000 neurons per day, and exceeding it errors rather than bills | `workers-ai/platform/pricing/` |
| Neuron cost | 4.80 per 512x512 tile, plus 9.60 per step | same |

### How `lib/ai/generate.ts` calls it

The module keeps `import "server-only"` and its
`{ bytes, mediaType, width, height }` return shape, so the action's
destructuring is unchanged. It sends `{ prompt, steps: 4 }` and nothing else.

`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are read **inside** the
function, never at module scope, for the same reason `getDb()` is lazy: Next
evaluates top-level module code during `next build`, so a module-scope read
would fail the build with the environment absent.

Three things about this provider are easy to get wrong and are handled
explicitly:

1. **A model failure arrives inside an HTTP 200** carrying `success: false`.
   Checking `response.ok` alone would pass an undefined image to the decoder.
   Both a non-2xx status and a `success: false` body are treated as failures.
2. **The image is base64 in JSON**, not raw bytes as the Gateway returned.
3. **The output size and encoding are not stated anywhere in the docs**, so both
   are measured. `readImage` tries the PNG signature, then the JPEG SOF marker,
   and returns the media type alongside the dimensions. The media type is what
   `lib/storage/generations.ts` turns into the stored file's extension, so
   hardcoding `image/jpeg` would risk writing PNG bytes to a `.jpg` path.

### Two failure kinds, because one message was lying

`generateImageForPrompt` throws a typed `ImageGenerationError` carrying a
`kind`, and the action branches on it. The action never string-matches a
provider message.

| `kind` | Raised when | Message the user sees |
| --- | --- | --- |
| `provider_unavailable` | env vars unset, network failure, non-2xx other than 400, unreadable body, missing image, undecodable bytes | "The generator is unavailable right now. Try again later." |
| `generation_rejected` | HTTP 400, or a 200 carrying `success: false` | "The image could not be generated. Revise the prompt or try again." |

The old code returned the second message for every failure, including the
billing refusal above, which sent users to revise a prompt that was never the
problem. That violated §8.2 rule 4's requirement that a failure be an honest
visible state.

Thrown messages carry Cloudflare's numeric error codes and messages, never the
user's prompt, and `safeErrorMessage` in the action strips the prompt from any
provider string before it reaches a log.

### Measured output size and cost

**Measured on 2026-08-13**, read out of the first real `generations` row rather
than assumed. The row was written by a generation made through the form at
`/generate`, not by a synthetic insert.

| Measurement | Value | How it was read |
| --- | --- | --- |
| Output size | **1024 x 1024** | `width`, `height` on the stored row |
| Encoding | **JPEG** | `right(image_url, 4)` returned `.jpg`, and the extension comes from the media type `readImage` detected off the bytes |
| Model id stored | `@cf/black-forest-labs/flux-1-schnell` | `model` on the same row |

The published pricing-table arithmetic for the measured size is:

- 1024 x 1024 is **4** 512x512 tiles, at 4.80 neurons each: **19.20**
- 4 steps at 9.60 neurons each: **38.40**
- **57.60 neurons per image**

That arithmetic did not match the live response header when Prompt 021
re-measured it on 2026-08-13. One real 1024 x 1024 request with `steps: 4`
returned `cf-ai-neurons: 172.80`. The limiter uses the higher measured value,
not the lower documentation-derived value. Against the 10,000-neuron daily
allocation, 57 such images reserve 9,849.6 neurons and a 58th would reserve
10,022.4. These figures are build-record calculations and appear in no
user-visible string.

The provider documentation still lists 4.80 neurons per tile and 9.60 per
step, so the 3x difference is recorded as an unresolved provider discrepancy.
The response header is the closest available measurement of what the account
was actually charged. Prompt 021's shared UTC-day reservation now prevents the
application from knowingly crossing that measured allocation.

Because the encoding is confirmed JPEG in practice, `readImage`'s PNG branch is
currently unused for this provider. It stays because nothing in Cloudflare's
documentation promises JPEG, and the media type decides the stored file's
extension.

## The model registry (prompt 015)

`lib/ai/model.ts` is deleted. `lib/ai/catalog.ts` replaces it with a typed
registry keyed by model id, holding label, note, beta flag, step count, size
list, body style and response style, plus `DEFAULT_MODEL_ID`,
`IMAGE_MODEL_IDS`, `getModel` and `getModelSize`.

**`lib/ai/catalog.ts` deliberately carries no `import "server-only"`**, which is
the one documented exception to AGENTS.md §6.3's rule for `lib/ai/`. It is pure
data, reads no environment variable and imports nothing, and three places need
it: the shared schema, the client leaf that renders the selects, and the action.
`lib/ai/generate.ts` keeps `server-only` and stays the only module that reads
`CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN`. The catalog does reach the
browser bundle, which is intended: it is a list of public model names and image
sizes.

### The two models, and why only two

| Model | Sizes offered | Body sent | Response | Neuron cost |
| --- | --- | --- | --- | --- |
| `@cf/black-forest-labs/flux-1-schnell` (default) | Square 1024 x 1024 only | `{ prompt, steps: 4 }`, no dimensions | JSON, `result.image` base64 | 172.80 per image from the live response header |
| `@cf/bytedance/stable-diffusion-xl-lightning` (beta) | Square 1024 x 1024, Landscape 1280 x 768, Portrait 768 x 1280 | `{ prompt, width, height, num_steps: 4 }` | **raw image bytes** | **none published.** Its pricing row reads `$0.00 per step` and the response carried `cf-ai-neurons: 0.00` |

The default model takes no dimensions at all, which is why the control is a
per-model size list rather than a site-wide aspect-ratio control. A ratio
selector would be a lie on the default model.

**The Leonardo models are excluded on arithmetic, not taste**, and the exclusion
is recorded so a later session does not re-add them. Read from the pricing page
on 2026-08-13: `@cf/leonardo/lucid-origin` costs 636.00 neurons per tile plus
12.00 per step, so one 1024 x 1024 image is four tiles at 2,544 neurons before
steps. Against the account-wide 10,000 neuron daily allocation that is **three
images for the entire product per day**. `@cf/leonardo/phoenix-1.0` is 530.00
per tile and no better. Putting either in a user-facing select would let one
person exhaust the product for everybody in under a minute.

### The SDXL-Lightning response, measured because it is undocumented

Its model page documents a `ReadableStream` for the Workers binding and says
nothing about the REST envelope, so it was probed directly on **2026-08-13**:

```
HTTP/2 200
content-type: image/png
content-length: 55379
cf-ai-neurons: 0.00
```

```
file: JPEG image data, JFIF standard 1.01, baseline, precision 8, 1024x576
```

Three facts came out of that, and each one is load-bearing:

1. **The REST response is the raw image body, not the JSON envelope.** Passing
   it to `response.json()` would fail on the first byte. `responseStyle:
   "binary"` on the registry entry selects `arrayBuffer()` instead.
2. **The `content-type` header lied.** It said `image/png` over bytes that begin
   `ff d8 ff e0`, which is JPEG. This is the direct reason the media type is
   sniffed off the bytes for **every** model rather than read from the header:
   trusting it would have written JPEG bytes to a `.png` blob path.
3. **The measured cost is 0.00 neurons**, from the response's own
   `cf-ai-neurons` header, consistent with the pricing table having no neuron
   row for this model. Recorded as measured, not inferred.

A failure on the binary path arrives as a JSON body inside a 200. It is caught
by `readImage` returning null, and the bytes are then read back as JSON to
recover Cloudflare's error detail, so the 200-with-`success:false` rule holds on
both response styles. The 400-versus-everything-else split and both
`ImageGenerationError` kinds are unchanged.

**Both paths still run `readImage` on the returned bytes**, including the model
that was asked for a specific size, so the stored dimensions and media type stay
measured rather than assumed.

## Storage

Generated images are written to
`generations/<generation-uuid>.<extension>` with public access and without an
added random suffix. The database id is allocated before the model call and is
reused for both the row and Blob pathname. No owner identifier enters a new
pathname. Generated images remain user data in Blob and never enter `public/`
or Git.

## Auth and routes

`proxy.ts` optimistically protects `/generate`, `/account` and `/library`.
`/g/[id]` still passes through Clerk middleware for optional identity, but it
is not route-wide protected. Each protected page and every mutation
independently read the server session. Proxy is not the authorization boundary.

| Route | Render and data behavior |
| --- | --- |
| `/` | Public marketing route, still prerendered as static. Its gallery reads the cached public-generation query and is expired on demand by a public write |
| `/sign-in` | Public Clerk sign-in screen |
| `/sign-up` | Public Clerk sign-up screen |
| `/generate` | Dynamic, owner-scoped history read and Server Action mutation |
| `/account` | Dynamic Clerk identity read and owner-scoped generation count |
| `/g/[id]` | Dynamic. Owner gets the full live row and controls; exact-link visitors get only the consent-safe projection for unlisted or public rows |
| `/community` | Public cached proof sheet of newest live public rows, with a factual empty state on read failure |

Clerk 7 uses `Show when="signed-in"` and `Show when="signed-out"` for auth-state
rendering. These replace the `SignedIn` and `SignedOut` names in the older
prompt. Clerk appearance variables are set once in the root provider, including
the lime focus ring.

## Environment variables

The linked Vercel project exposes the following variables needed by this step
across production, preview, and development:

| Variable | Browser-visible | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | No | Pooled runtime database connection |
| `DATABASE_URL_UNPOOLED` | No | Direct migration connection |
| `BLOB_READ_WRITE_TOKEN` | No | Blob writes and cleanup |
| `CLERK_SECRET_KEY` | No | Clerk server access |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser initialization |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | Local sign-in route |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | Local sign-up route |
| `VERCEL_OIDC_TOKEN` | No | Managed by Vercel. No longer read for generation |
| `STRIPE_SECRET_KEY` | No | Stripe sandbox server API credential, Development and Preview |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature verification, pending deployment setup |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Marketplace-provisioned sandbox identifier; not read by Ether |

Set by hand, not provisioned. Cloudflare is not a Vercel Marketplace
integration, so neither name comes from a provider and both are this project's
choice:

| Variable | Browser-visible | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | No | Path segment of the Workers AI run endpoint |
| `CLOUDFLARE_API_TOKEN` | No | Bearer token, needs `Workers AI - Read` and `Workers AI - Edit` |

The Neon marketplace also provisions compatibility variables. Ether does not
read those aliases. Real values stay in the ignored `.env.local` file and the
Vercel environment.

## User data

Ether stores the Clerk owner id, prompt, generated image URL, model id, decoded
dimensions, the visibility choice, and creation time. For accepted quota
reservations it also stores the owner id, model id, image count, scaled provider
units and timestamp. It reads the user's email and join date from Clerk for
`/account` but does not store them locally.
Prompts, emails, request bodies, publication payloads, provider credentials,
and Blob tokens are not logged.

A generation is private unless its owner changes or creates it as public.
Unlisted and public exact-link reads transmit the image URL, model, dimensions,
visibility and creation time, but never the prompt or owner. Only public rows
reach `/` and `/community`. Canonical Blob URLs no longer contain the Clerk
owner id.

## Verification, prompt 021

Run on 2026-08-13.

- Live Cloudflare pages still listed the 10,000-neuron free daily allocation,
  its 00:00 UTC reset, FLUX's 4.80-neuron tile and 9.60-neuron step rates, and
  SDXL Lightning at `$0.00 per step`. Direct provider probes returned HTTP 200
  for both catalog models. FLUX reported `cf-ai-neurons: 172.80` with an
  `application/json` response; SDXL reported `0.00` with the known misleading
  `image/png` header. Neither probe was stored as user content.
- `npm run db:generate` reported 2 tables and created
  `drizzle/0004_dry_sir_ram.sql`. Inspection found only the additive table,
  constraints and owner/time index before the reviewed function was appended.
  `npm run db:migrate` ended with `migrations applied successfully!` through
  the direct connection. The Drizzle migration journal count moved from 1 to
  2.
- Read-only schema verification returned all six expected columns and defaults,
  the primary key plus `usage_events_user_created_at_idx`, and exactly one
  function with identity arguments
  `p_user_id text, p_model text, p_image_count integer, p_provider_units
  integer`. Its result is the four-column typed quota outcome recorded above.
- `EXPLAIN` used `usage_events_user_created_at_idx` directly for the rolling
  owner window. The bounded UTC-day query also used that composite index
  through a bitmap index scan, so the conditional time-only index was not
  added.
- The isolated quota suite printed true for count 1 plus count 4 consumption,
  account concurrency, event-derived reset validity, exact charged-model cost,
  cross-owner global concurrency, zero-cost provider bypass with account spend,
  rejected-event absence, read-only snapshot behavior, owner isolation,
  generation lifecycle independence, database-failure closure and malformed
  result closure. Five concurrent four-image reservations reached exactly the
  20-image owner ceiling; a sixth was rejected. At the global boundary one of
  two concurrent charged reservations was accepted and one rejected. Cleanup
  returned true for both generation rows and usage events.
- `npm run lint`, `node_modules/.bin/tsc --noEmit`, and `git diff --check`
  exited 0. The visible-copy audit found no em-dash, separator en-dash,
  exclamation mark, raw component hex, arbitrary z-index, invented statistic,
  or hype in the changed interface.
- The required Turbopack `npm run build` remains blocked by the documented host
  failure while processing `app/globals.css`: `creating new process`, `binding
  to a port`, `Operation not permitted (os error 1)`. The same failure occurred
  with elevated execution and is not reported as a passed build.
- The documented `npm run build -- --webpack` fallback compiled successfully,
  finished TypeScript, generated all 18 pages, and preserved the complete route
  table. `/` and `/community` remain static; `/account`, `/generate`,
  `/library`, and `/g/[id]` remain dynamic; no route was added.
- The webpack build also passed with `.env.local` absent and the file was
  restored. The before and after landing documents were both 123,825 bytes and
  the documented hash/build-id normalization diff exited 0.
- Client output contained zero value hits for `DATABASE_URL`,
  `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`, `CLERK_SECRET_KEY`,
  `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN`. Every name hit was zero
  except Clerk's known one-file SDK enumeration; its context contains only
  environment key names and its value hit was zero.
- Against the production server, anonymous `/` returned 200. Anonymous
  `/generate` and `/account` each returned 307 to the local sign-in route with
  Clerk's `signed-out` status.

Not run, and why:

- **Signed-in generation and `/account` browser pass.** No reusable Clerk
  browser session existed. The action's database boundary and account summary
  ran against isolated synthetic owners without forging authentication, but
  those checks are not presented as an authenticated end-to-end submission.
- **Landing motion playback.** No settled landing or motion file changed, and
  the complete prerendered document is identical, but motion was not
  re-recorded.

The concurrency procedure was worked out for the first time here, so
`docs/automation.md` does not add it yet.

## Verification, prompt 017

Run on 2026-08-13.

- `npm run lint` completed with exit 0. `node_modules/.bin/tsc --noEmit` also
  completed with exit 0; there is no project typecheck script yet.
- The read-only direct-Neon schema check returned one `deleted_at` column with
  `data_type: timestamp with time zone`, `is_nullable: YES`, and
  `column_default: null`. Its index list is unchanged:
  `generations_pkey`, `generations_public_created_at_idx`,
  `generations_user_created_at_idx`, and `generations_user_id_idx`.
- The query-layer check deliberately printed no owner, prompt, or Blob URL. It
  found 8 active rows for its selected owner, 0 results for a literal `%`
  search, and confirmed the nonexistent-id soft-delete is a no-op. This
  verifies that escaped `%` does not become a match-all pattern.
- With the dev server running, anonymous `HEAD /library` was Clerk-protected
  (`x-clerk-auth-status: signed-out`), while anonymous `HEAD /` was `200`.
- Client static-output scan returned 0 files for `DATABASE_URL`,
  `BLOB_READ_WRITE_TOKEN`, `CLERK_SECRET_KEY`, and `CLOUDFLARE_API_TOKEN`.
  Searching the actual Clerk secret value also returned 0 files. This scan is
  against the current dev output because the production build below could not
  complete in this execution environment.
- **Production build is blocked by the execution environment, not reported as
  passed.** `npm run build` reaches the CSS entry point then Turbopack fails
  creating a local process socket with `Operation not permitted (os error 1)`.
  Retrying after clearing a stale generated `.next/dev/lock` and with elevated
  command permission produced the same result. `next build --webpack` also
  failed before compiling the application, while parsing TypeScript's emitted
  config. The environment-absent build, route-table comparison, and prerendered
  landing HTML comparison therefore could not be rerun from the final tree.
- The signed-in browser checks remain unrun in this environment: there is no
  active Clerk browser session to remove, restore, or permanently delete a
  real generation. No mutation of user content was attempted merely to satisfy
  a check. The route, query, schema, and type checks above are the completed
  substitutes, not a claim of end-to-end action verification.

## Verification, prompt 016

Run on 2026-08-13, against the dev server already running on port 3001.

- `npm run lint` produced no output beyond npm's own two notice lines, exit 0.
- `npm run build` succeeded: `Compiled successfully in 3.9s`, `Finished
  TypeScript in 3.2s`, 17 static pages generated.
- **Route table compared, not assumed.** Built, stashed the seven changed
  source paths, rebuilt, diffed. The only difference is one added line,
  `├ ƒ /g/[id]`. Every other route kept its render mode, `/` is still `○`
  static, and `/generate` is still `ƒ`.
- **`/`'s prerendered HTML compared byte for byte.**
  `.next/server/app/index.html` is **110,782 bytes both before and after**, the
  same figure prompt 015 recorded, and the normalised diff printed `IDENTICAL`.
- **Environment-absent build passed** and `.env.local` was restored.
- **Client-bundle secret scan:** `BLOB_READ_WRITE_TOKEN` and `DATABASE_URL`
  each matched **0** files under `.next/static/`. `CLERK_SECRET_KEY` matched
  one, the known permanent name-only hit; searching for its actual value
  returned **0**, as did searching for the Blob token's value.
- **Anonymous access:** `curl` to `/g/<real id>` returned **307** to
  `/sign-in?redirect_url=…%2Fg%2F…`, and `/` still returned **200**.

### The two-account check could not be run, and here is what was run instead

`AGENTS.md` §8.3 rule 4 wants two accounts verified against the database. A
read-only `group by user_id` returned **exactly one owner** with 9 rows, so
there is no second owner's id to request and the real cross-owner test was not
possible. It is recorded as not run rather than described as passed.

What could be verified was, signed in as that owner:

| Request | Result |
| --- | --- |
| `/g/3dff1ad0-…` (own row) | renders the record |
| `/g/00000000-0000-4000-8000-000000000000` (well-formed, matches no row) | **404** |
| `/g/not-a-uuid` (malformed) | **404**, not a 500 |

The malformed case is the one the pre-query parse exists for: without it the
value reaches a `uuid` column and raises a Postgres cast error. The dev server
log carries no error for either request.

Because this was the first time a cross-owner check was attempted by hand, it
is **not** added to `docs/automation.md`; §3 captures a step on its second
occurrence. It stays uncaptured, and step 7 or 8 is where it will be worth
writing down, ideally after a second account exists.

### Download, measured rather than assumed

| url | status | `content-disposition` |
| --- | --- | --- |
| the plain Blob url | 200 | `inline; filename="….jpg"` |
| `generationDownloadUrl(...)` | 200 | `attachment; filename="….jpg"` |

`attachment` is what makes the browser save rather than open, and it is why the
link cannot rely on the `download` attribute across origins. Clicking the link
in the browser left the page in place rather than navigating to the image, but
**no saved file appeared in the download directory**, and page-initiated
downloads appear to be suppressed in the automated browser session. The header
measurement above is the evidence; the click is not claimed as a completed
save.

### One deletion, end to end

The private row `3dff1ad0-…` (SDXL Lightning, 1280 x 768) was deleted through
the real control.

- The first click revealed the confirm sentence plus `Delete permanently` and
  `Cancel`, with focus on the confirm. `Cancel` collapsed the pair and returned
  focus to `Delete`.
- Confirming redirected to `/generate`.
- Read-only re-query: **0 rows** match the deleted id, and the table went from
  9 rows to **8**. The public row count is **1**, unchanged.
- `HEAD` on the deleted Blob url: **200 before, 404 after**.
- `/g/3dff1ad0-…` now returns **404**.
- `/generate` lists **8** history cards, each an `<a href="/g/<uuid>">`, and
  the deleted one is gone, so the `revalidatePath("/generate")` landed.
- The row was private, so the `row.isPublic` branch did not run. `/` still
  serves the same single public generation in its gallery. Note that this is
  the guarded branch plus an unchanged public row, not a direct observation of
  the cache; there is no way to watch `unstable_cache` expire from outside.
- The server log carries no prompt, no owner id and no Blob url from this
  action, because no failure path ran.

### Two warnings worth recording, neither introduced here

- Clerk logs `"createRouteMatcher" is deprecated and will be removed in the
  next major release`, recommending resource-based checks in each page and
  action. This project already does those checks; the proxy matcher is the
  optimistic layer on top. Migrating off `createRouteMatcher` is a separate
  decision, not part of this step.
- Next flags the `/g/[id]` image as the LCP element and suggests
  `loading="eager"`. It is deliberately not set: `design-system.md` §5.3 makes
  the macaw the only priority image on the site, and this route is owner-only
  and behind a navigation.

## Verification, prompt 015

Run on 2026-08-13.

- `npm run lint` produced no output beyond npm's own two notice lines, exit 0.
- `npm run build` succeeded, TypeScript included: `Compiled successfully in
  3.1s`, `Finished TypeScript in 2.3s`, 17 static pages generated.
- **Route table compared, not assumed.** Built, stashed the eight changed
  source paths, rebuilt, and diffed. `IDENTICAL`. No route changed its render
  mode and no route was added.
- **`/`'s prerendered HTML compared byte for byte**, which is stronger than the
  screenshot comparison the prompt asked for and is now the recorded procedure
  in `docs/automation.md`. `.next/server/app/index.html` is 110,782 bytes both
  before and after, and the only differences are content-hashed chunk filenames
  and the build id. With those normalised the markup is identical, so
  `PromptField`'s new `controls` prop changes nothing on the landing page.
- **Environment-absent build passed** and `.env.local` was restored.
- **Client-bundle secret scan:** `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `BLOB_READ_WRITE_TOKEN` and `DATABASE_URL` each
  matched **0** files under `.next/static/`. `CLERK_SECRET_KEY` matched one
  file, and the context was read before reporting it: it is Clerk's own SDK
  enumerating `process.env` key **names**
  (`i.default.env.CLERK_SECRET_KEY, i.default.env.CLERK_MACHINE_SECRET_KEY, …`).
  Searching for the secret's actual 50-character value returned **0** files.
  This is the same class of false positive `docs/automation.md` already records
  for `CLOUDFLARE`, and it is pre-existing rather than introduced here.
- **Both model paths exercised for real** through the registry-driven code, not
  through curl:

  | Call | Result |
  | --- | --- |
  | flux-1-schnell, square | 1024x1024 `image/jpeg`, 271,387 B, 5,248 ms |
  | SDXL-Lightning, landscape | 1280x768 `image/jpeg`, 32,664 B, 5,026 ms |
  | SDXL-Lightning, portrait | 768x1280 `image/jpeg`, 38,470 B, 3,012 ms |

  The requested dimensions came back exactly, and both were measured off the
  bytes rather than trusted from the request. Latencies are warm-path and
  include no database access.
- **The closed lists were tested against the schema**, each case run through
  `generationRequestSchema`:

  | Case | Outcome |
  | --- | --- |
  | flux + square, count 2 | accepted, `count=2` as a number |
  | flux + landscape | rejected, "That image size is not available for the chosen model." |
  | SDXL + landscape, count 4 | accepted |
  | `@cf/leonardo/lucid-origin` | rejected, "Choose a model from the list." |
  | count 3, count 99 | both rejected, "Choose how many images to generate." |

- **Auth enforcement confirmed in the browser**: `/generate` while signed out
  redirected to `/sign-in?redirect_url=…%2Fgenerate`.
- **Signed-in end-to-end runs through the real form**, with every row read back
  by the read-only query. All stored `.jpg` and `is_public = false`:

  | Run | Stored `model` | Stored `width` x `height` |
  | --- | --- | --- |
  | flux, square, 1 | `flux-1-schnell` | 1024 x 1024 |
  | SDXL, landscape, 1 | `stable-diffusion-xl-lightning` | 1280 x 768 |
  | SDXL, portrait, 1 | `stable-diffusion-xl-lightning` | 768 x 1280 |
  | flux, square, **2** | `flux-1-schnell` | 1024 x 1024, **two rows** |

  Every stored dimension is the one the chosen size asked for, measured off the
  returned bytes rather than copied from the request. The count-of-2 run wrote
  two rows, rendered two slots side by side, and announced "2 images generated
  and saved. They stay private.", which confirms the sequential loop and the
  partial-success result shape end to end.

### The form reset defect, found and fixed during verification

The count-of-2 run surfaced a real bug in the first version of the controls:
after the action settled, the three selects displayed their defaults while the
model note beside them still described the model the user had actually chosen.
The note was right and the selects were wrong.

**Cause, read out of `react-dom` rather than guessed.** React calls the form
element's native `reset()` after a Server Action completes, from
`recursivelyResetForms` inside `commitLayoutEffectOnFiber`
(`react-dom-client.development.js`). Native `reset()` reverts every control to
its HTML default, including a **controlled** `<select>`, because it writes the
DOM directly. React's `value` props did not change, so nothing re-rendered and
React never learned the DOM had moved. Two consequences: the controls lied about
what was selected, and every generation silently discarded the model and size
the user had picked.

**Fix.** All three values live in `GeneratorWorkspace` state, the selects are
controlled from it, and `GenerationControls` runs a dependency-free `useEffect`
that writes the chosen values back onto the three select elements. Passive
effects flush **after** the layout phase, so that effect is the first moment the
reset can be undone. Writing them back also means a generation now preserves the
choice instead of resetting it, which is the better behaviour anyway.

An earlier attempt bumped a `key` to remount the controls from an effect, and
was rejected by `react-hooks/set-state-in-effect`: "Calling setState
synchronously within an effect can trigger cascading renders." Syncing the DOM
from state is what an effect is legitimately for; bumping state is not.

## Verification, prompt 014

Run on 2026-08-13.

- `npm run lint` produced no output beyond npm's own two notice lines.
- `npm run build` succeeded, TypeScript included: `Compiled successfully in
  6.7s`, `Finished TypeScript in 3.2s`, 17 static pages generated.
- **Route table compared, not assumed.** The pre-change tree was built by
  stashing only the three modified source files, and the two route tables were
  diffed. They are identical: `/` static, `/account` dynamic, `/generate`
  dynamic, the two Clerk catch-alls dynamic, and the eleven other marketing
  routes static.
- `npm run build` with `.env.local` moved aside succeeded and produced the same
  17 routes, which is what proves the environment read is lazy. `.env.local`
  was restored immediately afterwards and re-verified present.
- The built client output was searched for `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_API_TOKEN`, `api.cloudflare.com`, and the model id. Zero client
  files matched any of them; both variable names appear only under
  `.next/server/`. One client chunk does contain the bare string `CLOUDFLARE`,
  and it was inspected: it is Clerk's runtime sniffing,
  `fy("Cloudflare-Workers")?"CLOUDFLARE":…`, which predates this change and is
  unrelated.

**Live generation, confirmed the same day.** After the credentials were set, a
generation made through the form at `/generate` returned an image, and a
read-only query against `generations` found exactly one row: 1024 x 1024,
`model=@cf/black-forest-labs/flux-1-schnell`, `is_public=true`, stored as
`.jpg`. That single row exercises the whole path end to end: the endpoint
responded, the envelope parsed, the base64 decoded, the magic-byte detection
picked a media type that matched the real encoding, the blob was written, and
the row was inserted with measured rather than assumed dimensions.

Not verified, and why:

- **The `provider_unavailable` path reached through a 401.** With both
  variables now set, that branch is only reachable by deliberately breaking the
  token. What has been exercised is the missing-variable branch, which returns
  the same message through a different code path. The 401 and 429 branches are
  reasoned from the status-code split, not observed.
- **The `generation_rejected` path.** No prompt has been refused, so neither
  the HTTP 400 branch nor the `success: false` branch has run.
- **A second concurrent user.** Nothing here tests the account-wide neuron
  ceiling or two accounts generating at once.

### Environment variable gotcha, worth not rediscovering

Both variables were first added with `vercel env add` answering **yes** to
"Store as sensitive?". That produced entries scoped to Production and Preview
only, with unreadable values, and the dev server had no credentials at all.
Two documented constraints cause it: *"Sensitive environment variables are
environment variables whose values are non-readable once created"*, so
`vercel env pull` cannot bring them down, and *"You can only create sensitive
environment variables in the preview and production environments"*, so
Development cannot be selected.

The resolution kept the sensitive Production and Preview entries, which are
still decrypted at deploy runtime, and added a separate non-sensitive
Development-scoped entry for each so `vercel env pull .env.local --yes`
populates local development and survives future pulls.

## Verification, prompt 013

Run on 2026-08-12, against the configured development database.

- `npm run lint` produced no output.
- `npm run build` with `.env.local` moved aside succeeded, printed the fallback
  log line once, and kept `/` static. The environment was restored afterwards.
- `npm run build` with the environment present kept the same route table:
  `/` static, `/community` static, `/generate` dynamic, and no other route
  changed symbol.
- `/`'s prerendered HTML was compared against a build of clean `main` with the
  public table empty. With chunk hashes normalised, the rendered DOM is
  byte-identical at 56,320 characters. The RSC flight payload orders its chunks
  differently because `Gallery` is now async, and the stylesheet gains exactly
  seven utilities, all of them used only by the `/generate` checkbox:
  `mt-3.5`, `mt-px`, `size-4`, `max-w-[62ch]`, `gap-2.5`, `leading-[20px]`, and
  `accent-lime`. Nothing was removed or altered.
- Eight synthetic rows were inserted directly over the direct connection under
  the owner id `seed_013_verification`, six public and two private, with
  staggered timestamps. With three public rows the three newest filled the
  first three photographic slots in the strip's existing order and the last two
  slots kept `gallery-crowd.jpg` and `gallery-snow.jpg` with their original alt
  text. With six public rows the five newest filled all five slots and the
  sixth was excluded, so the limit is exact. Private rows never appeared, no
  prompt text reached `/`, and `sizes` was emitted on remote images only. All
  eight rows were then deleted with a single `delete ... returning id`, which
  reported eight, and a follow-up count returned an empty table. No Blob was
  created, because the seeded URLs were synthetic strings, so there was nothing
  to clean up in storage.
- The built client output was searched for the values of `CLERK_SECRET_KEY`,
  `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and
  `VERCEL_OIDC_TOKEN`. Zero files matched, and no value was printed.

Not verified, and why:

- **Live generation through the real form.** The Gateway billing block recorded
  above is unchanged, so no end-to-end run could create a real row. The
  database and render path either side of the model call were verified with the
  seeded rows instead.
- **A keyboard and screen-reader pass on the new checkbox.** `/generate` is
  behind an interactive Clerk sign-in. What was checked is the markup: a native
  `input type="checkbox"` with a real `label` whose `htmlFor` matches its `id`,
  which picks up the global `:focus-visible` lime ring in `app/globals.css`.
- **A screenshot comparison of `/` at each breakpoint.** The byte-identical DOM
  and the additive-only stylesheet are a stronger guarantee than a screenshot,
  and `components/motion/ColumnDrift.tsx` was not modified, so the reduced
  motion path and both marquee axes are unchanged by construction.

## Verification, prompt 018

Run on 2026-08-13.

- `npm run lint` exited 0 with no ESLint findings. `next typegen` printed
  `Types generated successfully`, and `node_modules/.bin/tsc --noEmit` exited
  0. `git diff --check` also exited 0.
- The reviewed enum migration preserved all 8 rows: 7 private, 0 unlisted and
  1 public. Read-only checks returned enum labels `private`, `unlisted`,
  `public`; a non-null `generation_visibility` column with default `private`;
  `generations_visibility_created_at_idx`; and zero `is_public` columns.
- `dotenv -e .env.local -- drizzle-kit migrate` could not apply safely because
  the live schema had been established by earlier `push` commands and had no
  migration journal. Drizzle's official transactional Neon migrator was run
  against a temporary baseline containing only reviewed migration 0003. It
  applied the SQL and established the journal without replaying 0000 through
  0002 against an existing table.
- The Blob pathname migration returned
  `{ scanned: 8, moved: 8, skipped: 0, failed: 0 }`. Its rerun returned
  `{ scanned: 8, moved: 0, skipped: 8, failed: 0 }`. Aggregate verification
  returned 8 total, 0 noncanonical paths and 0 owner ids in URLs. Each move
  checked the new object and the absence of the old object without printing a
  URL.
- The isolated cross-owner check returned true for owner read, cross-owner
  block, private/unlisted/public/removed anonymous projections, projection
  redaction, wrong-owner update block, all visibility transitions, Community's
  exact limit and newest-first ordering, public-only filtering, and cleanup.
  Synthetic rows and their temporary Blob were removed in `finally`.
- Anonymous route checks returned 404 for private, 200 for unlisted, and 200
  for public. Anonymous HTML contained neither synthetic prompt nor owner id.
  Unlisted was absent from `/community` and `/`; public appeared in both and
  Community linked to its exact record. All synthetic route-check data was
  removed afterwards.
- The first cached Community browser read exposed a serialized-date bug. The
  query boundary now converts cached creation values back to `Date`; repeated
  `/community` requests returned 200 after the fix.
- Fresh screenshots at 390 x 844, 768 x 1024 and 1440 x 1200 confirmed a
  single mobile column, no horizontal overflow, uncropped intrinsic-ratio
  imagery, and the intended asymmetric desktop proof sheet. No new motion was
  added. The existing public-image LCP warning was observed and intentionally
  does not add priority, because the project contract reserves priority for the
  macaw.
- The required `npm run build` remains blocked in this host by a Turbopack
  internal error while processing `app/globals.css`: `creating new process`,
  `binding to a port`, `Operation not permitted (os error 1)`. The same failure
  occurred with `.env.local` present and absent, and the file was restored.
- Next's documented `npm run build -- --webpack` fallback compiled, completed
  TypeScript, generated 18 pages, and produced the same route table as clean
  commit `ed8e75b`: `/` and `/community` static, `/g/[id]`, `/generate`,
  `/library` and `/account` dynamic, with every unrelated route unchanged.
  The fallback also passed from a clean `.next` directory with `.env.local`
  absent, logged the two fixed public-read failures, rendered the empty
  Community state, and restored `.env.local`.
- The clean environment-absent landing comparison was made against a detached
  worktree at `ed8e75b`. After raw-diff inspection and removal of executable
  build wiring, both complete server-rendered documents were exactly 55,962
  bytes and `diff` exited 0. The initial attempt was discarded because a prior
  Next data-cache entry had supplied the real public row despite the absent
  environment.
- Client output had zero name hits and zero value hits for `DATABASE_URL`,
  `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`, `CLERK_SECRET_KEY`,
  `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN`.
- The copy audit found no visible em-dash, exclamation mark, invented number,
  hype, or moderation, curation, or creator-identification claim.

Not run, and why:

- **Authenticated owner and signed-in non-owner browser passes.** No reusable
  Clerk browser session was available. Their database boundaries were covered
  by the isolated two-owner checks, and the owner/non-owner JSX branches were
  inspected, but those are not claimed as signed-in browser tests.
- **Clipboard success/failure and full keyboard traversal.** These controls are
  owner-only, so the same missing authenticated browser session prevented an
  interaction pass. The committed leaf retains an ordinary anchor when the
  Clipboard API is absent, uses native controls, and has a mounted focusable
  status region, but runtime interaction is not claimed.
- **A live visibility mutation through Clerk.** The owner-filtered query and
  every transition ran against isolated synthetic rows. The authenticated
  Server Action itself was not submitted from a signed-in browser.
- **Landing motion in a browser.** No settled landing component or motion file
  changed, and the environment-absent server-rendered document is identical,
  but motion playback was not re-recorded in this prompt.

## Moderation and abuse handling, prompt 022

Implemented on 2026-08-13. Cloudflare Workers AI remains the only model
provider, and `lib/ai/generate.ts` remains the only module that reads its two
credentials or calls a model.

### Provider models, policy and metering

- Prompt screening uses `@cf/meta/llama-guard-3-8b`. Its live model page was
  checked on 2026-08-13 and listed it as Cloudflare-hosted, not deprecated,
  with prices of $0.484 per million input tokens and $0.030 per million output
  tokens. A synthetic safe REST probe returned HTTP 200, `success: true`,
  `result.response`, usage fields, and `cf-ai-neurons: 9.16`.
- Image screening uses `@cf/moondream/moondream3.1-9B-A2B`. Its live page was
  checked on 2026-08-13 and documented a base64 data URI or public HTTPS URL,
  the non-streaming query task, and no license-acceptance gate. The pricing
  table listed 27,273 neurons per million input tokens and 90,909 per million
  output tokens. A synthetic one-pixel PNG probe returned HTTP 200,
  `success: true`, an answer at `result.result.answer`, usage fields, and
  `cf-ai-neurons: 21.88` for the final bounded policy.
- The closed policy categories are `sexual`, `violence`, `hate`, `self_harm`,
  `illegal`, and `personal_data`. Prompt parsing accepts only exact Llama Guard
  `safe` or documented `unsafe` plus S-category output, after removing only
  surrounding whitespace the live model emits. Image parsing accepts only one
  of `SAFE`, `SEXUAL`, `VIOLENCE`, `HATE`, `SELF_HARM`, `ILLEGAL`, or
  `PERSONAL_DATA`. Missing, unknown, malformed,
  timed-out, non-2xx and `success: false` results are unavailable and fail
  closed.
- Provider units now store hundredths of a neuron. Migration 0005 multiplied
  committed values by 10, changed FLUX's 172.80-neuron reservation from 1,728
  to 17,280 units, and changed the unchanged 10,000-neuron daily ceiling from
  100,000 to 1,000,000 units. Prompt and image checks reserve 2,500 units each,
  conservatively above the measured bounded calls. A generation atomically
  reserves one prompt check plus each requested image and output check. A first
  report reserves one image check with `image_count = 0`, so it does not use the
  reporter's rolling image allowance.

Generation ordering is auth, shared-schema validation, one atomic reservation,
prompt screen, sequential image generation, output screen, Blob write, row
write, then revalidation for rows actually written. Unsafe prompts make no
image call. Unsafe or unavailable output writes no Blob or row and increments
the existing partial-failure count.

### Schema and lifecycle

Migration `drizzle/0005_lowly_bill_hollister.sql` adds:

- `moderation_category` and `report_result` enums;
- nullable `generations.takedown_at timestamp with time zone` and
  `takedown_reason moderation_category`, paired by
  `generations_takedown_pair`;
- `reports`: UUID primary key, generation UUID with cascade deletion, reporter
  Clerk id, closed category, `pending | no_action | takedown` result,
  `created_at`, and nullable `resolved_at`; `reports_resolution_pair` enforces
  the timestamp lifecycle and `reports_generation_reporter_idx` uniquely
  bounds one reporter to one generation;
- moderation-only usage events through nonnegative `image_count` plus the
  `usage_events_work_positive` check; and
- a replacement `reserve_generation_quota` that retains one transaction-level
  advisory lock, ignores zero-image moderation rows in the rolling image
  allowance, and includes all provider work in the UTC-day sum.

Report deletion cascades when the owner permanently deletes the generation:
the report has no independent user-facing subject after the row and Blob are
erased. Takedown is separate from owner removal. It retains the row and Blob,
cannot be cleared by visibility or restore, and is excluded in every owner,
public, shareable, Community, recent-history and library predicate. Permanent
owner deletion still reads through takedown because that existing data-rights
path intentionally has no takedown filter. Account inventory counts only live,
available rows; compute usage includes moderation work and the UI's compute
label remains truthful.

### Report boundary and data

`/g/[id]/report` reads only the existing shareable projection and renders no
image, prompt, owner id or Blob URL. The browser sends only generation UUID and
one closed reason. The action derives the Clerk reporter, validates with the
same strict Zod schema as the client courtesy check, atomically claims a live
shareable non-owner row, and treats duplicates idempotently before quota or
provider work. It fetches the stored image server-side only from the configured
Vercel Blob generation path, with HTTPS, media-type, timeout and 10 MiB bounds.

The database stores generation id, server-derived reporter id, closed category,
closed result and lifecycle timestamps. It stores no allegation text, prompt
copy, email, provider response, confidence, IP address, user agent or request
body. Cloudflare receives a generation prompt for prompt screening and receives
image bytes plus fixed policy text for output or report screening. Reporter and
owner identifiers, email, prompt, Blob URL and report count are not sent.

### Verification, prompt 022

- `npm run lint` exited 0. `npm test` ran four environment-free parser and
  validation tests with four passes and no failures.
- `npm run db:generate` created migration 0005. `npm run db:migrate` applied it
  successfully through the direct connection. Read-only checks returned true
  for both enums, takedown timestamp and pairing, report resolution pairing,
  unique report index, moderation usage compatibility and the replaced quota
  function.
- `npm run test:db` passed one integration suite in 9.1 seconds. It proved one
  claim and one duplicate, safe completion, one idempotent takedown, exclusion
  from recent history, Library, share links, public gallery and Community,
  blocked visibility and restore bypasses, zero-image provider events, and two
  concurrent 600,000-unit reservations accepting only one. Synthetic rows were
  removed in `finally` and cleanup returned zero generation rows.
- Live synthetic provider probes returned the response envelopes and neuron
  headers recorded above. They printed no request, response text, token, image
  bytes or credentials.
- Turbopack remained blocked by this host's internal port-binding restriction.
  The documented webpack fallback compiled, passed TypeScript, generated 18
  pages, and added only dynamic `/g/[id]/report`. The same fallback passed with
  `.env.local` absent outside the restricted sandbox, and the file was restored.
- A detached clean build at commit `2e1441e` and a clean current build both
  produced a 61,314-byte complete server-rendered landing document after only
  executable build wiring was removed. `diff` returned `IDENTICAL`. Raw HTML
  differed by two bytes of build wiring only. The route tables differed only by
  the new dynamic `/g/[id]/report` route.
- An anonymous production-route check returned HTTP 200 for a temporary
  unlisted synthetic report target, rendered the report heading and sign-in
  state, and contained neither the synthetic prompt nor owner id. The row was
  removed afterward.

Not run at this point: the authenticated two-account browser flow and its focus,
keyboard, pending, mobile and partial-output states require reusable Clerk
browser sessions that are not available in this workspace. Those runtime checks
are not claimed by the database, parser or build results above.

## Account and data rights, prompt 023

Build step 11. Three things, all on `/account`: stored generation defaults, a
JSON export, and an account deletion that removes the Blob objects as well as
the rows.

### `user_preferences`, and why it is not a users table

`AGENTS.md` §7.5 forbids a `users` table because Clerk owns identity. This is
not identity: it holds no email, no name, and no external id beyond the same
Clerk `user_id` every other table here already carries as its owner column. It
is application state of exactly the kind `lib/db/` owns, and putting it in Clerk
metadata would give the application a second write path outside `lib/db/`, break
the §6.1 data-layer boundary, and make the export read from two providers.

Generated as `drizzle/0006_careful_sphinx.sql`, applied over
`DATABASE_URL_UNPOOLED`, and read back from `information_schema` afterwards. The
DDL, exactly as generated:

```sql
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"default_model" text NOT NULL,
	"default_size" text NOT NULL,
	"default_count" integer NOT NULL,
	"default_visibility" "generation_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_default_visibility_binary" CHECK ("user_preferences"."default_visibility" in ('private', 'public')),
	CONSTRAINT "user_preferences_default_count_positive" CHECK ("user_preferences"."default_count" > 0)
);
```

The migration is purely additive: it creates one table and alters nothing.

`user_id` is the primary key and there is no other index, because every read is
by exact owner id. `default_visibility` reuses the existing
`generation_visibility` enum but the check constraint narrows it to `private`
and `public`: the publish control is a binary checkbox, and a stored default the
control cannot express would be a lie about what will happen. `unlisted` is
therefore reachable per image on `/g/[id]` and never as a default.

Writes go through `savePreferencesForOwner` in `lib/db/account.ts`, an
`onConflictDoUpdate` on the primary key that stamps `updated_at` inside the
statement rather than from the caller.

### Defaults are a convenience, never a consent

`/generate` seeds its controls from the row and nothing more. The generate
action still parses the submitted form with `generationRequestSchema` and still
derives publication from the submitted checkbox, so a stored `public` default
sets that checkbox's initial state and the server still reads consent from the
request. Nothing in the generate action or its quota path changed.

**A stored default that later becomes invalid must not break `/generate`.** A
model id is one edit away from leaving `lib/ai/catalog.ts` (§5.3 rule 2), so
`resolveGenerationChoice` in the new `lib/generations/choice.ts` resolves the
row through the catalog and falls back field by field: an unknown model falls
back to `DEFAULT_MODEL_ID`, and a size the resolved model does not declare falls
back to that model's first size. Nothing outside the closed list is ever
rendered as an option or sent to the action.

`GenerationChoice` and `DEFAULT_GENERATION_CHOICE` moved out of
`components/app/GenerationControls.tsx` into that module in the same change,
because the server now resolves a choice before any client component renders and
the fallback must keep exactly one definition. The controls themselves, and the
documented form-reset effect in them, are unchanged.

The model/size pairing rule moved to `refineModelSizePair` in
`lib/validation/generation.ts` for the same reason: two schemas enforce it now,
the generate request and the account defaults, so it is written once and applied
twice.

### The export, and its §6.1 deviation

`GET /account/export`, at `app/(app)/account/export/route.ts`, Node.js runtime
and `force-dynamic`.

**This is a stated deviation from `AGENTS.md` §6.1**, which reserves Route
Handlers for external callers. The argument: §6.2's hard boundary is about
*mutations*, and this handler mutates nothing. An export is a read that has to
answer with a non-HTML content type and a download disposition, which a Server
Component cannot do and a Server Action cannot do without shipping the whole
payload into the browser as a string and building a `blob:` URL in client code.
The handler stays thin: session, one call into `lib/db/`, serialise.

The payload, all filtered on the session owner inside the queries:

| key | contents |
| --- | --- |
| `version`, `generatedAt` | `1`, and an ISO timestamp, so the file stays legible later |
| `account` | the Clerk user id, primary email, and join date, so the file is self-describing |
| `generations` | **every** row including soft-deleted and taken-down ones, with prompt, image url, model, dimensions, visibility and all three timestamps |
| `usageEvents` | the owner's usage rows |
| `preferences` | the row, or `null` |
| `reportsFiled` | only reports this owner filed, by category and date |

`reportsFiled` is the privacy boundary in the other direction. Reports filed
*against* this owner's images are somebody else's data and never cross, and no
reporter id appears anywhere in the payload.

**Nothing from the payload is logged.** It is prompts and an email address,
which §8.3 rule 2 puts off-limits to the console entirely, so a failure logs the
error's name and nothing else.

Non-goal, deliberately: it is a JSON manifest carrying image **urls**, not a zip
of image bytes. Bundling megabytes of Blob objects through a function is a
different problem with a memory and duration budget, and the urls are directly
fetchable for as long as the account exists.

### `deleteAccount`, and why it is ordered the way it is

`app/(app)/account/actions.ts`, following §10's lettered path.

The ordering is the argument `deleteGeneration` already makes: **blobs before
rows**, because a deleted row whose image is still live at a public url is a
broken promise behind a success message. Clerk goes last, because the sign-in is
the one thing that can be removed after the data without leaving anything
readable.

- **a.** `await auth()`. No client-supplied owner id exists to ignore.
- **b.** `deleteAccountSchema` parses the typed confirmation. The word is
  `delete`, compared after trimming and lowercasing, and it is a typed field
  rather than a browser `confirm()` dialog.
- **c.** No quota check. Deleting spends no provider money.
- **d.** Authorisation *is* the owner filter: every statement is scoped to the
  session id.
- **e.** `listAllImageUrlsForOwner` reads every url including soft-deleted and
  taken-down rows, and `deleteGenerationImages` deletes them in chunks. A chunk
  failure aborts before any row is deleted and returns a handled error.
- **f.** `purgeOwnerData` deletes from `generations`, `usage_events`,
  `user_preferences`, and `reports` where this owner is the reporter.
- **g.** `(await clerkClient()).users.deleteUser(userId)`. If this fails after
  the rows are gone the user is told the true thing: the data is deleted and the
  sign-in could not be removed.
- **h.** Revalidate `/account`, `/generate` and `/library`; only a public row
  additionally calls `updateTag(PUBLIC_GENERATIONS_TAG)` and revalidates `/` and
  `/community`. Whether the owner had public work is read *before* the purge,
  because afterwards there is nothing left to ask. Then `redirect("/")`, which
  is the same stated deviation from §10 rule 5 that `deleteGeneration` carries,
  and which sits outside every `try` because `redirect` signals by throwing.

**`db.batch()`, not `db.transaction()`.** Verified in
`node_modules/drizzle-orm/neon-http/session.js:151`: the neon-http driver's
`transaction` throws `No transactions support in neon-http driver`. `batch`
sends the statements to Neon's HTTP endpoint through `client.transaction(...)`,
so it is the one transaction the driver allows. Both the purge and the export
read use it.

Reports filed *against* this owner's generations need no statement of their own:
`reports.generation_id` carries `on delete cascade`, which was verified rather
than assumed (see below).

Deleting the owner's usage events is correct rather than a quota hole. The Clerk
user is destroyed in the same operation and a new signup gets a new id, so
retaining them would protect nothing and would keep data the user asked to
remove.

### The Blob chunk size, and its reason

`deleteGenerationImages` in `lib/storage/generations.ts` chunks at **100 urls**.
`del` is typed `(urlOrPathname: string[] | string, options?): Promise<void>`
(`node_modules/@vercel/blob/dist/index.d.ts:78`) and **states no maximum array
length**, so 100 is a chosen bound and not a documented one: it keeps a single
request's body small and predictable on an account with a long history, and it
keeps one failure from being a failure of every url at once. It throws on the
first failing chunk rather than continuing, because the caller must abort before
any row is removed.

### Verification, prompt 023

Run on 2026-08-13. Every command's output was read, not assumed.

- `npm run db:generate` produced `drizzle/0006_careful_sphinx.sql` and reported
  `user_preferences 7 columns 0 indexes 0 fks`. The SQL was read before applying
  it and is quoted above.
- `npm run db:migrate` reported `migrations applied successfully!`.
- A read-only `information_schema` query confirmed the seven columns, their
  types, `is_nullable` and defaults exactly as the DDL states, plus all three
  constraints (`user_preferences_pkey`, the visibility check rendered as
  `default_visibility = ANY (ARRAY['private','public'])`, and the count check).
  The table held 0 rows.
- `npm run lint` produced no output.
- `npm test` passed 4 of 4.
- `npm run build` compiled, finished TypeScript, and generated 18 static pages.
- **Route table diff against a pre-change build:** the only difference is one
  added line, `├ ƒ /account/export`. No existing route changed mode.
- **The landing page is byte-identical.** `.next/server/app/index.html` was
  126,310 bytes before and after, and the normalised diff returned `IDENTICAL`.
- **The environment-absent build passed.** `.env.local` was moved aside, the
  build produced the full route table, and the file was restored and confirmed
  present.
- **Client-bundle secret scan:** `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL` and
  `CLOUDFLARE_API_TOKEN` each appear in 0 files under `.next/static/`.
  `CLERK_SECRET_KEY` appears in 1, which is the known permanent name-only hit
  documented in `docs/automation.md`; searching for its **value** returns 0, as
  does searching for the blob token's value.
- **The deletion, exercised end to end at the layer the action calls**, against
  a real throwaway Clerk user created through the backend API, alongside a
  second synthetic owner. Booleans and counts only were printed; no owner id,
  prompt, row id, url or email address was logged. All checks passed:
  the export carried both rows including the soft-deleted one, the usage event,
  the preferences row, and only the report this owner filed, and contained no
  trace of the second owner; the url read included the soft-deleted row; both
  Blob objects went from 200 to 404; the purge removed 2 generations, 1 usage
  event, 1 preferences row and 1 filed report; all four tables held nothing for
  the owner afterwards; the report the *other* owner had filed against this
  owner's image cascaded away; the second owner's row and Blob object were
  untouched; and `getUser` on the deleted Clerk id threw. Cleanup left no
  synthetic rows.
- An unauthenticated `GET /account/export` against `npm run start` returned
  `307` to `/sign-in?redirect_url=…`, with `x-clerk-auth-status: signed-out`.
  `/` still returned 200 from the same server.

#### Blob deletion is not instantly visible, and that is worth recording

The first two runs of the deletion check **failed** on "both blobs 404 after
deletion", reading 200 immediately after `del` returned. It is a propagation
delay, not a failed delete: polling showed 200 at +0ms, +1s, +2s and +4s, then
404 at +8s, and the rows and the second owner's object behaved correctly
throughout. An isolated test of the same `deleteGenerationImages` function, and
of a raw single and array `del`, returned 404 immediately, so the delay is
variable rather than a property of the array form.

This qualifies the "200 before, 404 after" line recorded for prompt 016: that
observation was made through a slower manual flow. **A deletion check that
fetches the url immediately after `del` can report a false failure.** Poll.

#### What could not be run

The authenticated browser flow was **not** run and is not claimed: signing in as
the throwaway account needs a real mailbox for Clerk's verification, which this
workspace does not have. Specifically not exercised:

- the export **downloaded through the browser** as an attachment. Its payload
  was verified directly against `readAccountExport`, and the handler's headers
  and 401 branch were read but not observed over an authenticated request.
- the two-step delete confirm's focus, keyboard and pending states in a real
  browser, and the post-deletion `redirect("/")`.
- `/` and `/community` observed dropping a public image after an account
  deletion. The guarded `updateTag` and `revalidatePath` branch is the same one
  `deleteGeneration` uses, and there is no way to watch `unstable_cache` expire
  from outside.

## Hybrid billing and credits, prompt 025

### Commercial and provider contract

The approved sandbox catalog is USD only. Ether Studio is $15 monthly for 200
credits. The one-time pack is $10 for 100 credits. Both closed image models cost
one credit per delivered image. New owners receive ten credits once, with no
renewal and no expiry. Subscription credits expire at the next paid period and
are spent before perpetual top-up credits. A cancelled subscription remains
usable through its paid period. Provider failure, prompt refusal, output
refusal, storage failure, and record failure release the affected credit, so a
partial request spends only for rows actually delivered.

Refunds revoke only the unspent proportional part of the associated top-up.
Spent credits are not refunded except where law requires. A dispute revokes the
remaining associated grant and places paid generation on hold until Stripe
closes it. Existing images remain readable. Stripe Tax is disabled because no
launch country or tax registration was approved. Live mode and Production are
out of scope.

Vercel Marketplace provisioned the unclaimed Stripe sandbox resource
`ir_PYuEEjYG2hRdWIxF` as `ether-stripe-sandbox`, connected to Development and
Preview only. The installed SDK is `stripe` 22.5.0 and the client pins API
version `2026-07-29.dahlia`. It reads `STRIPE_SECRET_KEY` lazily. Checkout uses
dynamic payment methods, hosted subscription and payment Sessions, and the
hosted Customer Portal. The actual Vercel integration also exposes
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PUBLISHABLE_KEY`, and
`STRIPE_MCP_KEY`; application code uses none of them.

The verified test-mode catalog is:

| offer | Product | Price | lookup key | value |
| --- | --- | --- | --- | --- |
| Ether Studio | `prod_V4PB2EttLPmgGx` | `price_1U4GMqBm5a4nTCBVKiPHN9Fq` | `ether_studio_monthly_v1` | USD 1500 minor units, monthly, 200 credits |
| 100 credit top-up | `prod_V4PBL5euGAM89d` | `price_1U4GMtBm5a4nTCBVU7MV6DaE` | `ether_top_up_100_v1` | USD 1000 minor units, one-time, 100 credits |

Both Prices were read back active, `livemode: false`, with closed version,
offer, kind, and credit metadata. Code resolves them by lookup key and verifies
all of those facts before opening Checkout or accepting a grant.

### Stripe request paths

`lib/billing/stripe.ts` is the single lazy SDK boundary.
`lib/billing/catalog.ts` owns the closed server catalog. The three account
Server Actions accept only an offer key, derive the owner from Clerk, derive the
origin from trusted request headers, and accept only Stripe-hosted HTTPS return
URLs. A SHA-256 owner key and Stripe idempotency key prevent duplicate Customer
creation without sending an email or raw Clerk id in Customer metadata.

`POST /api/stripe/webhook` is Node.js and force-dynamic. It reads the raw body,
verifies `stripe-signature` with the lazily read `STRIPE_WEBHOOK_SECRET`, and
handles Checkout completion, asynchronous payment success, subscription
create/update/delete, paid invoices, refunds, and dispute create/close. It
claims every event before work, returns success for duplicates, and can reclaim
a processing claim after 15 minutes. Logs contain event id, event type, and an
error name only. Checkout return query strings are acknowledgement states and
never grant credits.

No webhook endpoint or signing secret was created during this local-only run.
The new handler is not deployed, and the approved sandbox credentials are not
connected to Production, so pointing Stripe at the existing Production URL
would create a knowingly broken destination. Create the sandbox destination
and set `STRIPE_WEBHOOK_SECRET` in Development and Preview when a deployment of
this commit exists, then run the provider end-to-end matrix before enabling it.

### Schema and ledger

Migrations `0007_stiff_luke_cage.sql` and
`0008_nosy_doctor_octopus.sql` add six tables and six PostgreSQL functions.
`billing_customers` maps one Clerk owner to one unique Stripe Customer.
`billing_subscriptions` stores the closed status, one allowlisted Price, item
period bounds, cancellation flag, and provider event time used to reject
out-of-order regression. `billing_holds` stores dispute state.
`billing_webhook_events` stores only event identity, type, processing state,
owner, timestamps, and an error category. `credit_reservations` stores the
operation id, requested and settled integer credits, status, and a 15-minute
recovery bound. `credit_ledger` is append-only: positive grants and compensating
debits or releases link to their grant, operation, and provider references.

The ledger reasons are `starter_grant`, `subscription_grant`, `top_up_grant`,
`generation_reservation`, `generation_release`, `subscription_expiry`,
`refund_reversal`, and `dispute_reversal`. Partial unique indexes make a
provider purchase object and each reservation allocation idempotent. Checks
require positive reservations, nonnegative settlement, and nonzero ledger
deltas. No balance is stored or updated.

`reconcile_credit_balance` takes an owner advisory lock, grants the one-time
starter allowance idempotently, releases stale reservations, and appends
subscription expiry rows. `read_credit_balance` sums the ledger.
`reserve_generation_capacity` combines the same owner lock with the existing
global quota lock, dispute hold, hourly limit, daily provider ceiling, durable
usage event, reservation, and earliest-expiry-first grant allocation in one
database transaction. `settle_generation_credits` releases the undelivered
portion once. Purchase grants and reversals are provider-object and event
idempotent. The 15-minute recovery bound exceeds the five-minute Vercel
function ceiling while limiting stranded credit time after termination.

Account export is version 2 and includes owner-filtered billing customer,
subscription, reservation, and ledger data. Account deletion removes the
Stripe Customer after Blob cleanup and before local billing rows, application
rows, and the Clerk identity. Stripe failure keeps local records and identity
so the operation is retryable.

### Verification

- Catalog readback returned both expected test Products and immutable Prices,
  active and not live.
- `npm run db:generate` reported ten tables and produced migrations 0007 and
  0008. `npm run db:migrate` reported `migrations applied successfully!`.
- A read-only database inspection found all six tables, all six functions, and
  16 indexes across the billing and credit tables.
- `npm run lint` completed with no diagnostics.
- `npm test` covers the closed billing offer, event, and metadata schemas in
  addition to moderation. `npm run test:billing-db` passed its concurrency,
  owner isolation, partial settlement, duplicate grant, and duplicate reversal
  assertions. `npm run test:db` passed the existing moderation and quota suite.
- The environment-present `npm run build` compiled, completed TypeScript,
  generated 18 static pages, kept every existing route mode, and added only the
  dynamic `/api/stripe/webhook` route.
- A detached `4928213` baseline built with Next.js's documented webpack
  fallback. After removing scripts and normalising only bundler-specific font,
  stylesheet, and icon asset names, the complete server-rendered landing
  documents were both 60,912 bytes and `diff` returned `IDENTICAL`.
- The successful build's client output contained zero exact-name hits for all
  Stripe server credentials, database credentials, Blob, and Cloudflare
  secrets. `CLERK_SECRET_KEY` had the documented SDK name-only hit. Every
  exact secret-value scan returned zero.
- The environment-absent Turbopack build passed after removing a stale generated
  `.next` cache and allowing the existing Google font fetch. It compiled,
  completed TypeScript, generated all 18 static pages, and printed the expected
  handled public-gallery and Community database fallback messages. `.env.local`
  was restored and confirmed present.
- Stripe sandbox Checkout, webhook delivery, portal, cancellation, refund,
  dispute, duplicate replay, and authenticated keyboard/mobile checks were not
  run because this commit has no deployed Preview handler or configured signing
  secret. They remain the activation gate described above.

## Billing correctness fixes, prompt 026

Six defects in the committed prompt 025 implementation (`668cbc7`). No
commercial rule, price, grant, allowance, expiry rule, refund policy or tax
posture changed, and no provider, package or environment variable was added.

### What was verified, against what, on 2026-08-14

The Stripe CLI is not installed in this workspace, so `stripe docs` could not be
used and the live pages were fetched directly.

| surface | source | result |
| --- | --- | --- |
| `invoice.paid` provisioning rule | `https://docs.stripe.com/billing/subscriptions/webhooks` | "Sent when the invoice is successfully paid. You can provision access to your product when you receive this event and the subscription `status` is `active`." Nothing in that guidance involves a PaymentIntent |
| provisionable statuses | the same page's status table | `active` is "in good standing"; `trialing` is where "you can safely provision your product for your customer". `canceled` and `unpaid` say to revoke access |
| `invoice.paid` semantics | `https://docs.stripe.com/api/events/types` | "Occurs whenever an invoice payment attempt succeeds **or an invoice is marked as paid out-of-band**", which is why a PaymentIntent is not guaranteed |
| `refund.created` | the same page | "Occurs whenever a refund is created." A real event type |
| `Invoice.id` | `node_modules/stripe/esm/resources/Invoices.d.ts:130` | required `string`, so it is always available as an idempotency key |
| `Refund.payment_intent` | `node_modules/stripe/esm/resources/Refunds.d.ts:108` | `string`, `PaymentIntent` or `null`, so the existing null guard stays |
| `Subscription.Status` | `node_modules/stripe/esm/resources/Subscriptions.d.ts:473` | the closed union widened by `OtherString`, so an unmodelled status is rejected rather than cast |

Installed SDK `stripe` 22.5.0. No skill covering plpgsql was found; the function
replacement was written against the existing committed function and verified by
reading it back out of `pg_proc`.

### The six corrections

1. **`getPurchaseGrantCredits` filters on the grant reasons.** A reversal
   carries the same `stripe_object_id` as the grant it compensates, and
   `credit_ledger_purchase_object_idx` is partial over the grant reasons only,
   so several rows share one object id. Unfiltered, a second partial refund
   could read the earlier reversal's negative delta and revoke one credit
   instead of the proportional amount. The filter makes at most one row match,
   which the partial index guarantees.
2. **The subscription grant is keyed on the invoice id, not a PaymentIntent.**
   The `invoicePayments.list` lookup and the `Missing invoice PaymentIntent`
   throw are gone, so an invoice settled out of band no longer returns 500 and
   no longer makes Stripe retry the same event for three days. The grant now
   runs only when the synced subscription status is `active` or `trialing`; any
   other status syncs the row, grants nothing, and answers 200.

   **Consequence, stated rather than hidden:** top-up grants stay keyed on the
   PaymentIntent, so `refund.created` against a *subscription* invoice finds no
   grant and reverses nothing. That matches the recorded policy, which scopes
   refund reversal to the associated top-up.
3. **A dispute hold is its own outcome.** `reserve_generation_capacity` returned
   `insufficient_credits` with `credits_remaining = 0` for a held owner, which
   contradicted the real positive balance `/account` was showing at the same
   moment. Migration `0009_billing_hold_outcome.sql` replaces the function so
   the hold branch returns `billing_hold` and the real balance. `/generate`
   renders one plain sentence: the account is on hold while a payment dispute is
   open, and existing images are unaffected. Nothing else in the function moved.
4. **A refund too small to cost a credit costs none.** `Math.max(1, maximum)`
   revoked one credit for a refund whose proportional share floored to zero,
   which contradicted the "only the unspent proportional part" rule. The caller
   now skips the reversal entirely at zero, and `reverse_purchase_credits` keeps
   rejecting a non-positive maximum.
5. **The webhook's two pure decisions moved to `lib/billing/events.ts`** -
   `toBillingSubscriptionStatus`, `isProvisionableStatus` and
   `revocableCreditsForRefund`. It is `server-only`, reads no environment and
   imports nothing. `npm test` gained `--conditions=react-server` so an env-free
   test can import it, exactly as `test:db` and `test:billing-db` already do.
6. **`BillingPanel` composes from the pill halves.** `components/ui/Button.tsx`
   now exports `pillPressable` and `pillPrimarySurface` alongside `pillShape`
   and `pillGhostSurface`. `Button`'s own rendered class lists are unchanged.

### Verification

- `npm run db:generate` reported ten tables and `No schema changes, nothing to
  migrate`, which is correct: the change is a function body, not a schema diff.
  The migration was created with `drizzle-kit generate --custom
  --name=billing_hold_outcome`, which is how a function replacement enters this
  repository's journal. `npm run db:migrate` reported `migrations applied
  successfully!`.
- Reading `pg_proc` back: seven public functions, `'billing_hold'::text` present
  in `reserve_generation_capacity`, the hold branch returning `v_balance`,
  exactly one remaining `insufficient_credits` occurrence, and the same 16
  indexes across the billing and credit tables.
- `npm run lint` completed with no diagnostics.
- `npm test`: 9 tests, 9 pass, 0 fail, including the closed status mapping, the
  provisionable set over all eight statuses plus an unmodelled one, and ten
  refund-proportion cases covering the floor to zero, the clamp to the grant,
  and malformed input.
- `npm run test:billing-db`: 3 tests, 3 pass, including the out-of-order
  subscription update and the `billing_hold` outcome reporting the real balance.
  It also asserts the grant lookup still returns 100 after a reversal wrote a
  second row with the same object id, which is defect 1's regression.
- `npm run test:db`: 1 test, 1 pass.
- `npm run build` compiled, completed TypeScript and generated 18 static pages.
  Its route table `diff` against a stashed baseline build of the same commit
  returned `IDENTICAL`.
- `/` is byte-identical: both prerendered documents were 125,912 bytes and the
  normalised `diff` returned `IDENTICAL`.
- `Button`'s primary and ghost class lists are identical to `HEAD`'s, compared
  as class-token sets. `BillingPanel`'s two button class lists each gain
  `gap-2` and `whitespace-nowrap`, and the primary one gains `hover:bg-lime/90`.
  Nothing was removed. `gap-2` is inert on a button with one text child;
  `whitespace-nowrap` only binds at a width where these short labels do not
  wrap; `hover:bg-lime/90` is a real change, and it is the hover response every
  other primary pill on the site already has, which is the drift the extraction
  exists to remove.
- The environment-absent build passed after clearing `.next`. It generated all
  18 static pages and printed the expected handled community and public-gallery
  fallback messages. `.env.local` was restored and confirmed present.
- The client bundle scan returned zero exact-name hits for `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `BLOB_READ_WRITE_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
  `CLERK_SECRET_KEY` had the one documented SDK name-only hit. Every exact
  secret-value scan returned zero.

### The activation gate is unchanged

`which stripe` returns nothing and `STRIPE_WEBHOOK_SECRET` is absent from
`.env.local`, so the sandbox end-to-end matrix still could not run: no Checkout,
webhook delivery, portal, cancellation, refund, dispute or duplicate-replay
check was performed against Stripe. These corrections are argued from the live
documentation, the installed types and the database, not from a delivered event.
Create the sandbox destination and set `STRIPE_WEBHOOK_SECRET` in Development
and Preview once a deployment of this commit exists, then run that matrix.

**One thing to decide, not to invent.** The approved policy says a dispute
revokes the remaining grant and holds paid generation until Stripe closes the
dispute. It does not say what happens when the dispute is *won*: today
`charge.dispute.closed` lifts the hold for every outcome and restores no
credits. Restoring them would be a new commercial rule, so it was not written.

## Stripe activation and the provider matrix, prompt 027

The activation gate recorded at the end of prompt 026 is closed. The Stripe CLI
is installed, a signing secret exists, and the sandbox end-to-end matrix ran
against the local dev server on 2026-08-14. Everything below was observed, not
argued. Two defects were found; one is fixed here and one needs a decision and
is stated at the end.

### Setup, as it actually happened

`npm install -g @stripe/cli` installed **1.50.0** into the user-owned prefix
`/home/gdk26/.npm-global`, with no `sudo`. npm blocked the package's
`postinstall` under this machine's `allowScripts` policy and the binary works
regardless: `stripe version` reported `1.50.0`.

**No `stripe login` was ever run.** Every command carried
`--api-key "$STRIPE_SECRET_KEY"`, so the CLI and the application provably
addressed the same sandbox. That was proved rather than assumed before anything
else ran: `stripe prices retrieve price_1U4GMqBm5a4nTCBVKiPHN9Fq` returned
`livemode: false`, `active: true`, `lookup_key: ether_studio_monthly_v1`,
`unit_amount: 1500`, `recurring.interval: month`, product
`prod_V4PB2EttLPmgGx` and metadata `ether_credits: 200`,
`ether_offer_key: studio_monthly`, `ether_kind: subscription`,
`ether_catalog_version: v1`. That matches the catalog table above exactly.

`stripe listen --print-secret` produced the signing secret, which was written
into gitignored `.env.local` as `STRIPE_WEBHOOK_SECRET` and never printed. The
forwarder reported API version `2026-07-29.dahlia`, the same version
`lib/billing/stripe.ts` pins. `git check-ignore` confirms `.env.local` is still
ignored, and it is **not** set in the Vercel project: no deployment of the
webhook exists, so there is nothing there for it to authenticate.

The database was empty across all six billing tables when the matrix started,
so every row below was created by the matrix.

### The matrix

| # | result | what was observed |
| --- | --- | --- |
| M1 | **pass** | `checkout.session.completed` `evt_1U4J09Bm5a4nTCBVuU8Fezfu` delivered, answered 200 in 4.4s. Exactly one `top_up_grant` of `+100` keyed on PaymentIntent `pi_3U4J08Bm5a4nTCBV0IFNSom4`; one `billing_webhook_events` row, `processed`; `/account` showed `110`, being the `starter_grant` of 10 plus the top-up. The return landed on `/account?billing=confirmed` and granted nothing by itself |
| M2 | **pass** | `stripe events resend` of the same event was forwarded and answered 200 in 1487ms, against 4.4s first time, because it short-circuits at the claim. The full six-table snapshot `diff` against the previous one returned nothing |
| M3 | **pass** | `customer.subscription.created` and `invoice.paid` both delivered and 200. `billing_subscriptions` row `active` on `price_1U4GMqBm5a4nTCBVKiPHN9Fq`. One `subscription_grant` of `+200` keyed on **invoice `in_1U4J4PBm5a4nTCBVfkpZ9TKO`**, not a PaymentIntent, with `expires_at` equal to the item `current_period_end` to the second. Correction 2 executed against Stripe for the first time |
| M4 | **pass** | Two real `customer.subscription.updated` payloads, `created` 1786706704 and 1786706755, re-delivered under fresh event ids so the claim did not short-circuit. Later first, then earlier: both 200, and `cancel_at_period_end` and `provider_event_created_at` were unchanged by the earlier one. The guard held |
| M5 | **pass, after the fix below** | `openBillingPortal` redirected to `billing.stripe.com`. Cancelling produced `customer.subscription.updated`, and credits stayed spendable: a generation succeeded and spent one credit **from the subscription grant**, not from the perpetual top-up, which is the earliest-expiry-first rule executed against real purchased credits for the first time |
| M6a | **pass** | Two refunds of 9 minor units each on a 1000 charge. `refund.created` delivered both times, and `floor(100 x 9 / 1000) = 0` wrote **zero** ledger rows. Balance unchanged. Correction 4 executed against Stripe |
| M6b | **pass** | A 500 refund produced exactly one `refund_reversal` of `-50`. A third refund of 200 then produced exactly `-20`, computed from the original `+100` grant even though three rows now share that PaymentIntent and one is a negative reversal. Correction 1's regression, executed against Stripe |
| M7a | **pass, with a defect exposed** | `4000000000000259` paid, then `charge.dispute.created` `reason: fraudulent` delivered and 200; `billing_holds` active. **No `dispute_reversal` was written.** See the open finding below |
| M7b | **pass** | `reserve_generation_capacity` returned `outcome: billing_hold` with `credits_remaining: 339`, the real balance, and the ledger was unchanged by the refusal. `/generate` rendered one plain sentence: "This account is on hold while a payment dispute is open. Images you already made are unaffected." Correction 3 executed against a real dispute |
| M7c | **pass** | `stripe disputes close` produced `status: lost`, `charge.dispute.closed` delivered and 200, the hold cleared with `resolved_at` set, and a generation succeeded again. The dispute-won policy was **not** changed and is restated as open below |
| M8 | **pass** | No `stripe-signature` returned `400 {"error":"Missing signature"}`; a forged one returned `400 {"error":"Invalid signature"}`. **Zero** `billing_webhook_events` rows for either id |
| M9 | **pass** | `stripe trigger customer.updated` answered 200 and wrote no row. Six further unmodelled types arrived naturally during the matrix, `customer.created`, `charge.succeeded`, `charge.updated`, `payment_intent.created`, `payment_intent.succeeded`, `invoice.finalized`, `invoice.created`, `invoice.payment_succeeded`, `invoice_payment.paid`, `payment_method.attached` and `charge.dispute.funds_withdrawn`, every one 200 in 4 to 15ms with no row, because the event-type schema rejects before the claim |
| M10 | **the predicted finding, confirmed** | `stripe trigger checkout.session.completed` answered **500** and recorded `status: failed`, `error_category: Error`, `user_id: null`. It was delivered **once and never retried**, because `stripe listen` is a CLI stream and not a registered endpoint. What a retry would do is reasoned, not observed, and is separated out below. Needs a decision |
| M11 | **not run** | Running it requires creating a second Clerk identity or entering a second identity's password, and both are prohibited actions for the implementing agent regardless of authorisation. The two-account boundary therefore still has never been exercised through the browser, as prompt 016 already recorded. It **is** covered at the layer that decides it: `npm run test:billing-db` asserts owner isolation directly against the database |
| M12 | **pass** | The billing controls are reachable in DOM order, user menu then Subscribe then Buy credits then Manage billing, and **no positive `tabindex` exists anywhere on the page**, so DOM order is tab order. All three billing controls resolve `solid rgb(210, 255, 58)` under `:focus-visible` at an offset scaling with the width, which is the `2px solid var(--color-lime)` at `2px` in `app/globals.css` lines 90 and 91, reported as its used value under the browser's 0.75 `devicePixelRatio`. The pending state replaces the label in place inside a fixed `364px 364px` grid, so the pressed pill widens and `min-h-11` fixes the height: no sibling and no following row moved |

Synthetic `Tab` keypresses did not move focus through the browser extension, so
M12's ordering was established from the DOM and the absence of `tabindex`
overrides rather than by pressing Tab. Recorded as the method used, not as an
equivalent.

### The defect that was fixed

**A cancellation through the hosted Customer Portal was recorded as a renewal.**

`upsertBillingSubscription` took `cancelAtPeriodEnd` from
`subscription.cancel_at_period_end` alone. Measured on 2026-08-14 against API
version `2026-07-29.dahlia`, cancelling in the Portal produced a subscription
with `cancel_at_period_end: false`, `cancel_at: 1789384481` equal to the item's
`current_period_end` to the second, `canceled_at` set, and
`cancellation_details.reason: "cancellation_requested"`. The boolean was false
for a subscription that was genuinely cancelling.

The user-visible consequence was verified, not inferred: `/account` rendered
**"active. Renews Sep 14, 2026."** for a subscription Stripe was going to cancel
on Sep 14, 2026. The page stated the opposite of the truth about the customer's
own cancellation.

**The live provider disagrees with its own documentation here**, and that is
worth recording under §1 step 2b. `stripe docs /billing/subscriptions/cancel`,
read the same day through the CLI, says of the period-end path "set
`cancel_at_period_end` to true" and that `customer.subscription.updated` is
"Sent for any subscription update, including when `cancel_at_period_end` is set
to true". `stripe docs api subscription` still describes the field as "Whether
this subscription will (if `status=active`) or did (if `status=canceled`) cancel
at the end of the current billing period." The observed object contradicts all
of that, so both signals are now read and the absolute timestamp is trusted when
the boolean is not set. `Subscription.cancel_at` is `number | null` at
`node_modules/stripe/esm/resources/Subscriptions.d.ts:130`.

The fix is `isPendingPeriodEndCancellation` in `lib/billing/events.ts`, which is
where correction 5 put the handler's pure decisions. A `cancel_at` beyond the
current item period end is a future-dated cancellation and deliberately does
**not** set the flag, so the column keeps exactly the meaning its name and
Stripe's own field description give it. No commercial rule changed: "a cancelled
subscription remains usable through its paid period" was already the rule and
the column already existed to carry it.

Verified against Stripe after the change: a fresh Portal cancellation set
`cancel_at_period_end` to `true`, an intervening Portal renewal set it back to
`false`, and a second cancellation set it to `true` again, so the flag tracks
both directions. `/account` then rendered **"active. Cancels at the end of the
paid period."** `npm test` gained ten assertions covering the boolean alone, the
observed `cancel_at` case, a cancellation earlier than the period end, no
cancellation, a future-dated one, malformed timestamps, and the boolean winning
outright.

### Verification

- `npm run lint` completed with no diagnostics.
- `npm test`: 10 tests, 10 pass, 0 fail.
- `npm run test:db`: 1 test, 1 pass.
- `npm run test:billing-db`: 3 tests, 3 pass.
- `npm run build` compiled, completed TypeScript and generated 18 static pages.
  Its route table `diff` against a stashed baseline of the same commit returned
  `IDENTICAL`: 22 routes, unchanged modes, `/api/stripe/webhook` still dynamic.
- The prerendered `/` comparison returned `IDENTICAL`, both documents 125,912
  bytes, which is the same length prompt 026 recorded.
- The environment-absent build passed after clearing `.next`, produced the same
  22-route table, and `.env.local` was restored and confirmed present with
  `STRIPE_WEBHOOK_SECRET` still in it.
- The client bundle scan returned zero exact-name hits for `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_MCP_KEY`,
  `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. `CLERK_SECRET_KEY` had the
  one documented SDK name-only hit. Every exact secret-value scan returned zero,
  including `STRIPE_WEBHOOK_SECRET` by value.

### Two things to decide, not to invent

**1. A dispute that arrives before its grant revokes nothing, permanently.**

This is the M7a finding and it is a real money-loss path, demonstrated rather
than theorised. The timeline, from the forwarder and the ledger:

- 11:45:03.003 `charge.dispute.created` processed. The hold was set. The
  `dispute_reversal` wrote **nothing**, because no grant existed for that
  PaymentIntent yet, and `getPurchaseGrantCredits` returning nothing is a
  handled outcome that answers 200.
- 11:45:03.741 `checkout.session.completed` processed, writing `top_up_grant`
  `+100` for that same disputed PaymentIntent.

The owner kept 100 credits for a payment that was charged back, and the ledger
ended at 339 where the recorded rule wants 239. The event is marked `processed`,
so Stripe will never retry it and nothing will ever reconcile it.

`4000000000000259` disputes immediately, which is not how real disputes arrive.
The ordering hazard is not an artifact of that, though: Stripe does not
guarantee event order, the grant path makes several Stripe calls and took 4.4s
in M1 while the dispute took 3s, and any dispute delivered before or alongside
its grant loses the revocation the same way.

It is left unfixed because every mechanism that actually closes it is outside
this prompt's scope or changes behaviour that is not mine to choose:

- Throwing on a missing grant so Stripe retries cannot distinguish "no grant
  yet" from "no grant ever", and a dispute on a subscription invoice legitimately
  has no PaymentIntent-keyed grant, so it would fail every retry a registered
  endpoint made. It also depends on retries this setup does not have, per the
  M10 note below.
- Checking the charge's `disputed` flag on the grant path costs a Stripe call on
  every top-up grant and only narrows the window rather than closing it.
- Recording the dispute against the payment so the grant can reconcile in either
  order is the only order-independent fix, and it needs a schema change, which
  this prompt explicitly put out of scope.

**2. M10: a foreign Checkout Session answers 500.**

Confirmed exactly as prompt 027 predicted, and the 500 itself was observed.

**What follows from it was reasoned, not observed, and the first version of this
section overstated it.** Separating the two:

- *Observed.* One delivery, `500`, one `failed` row. `stripe listen` forwarded
  the event once and never again. A CLI listener is a stream, not a registered
  endpoint, so no retry policy applied to this run at all.
- *Documented.* `stripe docs /webhooks/process-undelivered-events`, read
  2026-08-14: "If your webhook endpoint temporarily can't process events, Stripe
  automatically resends the undelivered events to your endpoint for up to three
  days." That is a property of a **registered endpoint**, which this project does
  not have yet.
- *Reasoned from the code, and worth knowing before one exists.*
  `claimBillingWebhook` reclaims a `failed` row **immediately**: its condition is
  `status = 'failed' or (status = 'processing' and attempted_at < now() -
  interval '15 minutes')`, so the 15 minute bound covers only a stuck
  `processing` row and does nothing to slow a retried failure. Once a Dashboard
  destination exists, a foreign session would therefore be re-attempted and
  re-fail on every retry for up to three days.

Answering 200 and ignoring a session whose customer this database does not know
is as much a policy as a bug fix, which is why it was not decided here: it is
also the branch that would hide a genuine misconfiguration, such as the webhook
pointed at the wrong sandbox.

**3. The dispute-won rule is still open**, unchanged from prompt 026.
`charge.dispute.closed` lifts the hold for every outcome and restores no
credits. The dispute in M7c was `lost`, so restoration was not at issue and the
question was not answered by running the matrix. Restoring credits on a won
dispute would be a new commercial rule.

### Still not closed

- **Live mode and Production**, out of scope in 025 and still out of scope.
- **`STRIPE_WEBHOOK_SECRET` in the Vercel project**, and a Dashboard endpoint.
  `stripe listen` needed neither. Do this when a deployment of this commit
  exists.
- **Subscription renewal and credit expiry across a period boundary.** It needs
  a test clock and a Customer created against it, which hosted Checkout does not
  give us. Named as a gap rather than faked.
- **The two-account boundary through the browser**, per M11.

## Dispute ordering and the rest of the 027 findings, prompt 028

Prompt 027 left four things open. All four are closed here, at the option the
user chose on 2026-08-14. Nothing below is new product surface: every item is a
defect or a decision that 027 demonstrated against the live sandbox.

### The schema change

`billing_holds` gains one column and one index, migration
`drizzle/0010_messy_silver_sable.sql`:

```sql
ALTER TABLE "billing_holds" ADD COLUMN "stripe_payment_intent_id" text;
CREATE INDEX "billing_holds_payment_intent_idx" ON "billing_holds" USING btree ("stripe_payment_intent_id");
```

Nullable, because the one row that predates it could not be backfilled from the
table. It is populated in practice: the replay in item 3 filled the existing row
with `pi_3U4JXhBm5a4nTCBV3GjK4c7g`, so no null remains in the dev database.

### Item 1 — a dispute delivered before its grant now still revokes

**The mechanism, read from `pg_proc.prosrc` on 2026-08-14 rather than assumed.**
`reverse_purchase_credits` opens with

```
SELECT * INTO "v_grant" FROM credit_ledger WHERE stripe_object_id = "p_object_id"
  AND reason IN ('subscription_grant','top_up_grant') FOR UPDATE;
IF NOT FOUND THEN RETURN 0; END IF;
```

so a dispute that arrives first revokes nothing and reports success. Its
idempotency is `IF "v_revoke" > 0 AND NOT EXISTS (SELECT 1 FROM credit_ledger
WHERE stripe_event_id = "p_event_id")`, and **the dedupe key is whatever the
caller passes.** That is the whole hinge of the fix.

Three changes, no new database function and no change to that function's body:

1. **The dispute reversal is keyed on `dispute.id`, not `event.id`.** `du_…` is
   the one identifier both the dispute handler and the grant path can derive, so
   the existing `stripe_event_id` dedupe makes the two paths idempotent against
   each other for free. Keyed on `event.id` they could not be, because the grant
   path does not have the dispute's event id.
2. **The hold is recorded before the reversal is attempted**, and it now carries
   the PaymentIntent. `charge.dispute.closed` records it too, so a dispute first
   seen at close is still durable; that branch still writes no ledger row.
   `setBillingHold`'s upsert uses `coalesce(excluded.stripe_payment_intent_id,
   billing_holds.stripe_payment_intent_id)`, so an event that cannot resolve the
   payment never erases one that could.
3. **The top-up grant path replays whatever is recorded**, through
   `getDisputesForPaymentIntent`, immediately after `grantPurchaseCredits`
   succeeds. One indexed query on a table with one row.

**Scoped to top-up grants, deliberately.** Subscription grants are keyed on the
invoice id (correction 2), and the recorded policy scopes reversal to the
associated top-up, so a dispute on a subscription invoice finds no grant by
design. That is existing recorded behaviour, not something this prompt changed.

**One consequence worth naming.** The replay does not filter on `active`, so a
dispute whose only delivered event was `charge.dispute.closed` will also be
replayed once its grant lands. That follows the recorded rule, "a dispute
revokes the unspent grant and a close restores nothing", rather than departing
from it, but it is a case the close branch could not previously reach at all.

**Dispute id stability was not taken on faith.** `stripe docs api dispute`, read
2026-08-14, gives `id` as the Dispute's own identifier and
`charge.dispute.closed` as an event whose `data.object` is that same dispute
with a changed `status`. The 027 matrix already proved it empirically: M7c's
close event cleared the hold keyed on the `du_…` written by M7a's created event.

### Item 2 — a foreign Checkout Session now answers 200

Every Session this app creates sets `metadata: { ether_offer_key: offer.key }`
in `app/(app)/account/billing/actions.ts`. The handler now validates that marker
with `checkoutSessionMarkerSchema` against the existing `BILLING_OFFER_KEYS`
enum, before it makes any Stripe call:

- no valid marker: **200, ignored, no work.** It is not ours.
- our marker present and the work then fails: **still 500.** That is a genuine
  misconfiguration and swallowing it is exactly what should not happen.

This is a **tightening** of the trust boundary, not a loosening: the handler now
requires its own marker before treating a Session as a purchase.

### Item 3 — the leftover ledger state is corrected

Replayed through the fixed code against the real event, rather than compensated
with a hand-written SQL row. `evt_1U4JXjBm5a4nTCBVKzwFsz9Z` was already
`processed`, so a resend short-circuits at the claim; its one dev row was set
back to `failed`, which `claimBillingWebhook` reclaims immediately. That is
stated here rather than done quietly.

The ledger now holds exactly one `dispute_reversal`, `-100`, keyed on
`du_1U4JXiBm5a4nTCBV8ADfC0Pl` against `pi_3U4JXhBm5a4nTCBV3GjK4c7g`, and the
balance is **238** where 027 left it at 338. The 238 rather than 239 is the
second generation M7c ran, exactly as the prompt predicted.

### Item 4 — Subscribe is no longer offered to an active subscriber

`ENDED_SUBSCRIPTION_STATUSES` in `lib/billing/events.ts` is now the one list,
read by both the Checkout action and `/account`. `hasLiveSubscription` is its
reader. **The action's refusal is untouched** and remains the enforcement;
hiding the control is presentation only (`AGENTS.md` §6.2, §11 rule 2).

### Verified against the live sandbox, 2026-08-14

The forwarder ran as in 027, `stripe listen --forward-to
localhost:3000/api/stripe/webhook` with `--api-key "$STRIPE_SECRET_KEY"`, API
version `2026-07-29.dahlia`. Every line below was observed.

| what | result |
| --- | --- |
| M10 replayed, `evt_1U4JeDBm5a4nTCBVADKmnxQm` | **200** where 027 got 500. Row `processed`, `error_category` null, `user_id` null, **zero** ledger rows, balance unchanged at 338. Item 2's first half |
| the M7a dispute replayed, `evt_1U4JXjBm5a4nTCBVKzwFsz9Z` | 200. Hold gained `pi_3U4JXhBm5a4nTCBV3GjK4c7g`, one `dispute_reversal` of `-100` keyed on `du_1U4JXiBm5a4nTCBV8ADfC0Pl`, balance **338 → 238**. Item 1 and item 3, on the exact data that exposed the defect |
| the grant event replayed after that, `evt_1U4JXjBm5a4nTCBVXWDHs0Ap` | 200. The new grant-path replay ran live against an already-reversed dispute and wrote **nothing further**: still exactly one reversal, still 238. This is the exactly-once guarantee, measured |
| the close event replayed, `evt_1U4Jc2Bm5a4nTCBVldZuJueT` | 200. Hold inactive with `resolved_at` set, PaymentIntent **retained** through the `coalesce`, no ledger row. Restores the dispute's true end state |
| `stripe trigger checkout.session.completed --add "checkout_session:metadata[ether_offer_key]=top_up_100"` | **500**, row `failed`. The event was confirmed to carry `metadata: {"ether_offer_key": "top_up_100"}` before the assertion was made. Item 2's second half |
| `/account` on the dev owner, whose subscription is `active` | **No `Subscribe` control.** Buttons are the user menu, `Buy credits`, `Manage billing`, `Save defaults`, `Delete account`; credits `238`; "active. Cancels at the end of the paid period."; **zero** positive `tabindex` anywhere, so DOM order is still tab order as M12 recorded |

**Which direction was covered how, stated rather than blurred** (§12 rule 3).
The dispute-**before**-grant direction was proved end to end against Stripe, on
the original event. The dispute-**after**-grant direction was **not** forced
through a fresh hosted Checkout: that needs a second card entry in the browser,
which is a prohibited action for the implementing agent. It is covered two other
ways, and both were run: the grant-event replay above exercises the new
grant-path code against a recorded dispute live, and
`tests/billing-db.integration.ts` asserts both orderings directly against the
database, each ending at exactly one `-100` reversal keyed on the dispute id.

### Checks

- `npm run db:generate` produced `drizzle/0010_messy_silver_sable.sql`;
  `npm run db:migrate` applied it successfully.
- `npm run lint` completed with no diagnostics.
- `npm test`: 12 tests, 12 pass, 0 fail, up from 10.
- `npm run test:db`: 1 test, 1 pass.
- `npm run test:billing-db`: 5 tests, 5 pass, up from 3.
- `npm run build` compiled, completed TypeScript and generated 18 static pages.
  Its route table `diff` against a stashed baseline returned `IDENTICAL`: 22
  routes, unchanged modes, `/api/stripe/webhook` still dynamic.
- The prerendered `/` comparison returned `IDENTICAL`, both documents **125,912
  bytes**, the same length prompts 026 and 027 recorded.
- The environment-absent build passed and produced the same 22-route table.
  `.env.local` was restored and confirmed present with `STRIPE_WEBHOOK_SECRET`
  still in it.
- The client bundle scan returned zero exact-name hits for every secret except
  the one documented `CLERK_SECRET_KEY` SDK name-only hit, and **zero by value
  for all eleven**, including `STRIPE_WEBHOOK_SECRET` and
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

No environment variable was added, so the `AGENTS.md` §8.4 table is unchanged.

### Still open, and deliberately not decided here

**1. The per-refund proportional floor.** Many sub-credit refunds can each floor
to zero and cumulatively return real money while revoking no credits. M6a
demonstrated the floor working as recorded, twice, on 9-unit refunds of a 1000
charge. Accumulating the unrevoked remainder across refunds would be a **new
commercial rule**, not a bug fix, so it is carried forward rather than chosen.

**2. The dispute-won rule**, unchanged from 026 and 027. `charge.dispute.closed`
lifts the hold for every outcome and restores no credits. Restoring them on a
won dispute would be a new commercial rule.

**3. The same ordering race on `refund.created`, named rather than left to be
rediscovered.** It has the identical `RETURN 0` shape. It is not fixed here
because a refund cannot be created before its payment succeeds, so the grant is
normally already written, and item 1's machinery does not generalise to it
without recording refunds too.

**4. Everything 027 listed as not closed** is still not closed: live mode and
Production, `STRIPE_WEBHOOK_SECRET` in the Vercel project and a Dashboard
endpoint, renewal and credit expiry across a period boundary, and the two-account
boundary through the browser.

## Refund ordering, renewal and expiry, prompt 029

Two items off the list above, and neither was a decision. Item A closes the
`refund.created` ordering race that 028 named as its item 3. Item B is the first
evidence this project has that the monthly subscription actually renews and that
the previous period's unspent credits actually expire.

### The schema change

`drizzle/0011_safe_maverick.sql`, generated by `npm run db:generate` and applied
with `npm run db:migrate`. One table, no change to any function:

```sql
CREATE TABLE "billing_refunds" (
	"stripe_refund_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"refund_amount" integer NOT NULL,
	"charged_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "billing_refunds_payment_intent_idx" ON "billing_refunds" USING btree ("stripe_payment_intent_id");
```

Both amounts are stored rather than re-fetched because the replay runs inside
the grant path and computes `revocableCreditsForRefund` there, without a second
`paymentIntents.retrieve`. They are provider amounts in minor units, a charge
total and a refund total, and nothing about a person (§8.3).
`stripe_payment_intent_id` is `not null`, unlike the dispute table's, because
the table is new and has no pre-existing row to accommodate.

### Item A — a refund delivered before its grant now still revokes

The defect was three lines in `app/api/stripe/webhook/route.ts`:
`getPurchaseGrantCredits` returned nothing, the branch returned the owner id,
the event was marked `processed`, and the revocation was gone. Identical shape
to the dispute race 028 fixed.

The fix is 028's, applied to refunds:

- `recordBillingRefund` writes the row **before** the reversal is attempted, so
  a grant still in flight has something to find.
- Both reversals key on **`refund.id`**, not `event.id`. `re_…` is the one
  identifier the refund handler and the grant path can both derive, so
  `reverse_purchase_credits`'s existing
  `NOT EXISTS (… WHERE stripe_event_id = p_event_id)` makes them idempotent
  against each other. **No new PL/pgSQL function, and `reverse_purchase_credits`
  is unchanged.** `refund.created` fires once per refund, so keying on the
  refund rather than the event loses no idempotency.
- The top-up grant path replays recorded refunds **before** recorded disputes. A
  dispute revokes everything and the reversal caps at whatever is left unspent,
  so running the dispute first would leave a partial refund's proportional row
  with nothing to take. The total is the same either way; the order is what
  makes the ledger read as the history that actually happened.
- `getRefundsForPaymentIntent` returns the refund id and both amounts, oldest
  first, mirroring `getDisputesForPaymentIntent`.

Scoped to top-up grants, which is existing recorded behaviour rather than a
choice made here: a subscription grant is keyed on the invoice id, so
`getPurchaseGrantCredits(paymentIntentId)` finds nothing for a refunded
subscription invoice and the replay never fires.

**Which direction was covered how, stated rather than blurred** (§12 rule 3).
Both directions are covered in `tests/billing-db.integration.ts`, against the
real database and the real functions, in the test
`a refund revokes exactly once whichever order it and its grant arrive in`.
**Neither direction was forced through the live sandbox in this prompt**, for
the same reason 028 recorded: producing a real refund against a real grant needs
a fresh hosted Checkout with a card entered in a browser, which the implementing
agent may not do. The test drives the same four functions the handler calls, in
the same order, and asserts:

| assertion | result |
| --- | --- |
| refund first: the handler's own reversal writes **no** ledger row | 0 rows, the money-loss path reproduced |
| the grant lands, the replay runs | balance 110 → 85 |
| a **partial** refund revokes only its proportional share, 2500 of a 10000 charge against a 100-credit grant | one row, `-25` |
| re-running the replay and the handler | balance still 85, still exactly one row, keyed on `re_…` |
| grant first: the replay finds nothing, the handler revokes | 110 → 85, one row `-25` |
| a late replay after the handler already revoked | no second row |

`revocableCreditsForRefund` was not changed, so `tests/billing.test.ts` has an
empty diff for this prompt. Saying so rather than padding it.

### Item B — renewal and expiry need two procedures, and this is why

**A Stripe test clock moves Stripe's clock. `reconcile_credit_balance` expires a
subscription grant on `g.expires_at <= now()`, where `now()` is PostgreSQL's.**
Advancing a test clock past a period end does not move the database one second.
A test-clock run can prove the renewal and can prove nothing at all about the
expiry, and proving both with one procedure would be a fabricated measurement
(§12 rule 4). A later session should not try it.

#### B1 — renewal, against the live sandbox with a test clock, 2026-08-14

Test clock frozen at the real current time, a `Customer` created with the
`test_clock` parameter, `pm_card_visa` attached and set as
`invoice_settings.default_payment_method`, one `billing_customers` row inserted
for a throwaway owner, and a subscription at the catalog price
`price_1U4GMqBm5a4nTCBVKiPHN9Fq` (`ether_studio_monthly_v1`, verified live the
same day: `active: true`, `livemode: false`, 1500 usd/month, 200 credits).
`stripe listen` forwarded to the local dev server throughout. The throwaway
owner, its mapping row, its ledger rows and the clock itself were all deleted
when the run finished; `stripe test_helpers test_clocks list` returns none.

**The docs' "advance the time by one hour" is not sufficient, and this cost two
failed runs.** Advancing to `current_period_end + 60` and then a further 3900
seconds left the renewal invoice in `draft` indefinitely — polled 40 times over
200 seconds of real time, still `draft`. The invoice states its own deadline in
`automatically_finalizes_at`; advancing past **that** finalises and pays it
immediately. Read the field, do not count an hour from the period end.

Assertions, all met:

| assertion | result |
| --- | --- |
| two `invoice.paid` events produce two `subscription_grant` rows | 2 rows, `in_1U4PefBm5a4nTCBVmZ9VwKmg` and `in_1U4PeyBm5a4nTCBVxxFE7Qrv`, `+200` each |
| keyed on two different invoice ids | 2 distinct ids |
| the renewal grant's `expires_at` is the **new** period end | `2026-10-14T18:16:29Z`, equal to the subscription row's `current_period_end` |
| the subscription row's period moved forward and the status is still `active` | period start `2026-09-14`, end `2026-10-14`, `active` |
| exactly one grant per invoice: the renewal `invoice.paid` re-delivered | 200, still 2 grant rows |

**And the expiry rule was observed running as a side effect**, which is the part
no test could have shown: the renewal grant wrote a `subscription_expiry` of
`-200` against the first period's grant at grant time. That is
`grant_purchase_credits`'s own loop, not `reconcile_credit_balance`'s — a
subscription grant expires every unexpired subscription grant before it, so a
renewal does not wait for the clock to catch up.

The re-delivery was signed with `generateTestHeaderStringAsync` and posted to
the local endpoint. **Only the transport was synthetic**: the event id and the
payload were Stripe's own, taken from `stripe.events.list`. `stripe.events.resend`
does not exist on the Node SDK at `stripe@22.5.0`; it is a CLI command.

One 500 was produced during a failed earlier run, on
`customer.subscription.deleted`, and it is a cleanup artifact rather than a
finding: deleting the test clock deletes its customer, and the mapping row had
already been removed, so `ownerFor` threw `Unknown Stripe customer` as designed.
The final script deletes the clock first and drains the events before removing
the row.

#### B2 — expiry, in `tests/billing-db.integration.ts`

There was no expiry coverage in that file at all before this prompt. The new
test writes a grant with a future `expires_at` and then moves it into the
**real** past, which is the only thing `reconcile_credit_balance` responds to.

| assertion | result |
| --- | --- |
| a fully unspent expired `subscription_grant` expires whole | one row, `-50`, balance 85 → 35 |
| reconciling twice writes the expiry once | still one row, still 35 |
| a **partially spent** grant expires only the remainder | 100 granted, 6 spent, one row `-94`, balance 104 → 10 |
| a `top_up_grant` with a null `expires_at` is untouched | the 25 bought credits survive both reconciles |

The partial case spends through `reserve_generation_capacity` and
`settle_generation_credits` rather than writing ledger rows by hand, so the
spend is the real one. The reservation takes from the subscription grant first,
because that function orders grants `expires_at ASC NULLS LAST`.

### Checks

- `npm run db:generate` produced `drizzle/0011_safe_maverick.sql`;
  `npm run db:migrate` applied it successfully.
- `npm run lint` completed with no diagnostics.
- `npm test`: 12 tests, 12 pass, 0 fail. Unchanged, as expected: no pure
  function changed.
- `npm run test:db`: 1 test, 1 pass.
- `npm run test:billing-db`: **7 tests, 7 pass**, up from 5.
- `npm run build` compiled and generated 18 static pages. Its route table `diff`
  against a stashed baseline of `9398b8b` returned `IDENTICAL`: 22 routes,
  unchanged modes, `/api/stripe/webhook` still dynamic.
- The prerendered `/` comparison returned `IDENTICAL`, both documents **125,912
  bytes**, the same length prompts 026, 027 and 028 recorded.
- The environment-absent build passed and produced the same 22-route table.
  `.env.local` was restored and confirmed present.
- The client bundle scan returned zero exact-name hits for every secret except
  the one documented `CLERK_SECRET_KEY` SDK name-only hit, and **zero by value**
  for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLERK_SECRET_KEY`,
  `BLOB_READ_WRITE_TOKEN` and `CLOUDFLARE_API_TOKEN`.

No environment variable was added, so the `AGENTS.md` §8.4 table is unchanged.

### Still open, after 029

**1. The per-refund proportional floor**, carried forward from 028 item 1. The
user chose on 2026-08-14 to keep it as it is: accumulating the unrevoked
remainder across many sub-credit refunds would be a new commercial rule, not a
bug fix.

**2. The dispute-won rule**, carried forward from 028 item 2 by the same
decision. `charge.dispute.closed` lifts the hold for every outcome and restores
no credits.

**3. Not deployed, and unchanged from 027 and 028:** live mode and Production, a
Dashboard webhook endpoint, and `STRIPE_WEBHOOK_SECRET` in the Vercel project.

**4. The two-account boundary through the browser**, still blocked for the same
reason: it needs two real sign-ins and a card entry.

**028's item 3 is closed by item A above**, and its item 4's "renewal and credit
expiry across a period boundary" is closed by item B.

## The cross-owner data boundary, prompt 030

`AGENTS.md` §8.3 rule 4 — "two accounts must not see each other's generations,
and that is verified against the database, not by clicking around" — had never
been satisfied as a repeatable check. Prompt 016 could not run it because the
database held exactly one owner. Prompt 027's M11 recorded it as not run,
because a second Clerk identity is a prohibited action for the implementing
agent. `docs/automation.md` held the procedure, but it was a throwaway module in
`/tmp` and nothing in the repository ran it.

`tests/owner-boundary.integration.ts` closes the database half of that rule.
`npm run test:owner-db` runs it, with the same `dotenv -e .env.local --` and
`--conditions=react-server` discipline as `test:db` and `test:billing-db`.

### What it asserts

Six tests, each with two synthetic owner ids suffixed with a fresh
`crypto.randomUUID()`, cleanup in `finally`, and an aggregate assertion that no
row remains for either id across `generations`, `usage_events`, `reports`,
`user_preferences` and `credit_ledger`. Every assertion drives a real function
from `lib/db/`, so what is proved is the query text the application runs.

| test | functions driven | the boundary asserted |
| --- | --- | --- |
| the owner reads | `listGenerationsForUser`, `countGenerationsForUser`, `getGenerationForOwner`, `listLibraryPage` (live, removed, and searched), `readAccountExport`, `listAllImageUrlsForOwner` | B's reads never return A's row, including a search term drawn from A's own prompt |
| the owner mutations | `setGenerationVisibilityForOwner`, `softDeleteGenerationForOwner`, `restoreGenerationForOwner`, `deleteGenerationForOwner`, `getGenerationForOwnerIncludingRemoved` | each returns `undefined` for the wrong owner **and** leaves the row unchanged on a re-read as the owner, then does what it says when the owner runs it |
| the anonymous projections | `getShareableGeneration`, `listCommunityGenerations`, `listPublicGenerations` | only `unlisted`/`public` is shareable, only `public` reaches Community and the landing strip, a soft-deleted public row leaves both, and each projection's **own key list** is asserted so a later column addition fails the test rather than leaking |
| moderation, both directions | `claimReport`, `completeReportWithTakedown`, then the reads above | B cannot report A's private row; A cannot report their own row (`user_id <> reporter_user_id`); B reports once, the second is `duplicate`; a taken-down row leaves A's own reads and every anonymous projection; A's export lists no report filed against them and contains **no reporter id anywhere** in its serialised payload |
| the usage reading | `readOwnerUsageSummary` | A's usage events do not move B's rolling or daily totals |
| the purge | `purgeOwnerData`, `ownerHasPublicGeneration`, `readAccountExport`, `readCreditBalance`, `countGenerationsForUser`, `listAllImageUrlsForOwner` | purging A empties A, and B's count, serialised export and credit balance are identical before and after, asserted by value |

### The three deliberate omissions, and why

- **`reserveGenerationQuota` is not called.** It takes the shared
  provider-daily advisory lock and an accepted reservation spends real global
  allocation. The usage rows are inserted straight through the schema instead;
  the function under test is the owner-filtered `readOwnerUsageSummary`, which
  takes no lock. The reason is written as a comment in the file so a later
  session does not "fix" it.
- **`getPublicGalleryImages` and `getCommunityGenerations` are not called.**
  They wrap the two uncached functions in `unstable_cache`, a Next.js
  request-scoped primitive with no meaning inside `node:test`. The uncached
  functions underneath them carry the visibility filter, and those are what the
  test drives.
- **No Blob object is written or asserted gone.** `image_url` is a synthetic
  string, so `docs/automation.md`'s Blob-polling clause does not apply. That
  clause, and the `/tmp` procedure around it, stay in `docs/automation.md` for a
  path this suite does not cover.

### Nothing is printed

Not an owner id, not a prompt, not a row id, not a url. Every assertion is on a
boolean, a count, or a list of property names, and its message names the
property that failed rather than its value. Where a whole object had to be
compared — the purge's before-and-after export — it is compared as a serialised
string so a failure reports `false !== true` rather than the other owner's data.
The synthetic image urls deliberately embed no owner id, which is what makes the
`JSON.stringify(export).includes(otherOwner)` assertion meaningful.

### One finding, and it was in the test

The purge test failed on its first run: B's export differed before and after.
The cause was the test's own read ordering, not `purgeOwnerData`.
`read_credit_balance` calls `reconcile_credit_balance` before it answers, and
that function inserts the 10-credit `starter_grant` row for an owner who has no
ledger row yet (`drizzle/0008_nosy_doctor_octopus.sql`). Reading the balance
*after* the export snapshot therefore put a row in the second snapshot only. The
balance is now read first, with a comment saying why. **No change was made to
`lib/db/`**, and none was needed: the purge is correct.

### Verification, 2026-08-14

- `npm run test:owner-db`: **6 tests, 6 pass, 0 fail**, 97,282 ms. The duration
  is Neon scale-to-zero plus six sequential round-trip-heavy tests over the
  pooled HTTP endpoint, not a performance finding.
- `npm test`: 12 tests, 12 pass. Unchanged, as expected: no pure function
  changed.
- `npm run test:db`: 1 test, 1 pass. `npm run test:billing-db`: 7 tests, 7 pass.
  Both unchanged.
- `npm run lint` completed with no diagnostics.
- `npm run build` compiled. Its route table `diff` against a stashed baseline of
  `0a1dd57` returned `ROUTES IDENTICAL`: 22 routes, unchanged modes.
- The prerendered `/` comparison returned `LANDING IDENTICAL`, both documents
  **125,912 bytes**, the same length prompts 026 through 029 recorded.
- The environment-absent build passed and produced the same route table.
  `.env.local` was restored and confirmed present.
- No environment variable was added, so the `AGENTS.md` §8.4 table is unchanged
  and no client-bundle secret scan was warranted.

### Still open, after 030

**1. The two-account boundary through the browser.** Unchanged and still
blocked: it needs two real Clerk sign-ins, which is a prohibited action for the
implementing agent (M11). This prompt closes the database half of §8.3 rule 4
completely and does not pretend to close the other. What remains unproved by
machine is the *session* layer — that `proxy.ts`, the page-level `auth()` calls
and the action-level session reads resolve the right owner for two concurrent
real users. Every query those layers call is now proved owner-safe.

**2, 3 and 4.** The per-refund proportional floor, the dispute-won rule, and
"not deployed" (live mode, Production, a Dashboard webhook endpoint,
`STRIPE_WEBHOOK_SECRET` in the Vercel project) all carry forward from 029
unchanged. The first two are decided, not bugs.

**A correction to `AGENTS.md` §2, made in this change** (§12 rule 8): its list
of "scripts that currently exist in `package.json`" was missing
`test:billing-db`, which prompt 027 added. Both it and the new `test:owner-db`
are now listed.

---

## Prompt 031 — the production deployment, and a registered Stripe webhook

Executed 2026-08-14. **No application code changed.** This prompt moved the
production alias onto the current `main`, put the two Stripe variables the
deployed code actually reads into Production, and turned `stripe listen` into a
registered test-mode endpoint. It stays in test mode throughout.

### What is deployed

| fact | value |
| --- | --- |
| project | `ether`, `prj_WuHQTQwVWyda8rmWcKygCx48It2l`, team `team_zE3mp7nrEZ6a7cxRavwUMYC4` |
| **Git-connected** | **yes** — settled here, which prompt 031 could not settle in advance. The project record's `link` is `{"type":"github","repo":"ether","org":"gerald-donkor","productionBranch":"main"}`. `vercel project inspect` prints no Git section, which is why it looked ambiguous; the project API answers it |
| repo visibility | `githubRepoVisibility: "public"` — the GitHub repository is public |
| deployment | `dpl_H5UZ7omZHHe8vLUvN2gQpZ2npFRs`, `ether-4s2h9vkpk-dgsloxx417s-projects.vercel.app` |
| commit | `e243e9311365bd11255a71f6c1a143e9b45c4bb2`, branch `main` |
| build | READY in **41s**, Turbopack, `nodejs` runtime |
| aliases | `ether-bay.vercel.app`, `ether-dgsloxx417s-projects.vercel.app`, `ether-git-main-dgsloxx417s-projects.vercel.app` |
| previous production | `dpl_6bx874BB3A49iBwfEX3hFSyn3qqn`, from `82f22b8`, two days old |

The deploy path was the Git integration, not `vercel deploy --prod`: `git push
origin main` moved the remote `82f22b8..e243e93` (19 commits, the 18 the prompt
counted plus its own prompt-file commit) and Vercel built from the push.

### The registered endpoint

Created against the **v1 `webhook_endpoints`** surface, verified live on
2026-08-14 via `stripe docs api POST /v1/webhook_endpoints` before it was run.
The reference is explicit that the response "returns the webhook endpoint object
with the secret field populated" — the signing secret is available **only in the
creation response**, so it was piped straight into `vercel env add` in the same
command and never printed.

| field | value |
| --- | --- |
| id | `we_1U4RFxBm5a4nTCBVkXWqfDko` |
| url | `https://ether-bay.vercel.app/api/stripe/webhook` |
| status | `enabled` |
| livemode | `false` |
| enabled_events | the nine in `BILLING_EVENT_TYPES`, exactly |

It points at **the alias**, never a deployment-specific URL: the project's
`ssoProtection` is `{ enabled: true, deploymentType: "all_except_custom_domains" }`,
so per-deployment URLs answer 302 to an SSO gate while the alias answers 200.

### Environment variables, after this change

Names only (§8.4). Both new entries were stored as **Sensitive**.

| variable | environments | note |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | **Production** (Sensitive), plus Development, Preview | the Production entry is new. Test-mode key, same value |
| `STRIPE_WEBHOOK_SECRET` | **Production** (Sensitive) | new, and it is the **registered endpoint's** secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_MCP_KEY` | Development, Preview only | **deliberately not added.** `grep -rn` over `app components lib` returns no match for any of them |

**Two different `STRIPE_WEBHOOK_SECRET` values now exist and must not be
confused.** `.env.local` still holds the `stripe listen --print-secret` value,
which is what local development verifies against and which was **not** modified.
The Vercel Production value is the registered endpoint's. Pasting either one
into the other's place makes every delivery fail signature verification.

### Checks, with their output

- `git status --porcelain` was empty before the deploy.
- `npm run build` compiled. Route table: **22 routes**, modes unchanged against
  the `8cc7f75` baseline — `ROUTES IDENTICAL`.
- The prerendered `/` was **125,912 bytes**, the same length prompts 026
  through 030 recorded — `LANDING IDENTICAL`.
- `npm run lint` completed with no diagnostics.
- `npm test`: 12 tests, 12 pass.
- `npm run test:db`: 1 pass. `npm run test:billing-db`: 7 pass.
  `npm run test:owner-db`: 6 pass. All unchanged, as no code changed.
- The environment-absent build passed and produced the same 22-route table.
  `.env.local` was restored and confirmed present.
- `curl https://ether-bay.vercel.app/` → **200**.
- `curl -X POST https://ether-bay.vercel.app/api/stripe/webhook` → **404 before
  the deploy, 400 after**, body `{"error":"Missing signature"}`. That is the
  route's own signature check rejecting an unsigned request, and it is the first
  time this endpoint has been reachable from the internet.
- All 22 routes were probed on the alias. The twelve static marketing routes and
  both auth screens answer 200; `/api/stripe/webhook` answers **405** to a GET;
  an unknown path answers 404. The four protected routes answer 404 — see the
  finding below.

#### The delivery, proved from both sides

`stripe trigger checkout.session.completed` against the sandbox produced
`evt_1U4RPrBm5a4nTCBVU2SHuG7D`, `livemode=false`.

- **Stripe's side:** `pending_webhooks` was **0** on the first poll and stayed 0
  across three rounds. Stripe considers the delivery complete.
- **Our side:** exactly **1** row in `billing_webhook_events` for that event id —
  `type: checkout.session.completed`, `status: processed`, `error_category:
  null`, `user_id` null, `processed_at` set. No row content beyond status was
  read or printed.

The null `user_id` is the expected path and not a defect: a `stripe trigger`
session is **foreign**, carrying no `ether_offer_key` marker, so prompt 028's
fix answers 200 and ignores it. That is a weak assertion about billing and a
strong one about everything this prompt changed. Over the network, for the first
time in this project's history, it proves the endpoint is registered and
reachable; that **signature verification passes with the registered secret**,
which no local run has ever exercised; that the deployed Function holds both
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; and that the deployed build
reaches Neon, because `claimBillingWebhook` writes before the handler returns.

#### Logs

`vercel logs` on the deployment shows method and path only — `λ POST
/api/stripe/webhook` at 20:09:24 is the delivery. **No prompt, no email address,
no request body and no error appears anywhere in them** (§8.3 rule 2). The only
non-request output is Clerk's development-instance telemetry notice.

#### The client-bundle secret scan

Warranted even with no code change, because a deployed bundle was served on this
commit for the first time (§8.4, "verify it, do not assume it"). All 16
referenced `/_next/static` assets were downloaded from the alias (2.3 MB) and
scanned alongside the served HTML.

`sk_test_`, `sk_live_`, `whsec_`, `vercel_blob_rw_`, `npg_`, `postgresql://`,
`postgres://`, `rk_test_`, and the literals `BLOB_READ_WRITE_TOKEN`,
`DATABASE_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` are **all absent**.

`pk_test_` is present, 10 hits, and is the **positive control**: it is the Clerk
publishable key, it is public by design, and its presence proves the scan would
have found a secret if one were there.

`CLERK_SECRET_KEY` matched twice and is **not a leak**. The context is
`i.default.env.CLERK_SECRET_KEY` inside Clerk's isomorphic bundle — a property
*read* on the env object, i.e. the variable name in code Next never inlines,
since only `NEXT_PUBLIC_*` is inlined into client bundles. No value accompanies
it. The two hits are one occurrence in one chunk, counted twice because the
chunk was downloaded under two filenames.

### Finding: the protected routes answer 404, not a sign-in redirect

`/generate`, `/account`, `/account/export` and `/library` return **404** to a
signed-out client rather than redirecting to `/sign-in`. The response headers
name the cause exactly:

```
x-clerk-auth-reason:  protect-rewrite, dev-browser-missing
x-clerk-auth-status:  signed-out
x-matched-path:       /404
```

**The security boundary holds** — a signed-out caller receives no protected
content, `proxy.ts`'s `auth.protect()` is doing its job, and this is not a
regression from this prompt, which changed no code. What is wrong is the
experience, and the cause is the Clerk **development** instance recorded below:
a development instance carries its session in a `__clerk_db_jwt` querystring
rather than a cookie, so a client that has not completed the dev-browser
handshake is rewritten to 404 instead of redirected. A cookie jar does not fix
it, because the mechanism is not cookie-based. Fixing it properly is the Clerk
production instance, which is gated on a custom domain. **Not fixed here**: a
code change was out of scope for this prompt.

### Still open, after 031

**1. Clerk is running on a development instance, and this is now the largest
open item.** The publishable key resolves to
`healthy-chamois-55.clerk.accounts.dev`, and it is the same `pk_test_` key on
Production, Preview and Development. Three independent confirmations landed
here: the `dev-browser-missing` header above, Clerk's telemetry notice in the
deployment logs, and the key itself.

Read live from Clerk's docs on 2026-08-14 rather than asserted, a development
instance is:

- **capped at 100 users**;
- **not crawlable by search engines**;
- unable to transfer user data to another instance — **accounts created on this
  deployment do not survive the move to production**;
- carrying a deliberately relaxed security posture, and a querystring-based
  session rather than an `HttpOnly` `__client` cookie.

A production instance requires a **custom domain with CNAME records**, and
`vercel domains ls` returns `0 Domains found under dgsloxx417s-projects`. That
is a billable decision and it is the user's (§7.4 rule 4). Until it is made,
**this is a test-mode deployment on a development identity provider, and no copy
anywhere claims otherwise.**

**2. Production and local share one Neon branch.** `vercel env ls` shows a
single `DATABASE_URL` across Production, Preview and Development, so the
deployed app writes into the same database `npm run test:db`,
`test:billing-db` and `test:owner-db` write into — and the delivery row proved
above was read out of that shared database. A separate Neon branch for
Production is the obvious answer, but it is a provisioning change and §7.4 says
to ask first. Left for the user.

**3. The two-account boundary through the browser.** Unchanged. It needs two
real Clerk sign-ins, still a prohibited action for the implementing agent. This
prompt makes it *possible* — there is now a reachable deployment — and does not
claim to have done it. Note that the 404 finding above will make those sign-ins
behave oddly from anything but a real browser.

**4. A foreign Checkout Session retried for three days.** Now *observable* for
the first time, since retries only apply to a registered endpoint, but not yet
observed: the one delivery made here succeeded on the first attempt, so no retry
was exercised.

**5. The per-refund proportional floor and the dispute-won rule.** Decided by
the user on 2026-08-14 to stay as they are. Not bugs, and carried forward only
so a later session does not rediscover them as findings.
