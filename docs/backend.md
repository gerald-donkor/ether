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

Drizzle owns the schema in `lib/db/schema.ts`. The committed migration is
`drizzle/0000_mean_random.sql`.

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
| `is_public` | `boolean` | Not null, defaults to `false`. The owner's publication choice |
| `created_at` | `timestamp with time zone` | Not null, defaults to `now()` |

Indexes:

- `generations_pkey` on `id`.
- `generations_user_id_idx` on `user_id`.
- `generations_user_created_at_idx` on `user_id, created_at desc`.
- `generations_public_created_at_idx` on `is_public, created_at desc`.

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

**`is_public` is a boolean, and step 8 will have to migrate it.** `AGENTS.md`
§9 rule 3 foresees `private | unlisted | public` arriving with sharing and
prefers an enum for exactly this reason. Prompt 013 specified a boolean and was
approved as written, so the cost is deliberate and recorded here rather than
discovered later.

## Database boundary

`lib/db/index.ts` constructs the Drizzle client lazily through `getDb()`. The
runtime uses pooled `DATABASE_URL`; Drizzle Kit uses direct
`DATABASE_URL_UNPOOLED`. Only modules in `lib/db/` query Postgres. Every user
content read includes the Clerk owner id in the query.

Available queries:

- list the newest 24 generations for one owner;
- count all generations for one owner;
- count one owner's generations since a supplied timestamp;
- insert one generation and return the stored row;
- list the newest public generations for the landing gallery.

### The public gallery read

`listPublicGenerations(limit)` is the only query in the codebase that does not
filter on an owner, because it filters on `is_public = true` instead. Its
projection is the privacy boundary: it selects `id`, `image_url`, `width`, and
`height`, and never `user_id`, `prompt`, or `model`. It orders by `created_at
desc` and takes the `limit` the caller passes, which is the gallery's
photographic slot count counted off the component's own column data.

Cache Components is not enabled, so the documented primitive for a non-`fetch`
read applies: `unstable_cache` with the tag `public-gallery` and no
`revalidate`. There is no polling interval because the strip only changes when
someone publishes, and the generation action expires the tag when they do.

`getPublicGalleryImages(limit)` wraps that cached read in the failure path. The
`try` is deliberately outside the cached function, so a database outage is
never what gets cached. A missing `DATABASE_URL` during `next build`, or a
failed read at render time, resolves to an empty array, and the gallery falls
back to its artboard images rather than throwing or rendering an empty strip.
The log line is the fixed string `The public gallery read failed.` and carries
no row, prompt, or owner.

**Known gap, and it is real.** Blob pathnames are
`generations/<clerk-user-id>/<uuid>.<ext>`, so a published image's URL contains
its owner's Clerk id, and anonymous visitors to `/` receive it. The query does
not select `user_id`, but the URL carries it anyway, which means public images
are correlatable by owner. Nothing else about the owner is exposed, and the
existing private URLs are unchanged. Fixing it means a second storage pathname
scheme, which prompt 013 placed out of scope. Resolve it in step 8, where
sharing makes the URL a first-class product surface.

## Generation action

`app/(app)/generate/actions.ts` exports `generateGeneration`. Its browser input
is five `FormData` fields: `prompt`, `model`, `size`, `count` and `publish`.
The action:

1. reads the Clerk session and rejects an anonymous request;
2. validates all five fields together through the shared Zod schema, including
   the model-and-size pair;
3. checks the owner's indexed one-hour generation count **against the number of
   images requested**;
4. calls Cloudflare Workers AI, once per requested image, sequentially;
5. writes each returned image's bytes to public Blob storage;
6. writes each generation row, including the validated publication boolean;
7. revalidates `/generate` once, when at least one row was written;
8. expires the `public-gallery` tag and revalidates `/` once, but only when at
   least one row that was written is public;
9. returns a discriminated result carrying every generation that succeeded and
   a count of the ones that did not.

The prompt must contain content after trimming and may contain at most 500
characters.

### The three controls, and partial success (prompt 015)

