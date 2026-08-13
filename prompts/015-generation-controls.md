# 015 - Generation controls: model, size, and count

## Scope, and why it is next

**Build step 5 — generation controls.** Phase one is complete and committed:
step 1 at `a367b09`, step 2 at `4c5b9f7`, step 3 at `2389ddf`, step 4 at
`2b612af`, with the provider swap at `4bed349` and its record at `82f22b8`.
Nothing on the landing page points at `#` any more, so the next unbuilt row of
AGENTS.md §5.2 is step 5, whose only dependency is step 1. Steps 6 and 7 both
read better once a generation has a chosen model and size stored on it, so
step 5 comes first exactly as the table orders it.

The step, as §5.2 states it: *aspect ratio, image count, and an explicit model
choice, all validated server-side against a closed list. The model id stops
being one constant and becomes a small typed registry in `lib/ai/`.*

## Reference material read while writing this prompt

Read by path, not recalled:

- `AGENTS.md` §5.2 (step 5), §5.3 (the AI rules), §6.2, §6.3, §7.3 (the
  Cloudflare traps), §8.2, §9, §10, §12.
- `design-system.md` §2.8 (application shell, lines 184-201) for the `/generate`
  layout contract, and §1.1, §1.5, §3 for tokens, radii and the motion table.
- `lib/ai/model.ts`, `lib/ai/generate.ts`, `lib/validation/generation.ts`,
  `app/(app)/generate/actions.ts`, `components/app/GeneratorWorkspace.tsx`,
  `components/ui/PromptField.tsx`, `lib/db/schema.ts`.
- `docs/backend.md` — the AI model section (lines 173-290) and the measured
  output record (lines 263-289).
- `docs/automation.md` — the route-table comparison, the environment-absent
  build, and the client-bundle secret scan.
- Cloudflare's live model pages, fetched 2026-08-13 (values quoted below).

## What was verified live, and what still must be

Fetched from `developers.cloudflare.com` on 2026-08-13:

| model id | sizing | response | published cost |
| --- | --- | --- | --- |
| `@cf/black-forest-labs/flux-1-schnell` | **no `width`/`height` input.** `prompt`, `seed`, `steps` (default 4, max 8) only | JSON, `result.image` base64 | 4.80 neurons per 512x512 tile + 9.60 per step |
| `@cf/bytedance/stable-diffusion-xl-lightning` | `width` and `height`, 256-2048 | **not stated on the page** | listed as `$0.00 per step`; **no neuron row in the pricing table** |
| `@cf/leonardo/lucid-origin` | `width`/`height` 0-2500, default 1120 | JSON base64 | 636.00 neurons per tile + 12.00 per step |
| `@cf/leonardo/phoenix-1.0` | `width`/`height` 0-2048, default 1024 | not stated | 530.00 neurons per tile + 10.00 per step |

Free allocation, from `workers-ai/platform/pricing/`: **10,000 neurons per day,
account-wide**, applying to all models including the partner ones.

**Why the registry is flux plus SDXL-Lightning and not the Leonardo models.**
`docs/backend.md` records the measured flux image at 1024 x 1024, which is four
tiles, and 57.60 neurons per image — 173 images a day inside the free
allocation. The same 1024 x 1024 on `lucid-origin` is 4 x 636 = 2,544 neurons
before steps, so the whole account's daily allocation buys **three images**.
Adding it to a user-facing select would let one person exhaust the product for
everybody in under a minute. It is excluded on that measurement, not on taste,
and the exclusion is recorded so a later session does not re-add it.

**Two things are unverified and must be verified before code depends on them:**

1. **SDXL-Lightning's REST response shape.** Its model page documents a
   `ReadableStream` for the Workers binding and says nothing about the REST
   envelope. The implementation must run one real call and record the HTTP
   status, the `content-type` header, and the first bytes:

   ```bash
   set -a; . ./.env.local; set +a
   curl -sS -D - -o /tmp/sdxl-probe.bin \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"prompt":"a grey studio sphere","width":1024,"height":576,"num_steps":4}' \
     "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/bytedance/stable-diffusion-xl-lightning" \
     | sed -n '1,20p'
   file /tmp/sdxl-probe.bin
   ```

   The registry entry's `responseStyle` is set from what that prints, never from
   this table.
2. **Its cost.** If the probe succeeds, compute the neuron figure from whatever
   the pricing page shows for it at that moment and record it. If it has no
   neuron row, record that it has none rather than inventing one.

