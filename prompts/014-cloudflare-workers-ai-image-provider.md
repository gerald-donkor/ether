# 014 — Replace the AI Gateway with Cloudflare Workers AI

## Scope, and why it is next

Move the image generation call off the Vercel AI Gateway and onto **Cloudflare
Workers AI**, called over its REST API with a plain `fetch`.

This is not a step in the §5.2 build sequence. It is a **corrective prompt**:
build step 1 shipped and `/generate` is unusable, because the AI Gateway refuses
every request from a team with no payment method on file. Observed in the dev
server on 2026-08-13:

```
Image generation failed. GatewayInternalServerError: AI Gateway requires a valid
credit card on file to service requests.
```

The linked project `ether` sits on team `dgsloxx417s-projects`
(`team_zE3mp7nrEZ6a7cxRavwUMYC4`), verified with `vercel teams ls`. The user has
stated they want a provider that never requires a card. Until this is fixed the
product's single promise — type a prompt, get an image — does not work at all,
which outranks every remaining step in phase one.

## This prompt intentionally overrides a hard rule

**`AGENTS.md` §5.3 rule 1 currently reads:** *"Every model call runs through the
Vercel AI Gateway with a plain `"provider/model"` string and the `ai` package …
A direct provider SDK (`@ai-sdk/openai`, `openai`, `replicate`, …) is out of
bounds."*

The user has explicitly requested this deviation, and the reason is a hard
external constraint: the gateway cannot serve any request without a card, so the
rule as written makes the product unbuildable for them. Per `AGENTS.md` §1 rule 1
this is a permitted override, and per §12 rule 8 it must not happen silently —
**§5.3 rule 1 and the §7.2 provider table are rewritten in this same change**, not
left stale.

The spirit of the rule survives the rewrite and is preserved verbatim in the new
wording: exactly one model provider, reached through exactly one module in
`lib/ai/`, with the model id as a single exported constant. What changes is which
provider that is, and that the call is a `fetch` rather than the `ai` package.

## Reference material read for this prompt

Live documentation, fetched 2026-08-13 (§12 rule 2 — none of this is from
memory):

- `https://developers.cloudflare.com/workers-ai/platform/pricing/` — the free
  allocation, and FLUX-1 schnell's neuron cost
- `https://developers.cloudflare.com/workers-ai/get-started/rest-api/` — the
  endpoint shape, and the API token permissions
- `https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/` — the
  model id, its inputs, and its response schema
- `https://huggingface.co/docs/inference-providers/pricing` — read and
  **rejected**: free accounts receive $0.10/month, which is a handful of images

Repository files read: `lib/ai/generate.ts`, `lib/ai/model.ts`,
`lib/validation/generation.ts`, `lib/db/schema.ts`,
`app/(app)/generate/actions.ts`, `.vercel/project.json`.

## The verified provider facts the implementation must hold to

**Endpoint.**

```
POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}
Authorization: Bearer {API_TOKEN}
```

**Token permissions.** The docs state tokens need "permissions for both
`Workers AI - Read` and `Workers AI - Edit`."

**Model id.** `@cf/black-forest-labs/flux-1-schnell` — quoted exactly from the
model page, not reconstructed.

**Inputs.** `prompt` (string, required, max 2048 characters) and `steps`
(integer, optional, default 4, maximum 8). **There is no documented `width` or
`height` parameter.**

**Response.** JSON, not raw bytes. The envelope carries `success`, `errors`,
`messages` and `result`; the image is `result.image`, a **base64-encoded JPEG**.
This differs from the gateway path, which returned bytes directly, and it is the
single most likely thing to get wrong.

**Free allocation.** 10,000 neurons per day, on both Workers Free and Workers
Paid. On the Free plan, exceeding it fails with an error rather than billing —
quoted: *"If you exceed any one of the above limits, further operations will
fail with an error."* This refusal-not-billing behaviour is the entire reason
this provider was chosen and it must be stated in `docs/backend.md`.

**Neuron cost.** FLUX-1 schnell is 4.80 neurons per 512×512 tile plus 9.60
neurons per step.

## Measurements, not guesses

**The output resolution is unknown and must be measured, never assumed.** Width
and height are not request parameters and the model page does not state the
output size, so the implementation must not hardcode a dimension anywhere.