`model`, `size` and `count` are closed lists validated against
`lib/ai/catalog.ts`. `count` is one of `1`, `2` or `4`. The model and size are
only valid as a pair: each model declares its own sizes, and a `superRefine`
rejects a size the chosen model does not declare, before any provider call.

The hourly floor is now count-aware. It rejects when
`requested > 20 - recentCount`, so a batch cannot walk past the cap one image
at a time, and the message says how many remain. It still does not model the
account-wide neuron allocation, which stays step 9's problem.

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
client-supplied generation id is accepted anywhere in this step. The temporary spending floor allows fewer than 20 generations in
the preceding hour. It is not a distributed rate limiter. Step 9 replaces it
with Upstash and product-level quotas.

Provider, Blob, and database failures become actionable client messages. Server
logs remove the user's prompt before recording error details. If the Blob write
succeeds but the database insert fails, the action attempts to delete the Blob.

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

Neuron cost, computed from the published formula and the measured size:

- 1024 x 1024 is **4** 512x512 tiles, at 4.80 neurons each: **19.20**
- 4 steps at 9.60 neurons each: **38.40**
- **57.60 neurons per image**

Against the 10,000 neuron daily allocation that is **173 images per day**
account-wide (57.60 x 173 = 9,964.8; a 174th would exceed it). This figure is
for this document only and appears in no user-visible string.

**The per-user cap does not protect this ceiling.** The 20-per-hour count in
`actions.ts` permits 480 generations per day from a single account, which is
2.8x the account-wide allocation, so one user can exhaust the free tier in
about nine hours and every other user then receives the
`provider_unavailable` message. Step 9 owns quotas and must model the
account-wide allocation, not just per-user rate.

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
| `@cf/black-forest-labs/flux-1-schnell` (default) | Square 1024 x 1024 only | `{ prompt, steps: 4 }`, no dimensions | JSON, `result.image` base64 | 57.60 per image at the measured size |
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
`generations/<clerk-user-id>/<random-uuid>.<extension>` with public access and
without an added random suffix. The UUID makes each pathname unique. Generated
images remain user data in Blob and never enter `public/` or Git.

## Auth and routes

`proxy.ts` optimistically protects `/generate` and `/account`. The app layout,
each protected page, and the generation action independently read the server
session. Proxy is not the authorization boundary.

| Route | Render and data behavior |
| --- | --- |
| `/` | Public marketing route, still prerendered as static. Its gallery reads the cached public-generation query and is expired on demand by a public write |
| `/sign-in` | Public Clerk sign-in screen |
| `/sign-up` | Public Clerk sign-up screen |
| `/generate` | Dynamic, owner-scoped history read and Server Action mutation |
| `/account` | Dynamic Clerk identity read and owner-scoped generation count |

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
dimensions, the publication choice, and creation time. It reads the user's
email and join date from Clerk for `/account` but does not store them locally.
Prompts, emails, request bodies, publication payloads, provider credentials,
and Blob tokens are not logged.

A generation is private unless its owner opted in when creating it. Publishing
transmits the image URL and its stored dimensions to anonymous visitors, and
nothing else the query selects. See the known gap under the public gallery read
for what the URL itself still carries.

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
- **One signed-in end-to-end run through the real form**, at the default model
  and size with count 1. The stored row, read back with the read-only query:

  | Column | Value |
  | --- | --- |
  | `model` | `@cf/black-forest-labs/flux-1-schnell` |
  | `width`, `height` | 1024, 1024 |
  | `right(image_url, 4)` | `.jpg` |
  | `is_public` | `false`, the checkbox being unchecked |

  The new `model`, `size` and `count` fields therefore reach the action, parse,
  and write a correct row through the real form.
- **Still unverified:** an SDXL run at a non-square size and a count-of-2 run,
  both through the UI. The browser tooling could not drive the selects on this
  page: `read_page` returned an empty tree and `javascript_tool` was blocked by
  the extension, and this was stopped rather than retried further. The provider
  side of both is verified above by direct calls, including 1280x768 and
  768x1280 coming back at exactly those dimensions; what remains unconfirmed is
  only the select-to-row path for a non-default model and a count above one.

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