**If the probe fails** — the model is unavailable, returns an envelope the
decoder cannot read, or is refused on this account — **stop and report it**
(§12 rule 9). Do not quietly ship a one-model registry and call step 5 done, and
do not substitute a Leonardo model past the cost argument above. Bring it back
as a question.

## A deviation this prompt asks for, explicitly

AGENTS.md §6.3's tree says `lib/ai/` is server-only. The closed list of models
and sizes has to be readable by three places: the shared schema in
`lib/validation/`, the client leaf that renders the selects, and the server
action. Duplicating it would give the "closed list" two definitions and one
drift.

**The ask:** `lib/ai/catalog.ts` is pure data — ids, labels, size options, step
counts, request and response shapes, cost notes — and carries **no**
`import "server-only"`. It reads no environment variable and imports nothing.
`lib/ai/generate.ts` keeps `server-only` and remains the only module that reads
`CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN`.

If approved, the `lib/ai/` row of AGENTS.md §6.3 is corrected in the same change
to say the gateway call is server-only and the public catalog deliberately is
not (§12 rule 8). That is a boundary correction, not a build record, so it
belongs there rather than in `docs/backend.md`.

## The controls, and what each is allowed to be

Three controls, all closed lists, all validated server-side.

**Model.** A `<select>` over the registry ids. Default
`@cf/black-forest-labs/flux-1-schnell`. Its label carries a one-line honest
description; a beta model says it is beta.

**Size, not free aspect ratio.** flux-1-schnell takes no dimensions, so a
site-wide ratio control would be a lie on the default model. Each registry entry
declares its own closed size list:

- flux-1-schnell: exactly one option, `Square - 1024 x 1024`, which is the
  **measured** output recorded in `docs/backend.md`, sent with no `width` or
  `height` in the body.
- SDXL-Lightning: `Square 1024 x 1024`, `Landscape 1280 x 768`, `Portrait
  768 x 1280` — all inside the documented 256-2048 range, all multiples of 64.

Changing the model changes the available sizes; an invalid pair is rejected by
the schema before any model call.

**Count.** `1`, `2`, or `4`. Nothing larger: four images on the default model is
230 neurons, and the account-wide ceiling is 10,000 a day.

## Measurements the implementation must hit

Nothing here is eyeballed:

- Sizes come from the model pages' documented ranges and, for flux, from the
  measured row in `docs/backend.md` (1024 x 1024).
- The control row uses the existing tokens only: `--surface-2` ground,
  `--r-pill`, 13px label text at the `text-text-3` role, the 4px spacing scale,
  and the global `:focus-visible` lime ring on native controls. **No new token,
  no new radius, no new colour, no motion row.**
- The result slot's reserved aspect ratio is computed from the chosen size's
  width and height, so the box is the right shape before the response arrives
  (§8.2 rule 6).

## Implementation

### 1. `lib/ai/catalog.ts` (new, not server-only)

Exports a typed registry:

- `IMAGE_MODELS` — a readonly record keyed by model id. Each entry: `id`,
  `label`, `note` (one plain line, no hype, no em-dash), `beta`, `steps`,
  `sizes` (a readonly array of `{ key, label, width, height }`),
  `sizing: "native" | "explicit"`, `bodyStyle`, `responseStyle` (set from the
  probe), and a comment giving the neuron cost and the date it was read.
- `DEFAULT_MODEL_ID`, `IMAGE_MODEL_IDS`, and a `getModel(id)` that returns
  `undefined` for anything not in the record.
- The verification comment currently in `lib/ai/model.ts` moves here, per model,
  with each model page URL and the date it was checked (§5.3 rule 2).

`lib/ai/model.ts` is **deleted**; its two importers are updated.

### 2. `lib/ai/generate.ts`

- Signature becomes `generateImageForPrompt({ prompt, modelId, sizeKey })`,
  resolving the entry through `getModel` and throwing
  `provider_unavailable` on an unknown id, which is an internal bug rather than
  a user-facing state.
- Body is built from `bodyStyle`: flux sends `{ prompt, steps }` with no
  dimensions; the SDXL style sends `{ prompt, width, height, num_steps }`.
- Decoding is driven by `responseStyle`: the existing JSON-base64 path stays as
  it is, and a binary path reads `arrayBuffer()` when the probe says the REST
  response is raw bytes. **Both paths still run `readImage` on the bytes** — the
  stored dimensions and media type stay measured, never assumed, even when the
  request asked for a size (§7.3).