- `readJpegDimensions` in `lib/ai/generate.ts:15` already parses the SOF marker.
  It is the measuring instrument, and Cloudflare returning JPEG is what makes it
  the right one. Keep it and keep feeding `readDimensions` the decoded bytes, so
  the `width` and `height` columns record what actually arrived.
- After the first successful live generation, **read the real dimensions out of
  the `generations` row** and record them in `docs/backend.md`, along with the
  per-image neuron cost computed from them using the published formula above and
  the resulting images-per-day ceiling. Label it as measured, with the date.
- Do **not** write an images-per-day figure into any user-visible string. It is
  a real measurement for the docs, and §5.2's invented-numbers invariant governs
  everything the site renders.

## The change

**`lib/ai/model.ts`** — `IMAGE_MODEL` becomes
`"@cf/black-forest-labs/flux-1-schnell"`. Replace the comment with one naming
Cloudflare Workers AI, the verification date, and why this model: it is the
image model covered by the free neuron allocation. Keep it a single exported
constant so a later change is one edit, exactly as the rule it replaces
required. It continues to be the value written to `generations.model`.

**`lib/ai/generate.ts`** — replace the `generateImage` call from `ai` with a
`fetch` to the endpoint above. Keep `import "server-only"` and keep the
`{ bytes, mediaType, width, height }` return shape, because
`app/(app)/generate/actions.ts` destructures it and must not change. The new
work inside the module:

- read `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` **inside the function,
  not at module scope** — the same lazy-read discipline §7.3 imposes on the
  database client, and for the same reason: `npm run build` must pass with the
  environment absent. Throw a named error if either is missing.
- send `{ prompt, steps: 4 }`. Do not send width or height; they are not inputs.
- treat a non-2xx response **and** a 200 carrying `success: false` as failures.
  The Cloudflare envelope reports model errors inside a 200, so checking
  `response.ok` alone silently produces an undefined image.
- decode `result.image` from base64 into a `Uint8Array`, set `mediaType` to
  `image/jpeg`, and pass the bytes through the existing `readDimensions`.
- never include the prompt in a thrown or logged error (§8.3 rule 2).

**`app/(app)/generate/actions.ts`** — the catch at line 93 currently returns
*"The image could not be generated. Revise the prompt or try again."* for every
model failure. That sentence sent the user to revise a prompt that was never the
problem, which is the failure this whole prompt exists to fix, and it violates
§8.2 rule 4's requirement that a failure be an honest visible state.

Distinguish two outcomes at that catch, without leaking provider detail to the
client (§8.3 rule 6):

- the provider was unreachable, unauthorised, or out of allocation — the user is
  told the generator is unavailable and to try later, because nothing they type
  will help;
- the model ran and refused or failed on this input — the existing "revise the
  prompt" wording is correct and stays.

Carry the distinction on a typed error from `lib/ai/generate.ts`, not by string
matching a provider message in the action. Both strings follow the register in
§5: plain, technical, no exclamation marks, and **no em-dashes**.

**`.env.local`** — add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
**These two names are ours**, chosen by this prompt: the REST API takes the
account id in the path and the token in a header, and dictates no environment
variable names (§12 rule 6 — do not claim Cloudflare owns these). Both are
server-only; neither is `NEXT_PUBLIC_*`. The user supplies the values; they are
never committed and never echoed.

**`AGENTS.md`** — rewrite §5.3 rule 1 and the §7.2 provider table row for the
model, per the override section above. Add the two new variables to §8.4's
table, marked as set by hand. This is a correction of a now-false statement, and
it is the one edit this file is owed by this change.

**`docs/backend.md`** — record the decision, its reason, the verified provider
facts, the measured output dimensions and neuron cost, and the two new variables.

## Non-goals

- **No fallback chain.** The gateway is not kept as a backup path. Two providers
  behind one call is two failure modes and twice the surface, for a project with
  one working provider.
- **Removing the `ai` package.** It stays in `package.json`. Deleting it is a
  separate decision, and the gateway becomes viable again the moment a card is
  added.
- **No change to the metering.** The 20-per-hour `count(*)` floor in
  `actions.ts:74` stays exactly as it is; step 9 still owns quotas. Note in
  `docs/backend.md` only that the neuron allocation is a second, account-wide
  ceiling the per-user cap does not model.
