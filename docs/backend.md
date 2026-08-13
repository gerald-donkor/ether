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