- The 200-with-`success:false` check, the 400-versus-everything-else split, and
  the `ImageGenerationError` kinds are unchanged.

### 3. `lib/validation/generation.ts`

- Adds `model`, `size`, and `count`, built **from the catalog** so the closed
  list has one definition. `count` is a literal union of `"1" | "2" | "4"`
  transformed to a number; `model` is an enum of `IMAGE_MODEL_IDS`.
- A `superRefine` rejects a `size` the chosen model does not declare, with a
  message naming the control rather than the internals.
- `prompt` and `publish` are untouched, including the literal-`"public"` rule.
- Exports the field names as constants, as `PUBLISH_FIELD` already is, so the
  form and the schema cannot drift.

### 4. `app/(app)/generate/actions.ts`

Order stays exactly as AGENTS.md §10 lays it out — session, parse, quota, then
the expensive call:

- Parse now includes the three new fields. A bad pair returns a typed error and
  **never reaches the provider**.
- The hourly floor becomes count-aware: reject when
  `recentCount + requestedCount > 20`, before the first call, with a message
  saying how many are left. The comment naming Upstash as step 9's replacement
  stays, and gains a line that the account-wide neuron allocation is still
  unmodelled.
- The action generates **sequentially**, not in parallel: per-account
  concurrency on Workers AI is unverified, and a serial loop keeps a partial
  failure legible.
- **Partial success is a real outcome.** Rows and blobs are written per image as
  they succeed. The state becomes `{ ok, error, generations: GenerationResult[],
  failed: number }`; if some succeeded the result is `ok: true` with a truthful
  count, and only a total failure is `ok: false`. The existing blob-cleanup path
  on a failed row insert is kept per image.
- `model` is written per row from the chosen id, which the `model` column
  already holds. `revalidatePath("/generate")` runs once; `updateTag` and
  `revalidatePath("/")` run once, only if at least one row was published.
- Raw provider errors keep going to `console.error` through `safeErrorMessage`,
  which strips the prompt. The prompt is never logged (§8.3 rule 2).

### 5. `components/ui/PromptField.tsx` (additive only)

One new optional prop, `controls?: ReactNode`, rendered between the input pill
and the publish checkbox. **The landing page passes nothing and its DOM must
come out byte-identical** — no wrapper element is added when the prop is absent.
This mirrors the existing `showPublishOption` opt-in exactly.

### 6. `components/app/GenerationControls.tsx` (new client leaf)

Three native `<select>` elements with real `<label>`s, in one wrapping row.
`useState` holds only the selected model id, so the size select can offer that
model's sizes — a discrete UI value, which is not what the continuous-value ban
in AGENTS.md covers. It lifts the chosen size and count to the workspace so the
result slot can reserve the right shape. No GSAP, no `motion/react`, no new
motion row.

### 7. `components/app/GeneratorWorkspace.tsx`

- Passes `<GenerationControls />` into `PromptField`'s new slot.
- The result region reserves `count` slots at the chosen size's ratio from first
  paint: 1 fills the column, 2 is two columns, 4 is a 2 x 2 grid collapsing to
  one column below `sm`. The pending overlay covers the whole region, as it does
  today.
- The status line still announces through the existing `role="status"` node and
  keeps focus management. It reports partial results honestly, e.g. three
  generated and one failed, and says whether they were published.
- The history grid below is unchanged.

## Render impact

- `/` — **no change.** `PromptField` renders identically when `controls` is
  absent. Verified by the route table and a screenshot comparison at `sm`, `md`
  and `lg` with the hero drift, beads, drips, marquees, spiral and count-up all
  confirmed running (`AGENTS.md` §8.1).
- `/generator`, `/community`, the other marketing routes — no change; none of
  them import `PromptField` or the catalog.
- `/generate` — **changes, and is the route this step exists to change.** Still
  dynamic, still per-user. No render-mode change anywhere on the site.
- No new route. No route handler.

## Trust boundary

`prompt`, `publish`, `model`, `size` and `count` cross from the browser as form
fields. All five are parsed in the action with the shared schema before anything
is spent; `model` and `size` are checked against the catalog as a pair, and
`count` against a literal union. A rejected request returns
`{ ok: false, error }` with a message the user can act on, having made **no**
provider call, **no** blob write and **no** row insert. The user id is read from
`await auth()` on every call and never from the form. A signed-out caller gets
the typed sign-in error.

## Secrets and data