- **No new generation controls.** Steps stays at the default 4 and is not
  exposed. Aspect ratio, count and model choice are build step 5.
- **No schema migration.** `generations.model` is `text` and holds the new id
  unchanged. Verified in `lib/db/schema.ts`.
- **No prompt-length change.** The schema caps prompts at 500 characters
  (`lib/validation/generation.ts:18`), comfortably inside Cloudflare's 2048.
- **The Clerk `createRouteMatcher` deprecation is not addressed here.**

## Files

**Modified:** `lib/ai/model.ts`, `lib/ai/generate.ts`,
`app/(app)/generate/actions.ts`, `AGENTS.md`, `docs/backend.md`, `.env.local`
(uncommitted).

**Created:** none. **Deleted:** none.

**Must not touch:** `app/(marketing)/**`, `components/sections/**`,
`components/brand/**`, `components/motion/**`, `app/globals.css`,
`lib/db/schema.ts`, `lib/db/queries.ts`, `lib/storage/**`,
`lib/validation/generation.ts`, `proxy.ts`, `next.config.ts`, `package.json`.

## Render impact

**None.** No route's output or render mode changes. The change is confined to
the module the generate action calls and to that action's error strings, and
`/generate` was already dynamic and per-user. The landing page's gallery keeps
reading the same table through the same cached query — prompt 013's `updateTag`
and `revalidatePath` calls at `actions.ts:129-137` are untouched.

**To be verified, not assumed** (§4): confirm the route table from
`npm run build` is identical to the pre-change build.

## Trust boundary

Unchanged in shape, and the §10 ordering must survive the edit. The browser
still sends only `prompt` and `publish` through the Server Action. Session is
read server-side with `await auth()` at `actions.ts:45`; the shared Zod schema
parses at line 54; the quota floor runs at line 73 — **all three still before
the provider call**, so a rejected request never spends allocation (§10 rule 3).

New outbound trust: the server now sends the user's prompt to Cloudflare over
HTTPS. That is the generation itself and is what §5.3 rule 4 permits; it goes
nowhere else. A rejected or failed request still returns the discriminated
union, never a throw and never a raw provider string.

## Secrets and data

**Reads:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`. Both server-only,
both read inside the function, neither `NEXT_PUBLIC_*`.

**Stops reading:** `VERCEL_OIDC_TOKEN`, for generation.

**Stores:** unchanged — the prompt, the Blob url, the model id, the measured
dimensions, the `is_public` flag.

**Logs:** the existing `safeErrorMessage` at `actions.ts:36` strips the prompt
from provider errors. The new code must not reintroduce it, and must never log
the API token or the base64 payload.

## Checks

1. `npm run lint`
2. `npm run build` — and again with the environment absent
   (`mv .env.local .env.local.bak`, build, restore), which is what proves the
   lazy env read (§2).
3. Route table from the build compared against the pre-change build.
4. `grep` the built output for the Cloudflare token value to confirm it never
   reaches a client bundle (§8.4).
5. Live: sign in, generate, and confirm the image renders, the row is written,
   and the dimensions are real. Then generate with a deliberately invalid token
   to confirm the unavailable-service path returns the new wording rather than
   "revise the prompt".

Quote the exact output of each (§12 rule 3). Record the result in
**`docs/backend.md`**; the only `AGENTS.md` edits are the corrections named
above.

## SKILLS USED

- **`vercel:ai-sdk`** — to confirm what is being moved away from, and to check
  whether anything else in the repo imports the `ai` package before leaving it
  installed.
- **`vercel:env-vars`** — the two new server-only variables, the
  `NEXT_PUBLIC_*` boundary, and why `.env.local` is not auto-loaded by anything
  but Next.js.
- **`vercel:nextjs`** — Server Action semantics in Next 16, and confirming the
  build-time module evaluation behaviour that forces the lazy env read.
- **`vercel-react-best-practices`** — the action's returned state shape and the
  client leaf's pending and error rendering stay correct after the error-path
  split.
- **`neon-postgres`** — only to confirm no migration is implied; the `model`
  column is `text` and unchanged.

Cloudflare Workers AI has no skill in the listing. **Its API is therefore taken
only from the three live documentation pages fetched above and named with their
URLs, never from memory** (§12 rule 2), and any detail not on those pages is
reported as unverified rather than filled in.