- Reads `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, inside
  `lib/ai/generate.ts` only, at call time, never at module scope.
- `lib/ai/catalog.ts` reads no environment variable and holds no secret. Nothing
  new is `NEXT_PUBLIC_*`; no new variable is introduced.
- Stores what the schema already holds: owner id, prompt, blob url, model id,
  measured dimensions, publication flag. **No new column and no migration** —
  `model`, `width` and `height` already exist in `lib/db/schema.ts`.
- Prompts are still never logged. Provider errors are logged with the prompt
  stripped.

## Non-goals

- **No new database column, no migration, no `batch_id`** grouping the images of
  one request. Step 7 owns the library and can add it if it needs it; a
  speculative column is what AGENTS.md §9 rule 7 forbids.
- **No seed, guidance, negative-prompt or step control.** Step 5 names three
  controls; more surface is more validation and more support.
- **No img2img, inpainting or variations** — that is step 13, and it is gated.
- **No Leonardo model in the registry**, for the neuron reason argued above.
- **No quota rework beyond making the existing floor count-aware.** Upstash is
  step 9.
- **No change to the landing page, its sections, `app/globals.css`, `lib/z.ts`,
  the motion table, or any marketing route.**
- No new component library, no new token, no new radius.

## Files

**Create:** `lib/ai/catalog.ts`, `components/app/GenerationControls.tsx`.

**Modify:** `lib/ai/generate.ts`, `lib/validation/generation.ts`,
`app/(app)/generate/actions.ts`, `components/app/GeneratorWorkspace.tsx`,
`components/ui/PromptField.tsx` (additive prop only), `docs/backend.md`,
`design-system.md` §2.8, and the `lib/ai/` row of `AGENTS.md` §6.3 **only if the
deviation above is approved**.

**Delete:** `lib/ai/model.ts`.

**Must not touch:** `app/(marketing)/**`, `components/sections/**`,
`components/brand/**`, `components/motion/**`, `app/globals.css`, `lib/z.ts`,
`lib/db/schema.ts`, `drizzle/**`, `proxy.ts`, `next.config.ts`.

## Checks

Run and quote the real output (§2, §12 rule 3):

1. `npm run lint`
2. `npm run build`, and compare the route table against `main` using the
   procedure in `docs/automation.md` ("Compare a build's route table across a
   change").
3. The environment-absent build: `docs/automation.md` "Prove an environment read
   is lazy".
4. The client-bundle secret scan: `docs/automation.md` "Check a secret never
   reached the browser".
5. A real end-to-end run on `npm run dev`: one flux image, one SDXL image at a
   non-square size, and one count-of-2 request. Then the read-only query from
   `docs/automation.md` to confirm the stored `model`, `width` and `height` are
   the measured values for each row.
6. A screenshot comparison of `/` at `sm`, `md` and `lg` against `main`. This
   step has now been worked out twice, so §3's standing instruction applies:
   **add it to `docs/automation.md` in this change.**

## Recording the result

- `docs/backend.md` — the registry and every entry, the probe's measured
  response shape and status, each model's cost and the date it was read, the
  excluded models and the neuron arithmetic behind the exclusion, the new action
  fields, the partial-success result shape, and the count-aware cap.
- `design-system.md` §2.8 — the control row on `/generate`, the reserved
  multi-slot result region, and a note that no token, radius or motion row was
  added.
- `AGENTS.md` — at most the one-line §6.3 correction, if approved. Nothing else.

## SKILLS USED

- `vercel:nextjs` — Server Actions in Next 16, `useActionState`, and the
  revalidation APIs used by the action.
- `zod-docs` — the schema changes: enums built from a const array,
  `superRefine` for the model-and-size pair, and literal unions. *(If no skill by
  this name is in the listing at execution time, say so and verify against
  `node_modules/zod` instead, per §12 rule 2.)*
- `tailwind-4-docs` — the config-less token usage for the control row; every
  value resolves from `@theme` in `app/globals.css`.
- `vercel-react-best-practices` — keeping the new control state a discrete client
  leaf and off the render path of everything else.
- `web-design-guidelines` — native select labelling, focus visibility, and the
  status announcement for a partial result.
- `neon-postgres` — only for the read-only verification query in check 5. No
  schema change.
- `vercel:env-vars` — confirming no new variable is needed and that nothing new
  is `NEXT_PUBLIC_*`.

Not loaded, and why: no GSAP skill, because this change adds no motion; no
`figma:*`, because there is no artboard surface for controls; no
`vercel:ai-sdk`, because the provider is called with a plain `fetch` per §5.3
rule 1.
