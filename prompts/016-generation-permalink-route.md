# 016 — The generation permalink, `/g/[id]`

## Scope, and why it is next

Build step 6 in `AGENTS.md` §5.2: **the image route.** `/g/[id]`, a permalink
for one generation — full-size view, prompt, model, download, delete. Owner-only
until step 8 makes sharing real.

It is next because every phase-one step is committed (`a367b09`, `4c5b9f7`,
`2389ddf`, `2b612af`) and step 5 is committed (`8ed5482`, `754ddbf`), and step 6
depends only on step 1. Step 7, the library, depends on step 6: the library's
cards need somewhere to go, and step 7's own row says the `/generate` history
grid shrinks to a strip that links onward. Building step 6 first means step 7
moves a link rather than inventing one.

This is also the first **delete** path in the codebase, so it sets the pattern
every later destructive action copies, the same way step 1 set the write path.

## Reference material to read before writing code

By path and section, all of it:

- `AGENTS.md` §6.1–§6.3 (layers and boundaries), §8.2 (hostile input), §8.3
  (user data), §9 (data model rules), §10 (the write-path flow, stages a–h),
  §11 (roles), §12 (do not fabricate).
- `docs/backend.md` — `## Data model`, `## Database boundary`, `## Storage`,
  `## Auth and routes`, `## User data`, and the known gap recorded under
  `### The public gallery read`.
- `design-system.md` §1.5 (the radius scale), §2.8 (application shell), §3 (the
  motion table), §6 (non-negotiables).
- `docs/automation.md` — all five recorded procedures; four of them are checks
  this prompt requires.
- Source, read before changing: `lib/db/queries.ts`, `lib/db/schema.ts`,
  `lib/storage/generations.ts`, `lib/ai/catalog.ts`,
  `lib/validation/generation.ts`, `lib/auth/index.ts`,
  `app/(app)/generate/actions.ts`, `app/(app)/generate/page.tsx`,
  `app/(app)/layout.tsx`, `components/app/GeneratorWorkspace.tsx`,
  `components/ui/Button.tsx`, `components/ui/PromptField.tsx`, `proxy.ts`.
- `node_modules/@vercel/blob/dist/index.d.ts` — `getDownloadUrl` is exported
  from the package root with the signature `(blobUrl: string) => string`,
  verified on 2026-08-13 at
  `node_modules/@vercel/blob/dist/create-folder-BM6BTlko.d.ts:134`. Re-confirm
  it at execution time rather than trusting this line (§12 rule 1).

## The decisions this prompt makes, so the implementation does not re-open them

**1. Delete is permanent: the Blob object and the row, both gone.** Confirmed
with the user on 2026-08-13. `AGENTS.md` §9 rule 5 prefers a soft delete and
§9.1 schedules a soft-delete state at step 7; the user chose permanence here
because the alternative leaves a "deleted" image still fetchable at its public
Blob URL, which is a broken promise rather than an audit trail. Step 7's
soft-delete state therefore becomes an **undo layer over the library**, not the
delete mechanism, and step 7's prompt must say so. Record this in
`docs/backend.md` as a deliberate divergence from §9.1, not as an oversight.

**2. The Blob is deleted before the row, and the ordering is the privacy
argument.** If the Blob delete fails, nothing is removed and the user gets a
typed failure with the row still intact and still rendering. If the Blob delete
succeeds and the row delete then fails, the residual state is a row pointing at
a dead URL — a rendering defect. Row-first inverts that into a live public URL
behind a success message, which is a privacy breach. Take the rendering defect.
Ownership is confirmed **before** either, and is filtered again inside the row
delete.

**3. Delete redirects to `/generate` on success, and that is a stated deviation
from §10 rule 5.** Rule 5 forbids a redirect because a navigation would discard
the generate form's scroll and motion state. Here the page's entire subject
ceases to exist, so staying is not an option and there is no reserved slot for a
result. Write the deviation into `docs/backend.md`.

**4. Not found and not yours are the same response: `notFound()`.** A distinct
"forbidden" would confirm that a given id exists, which lets anyone enumerate
other people's generations. One 404 for both.

**5. No new motion.** Nothing on this route animates beyond the existing link
hover and the button's `active:scale` already in `components/ui/Button.tsx`. **No
row is added to `design-system.md` §3**, and adding one would mean the scope
grew.

## Measurements and values

Every value on this route is an existing token or an existing measured value.
Nothing here is eyeballed and nothing new is sampled.

- Radius: the full-size image panel uses `--r-panel`, matching `/generate`'s
  result region in `design-system.md` §2.8. No surface on this route claims
  `--r-none`.
- Type roles, spacing and container: `Container`, the 4px spacing scale, and the
  `--text` / `--text-2` / `--text-3` roles exactly as `/account` and `/generate`
  already use them. Read the sizes off those two files rather than choosing new
  ones.
- The image's aspect ratio is **the stored `width` and `height` of that row**,
  applied as `aspectRatio` so the box is the right shape before the image loads,
  exactly as `GeneratorWorkspace` already does for its result slots.
- Dimensions shown to the user are the stored `width` and `height`. They are a
  real query result, not an invented number (§12 rule 7).
- The model line is `getModel(row.model)?.label ?? row.model`. The fallback
  matters: a row written before `lib/ai/catalog.ts` existed can hold an id the
  registry does not list, and that must render as the raw id rather than crash
  or render "undefined".

## Layout family

`design-system.md` §6.5 forbids repeating a family. This route is **the single
artefact record**: one large image panel at the row's own ratio, and beneath it
a metadata list — prompt, model, size, created, visibility — with the two
actions, download and delete, on one row. It is deliberately not `/generate`'s
form-led column, not a grid, and not an image-plus-text split. Record it as
`design-system.md` §2.11.

## Files

**Create**

- `app/(app)/g/[id]/page.tsx` — the Server Component route.
- `app/(app)/g/[id]/actions.ts` — `deleteGeneration`, the Server Action.
- `components/app/GenerationRecord.tsx` — *only if* the page needs a shared
  presentational piece. Prefer keeping the page's markup in the page.
- `components/app/DeleteGenerationButton.tsx` — the client leaf that owns the
  confirm step and renders the action's result.

**Modify**

- `lib/db/queries.ts` — add `getGenerationForOwner` and
  `deleteGenerationForOwner`.
- `lib/storage/generations.ts` — add `generationDownloadUrl(url)`, wrapping
  `getDownloadUrl` from `@vercel/blob`, so the `@vercel/blob` import stays
  behind the `server-only` module and no route imports it directly.
- `lib/validation/generation.ts` — add the id schema the action parses with.
- `proxy.ts` — add `/g` to both the route matcher and the `config.matcher`.
- `components/app/GeneratorWorkspace.tsx` — each history card becomes a link to
  `/g/<id>`.
- `docs/backend.md` — the record (§8.5).
- `design-system.md` — new §2.11, **and** the stale line in §7: it still says
  "the Vercel AI Gateway runs the image model", which prompt 014 replaced with
  Cloudflare Workers AI. `AGENTS.md` §12 rule 8 requires fixing a contradiction
  in the same change that finds it. Correct that one sentence and nothing else
  in §7.
- `AGENTS.md` — **at most one index row**, and only if `docs/automation.md` gains
  a section. Nothing else in that file changes.

**Must not touch**

- `app/(marketing)/**`, `components/sections/**`, `components/brand/**`,
  `components/motion/**`, `app/globals.css`, `lib/z.ts`, `lib/ai/**`,
  `components/ui/PromptField.tsx`, `components/app/GenerationControls.tsx`,
  `app/(app)/generate/actions.ts`, `lib/db/schema.ts`.
- **No migration.** This step adds no column and generates none.
- `components/ui/Button.tsx` stays as it is — it renders an `<a>`, which is
  exactly right for the download link. The delete control needs a real
  `<button>`, and the precedent for that is `GenerateButton` inside
  `PromptField.tsx`: a native button carrying the same token classes inline. Do
  not make `Button` polymorphic for this.

## The route

`app/(app)/g/[id]/page.tsx`:

1. `const { id } = await params` — **params is a Promise in Next 16.** Verify
   the signature against `node_modules/next/dist/docs/` rather than memory.
2. `const userId = await requireUserId()` from `lib/auth`. The proxy is
   optimistic and is not the boundary (§11 rule 1).
3. Validate `id` as a UUID **before** it reaches the query. A malformed id sent
   to a `uuid` column raises a Postgres error rather than returning no rows, so
   an unvalidated 404 path becomes a 500 for anyone typing a wrong URL. Zod 4 is
   what this repo uses — confirm the current UUID helper's name in
   `node_modules/zod` rather than assuming (§12 rule 2). A failed parse is
   `notFound()`.
4. `getGenerationForOwner(id, userId)` — filters on **both** columns in the
   query (§9 rule 1). `undefined` is `notFound()`.
5. Render. `alt` is the prompt, as `/generate` already does. `sizes` is set for
   the real layout; **no `priority`** — the macaw is the only priority image on
   the site (`design-system.md` §5.3).
6. Metadata: a static route title. **Do not put the prompt in `<title>`** — it
   would land in the browser tab, history and any shared screenshot, and a
   prompt is the user's data (§8.3).

Visibility renders as a plain line: private, or in the public gallery. **No
publish or unpublish control** — that is step 8, and adding it here is scope
growth.

## The delete action

`app/(app)/g/[id]/actions.ts`, following `AGENTS.md` §10 stages in order:

- **a.** `const { userId } = await auth()` — no session is a typed failure, never
  a throw. A `userId` from the client is ignored; there is no such field.
- **b.** Parse the id from `FormData` with the shared schema. A field-name
  constant lives beside the schema, as `PROMPT_FIELD` and the others already do,
  so the form and the parser cannot drift.
- **c.** No quota check. Delete spends no provider money and frees storage;
  say so in a comment rather than leaving the omission unexplained.
- **d.** Authorise: `getGenerationForOwner(id, userId)`. Not found is a typed
  failure with the same message a wrong owner gets.
- **e/f.** `deleteGenerationImage(row.imageUrl)`, then
  `deleteGenerationForOwner(id, userId)` — the ordering argued above, and the
  second query filters on the owner again rather than trusting step d.
- **h.** `revalidatePath("/generate")`. Only if `row.isPublic`, also
  `updateTag(PUBLIC_GALLERY_TAG)` and `revalidatePath("/")` — a private row's
  removal changes nothing anyone else can see, and the landing page must not be
  expired for it. This mirrors what `generateGeneration` already does.
- Then `redirect("/generate")`.

**`redirect()` signals by throwing.** It must be called after the try/catch,
never inside one, or the redirect is swallowed as a failure. Check how Next 16
exposes the redirect-error predicate before writing any catch that could sit
around it.

The return type is a discriminated union, matching the shape
`GenerationActionState` already establishes, so the leaf cannot read data off a
failure (§10 rule 2). On success the function does not return — it redirects.

Every `console.error` uses a fixed string plus a message scrubbed of the prompt,
exactly as `safeErrorMessage` does in `app/(app)/generate/actions.ts`. **No
prompt, no image URL, no owner id in any log line** — the Blob URL carries the
Clerk id in its pathname, which is the known gap in `docs/backend.md`.

## The delete control

`components/app/DeleteGenerationButton.tsx`, a client leaf:

- Two-step confirm, in markup: the first button reveals a confirm and a cancel.
  **No `window.confirm`** — it is a browser modal, and it is unstyleable.
- `useActionState` for the result, `useFormStatus` for pending, the same pair
  `GeneratorWorkspace` and `PromptField` already use.
- The failure message renders in a `role="status" aria-live="polite"` node and
  is legible without colour (§8.2 rule 5).
- Focus: revealing the confirm moves focus to it, and cancelling returns focus
  to the button that opened it. Every stop shows the global lime ring
  (`design-system.md` §6.8).
- The destructive button does **not** become a new red. Two accents, locked
  (§1.1, §6.2). Use the existing `ghost` treatment and let the words carry the
  weight.

## Download

`<a>` to `generationDownloadUrl(row.imageUrl)`, styled as the `ghost` `Button`.

**Do not rely on the `download` attribute alone.** It is ignored cross-origin,
and Blob is a different origin, so a bare `download` link opens the image
instead of saving it. `getDownloadUrl` appends the query parameter that makes
Blob send `Content-Disposition: attachment`, which is what actually downloads.
Confirm that behaviour by clicking it, not by reading about it.

## Render impact

- `/g/[id]` — **new.** Dynamic, per-request, owner-scoped. Never prerendered.
- `/generate` — markup changes: each history card gains a link wrapper. Already
  dynamic; **the render mode must not change.**
- `/` — **no change of any kind**, and this must be proven, not assumed. Run the
  prerendered-HTML comparison in `docs/automation.md`, not a screenshot.
- Every marketing route — no change. The proxy matcher gains `/g` only, so no
  static page starts paying for auth per request (§11 rule 5).
- **Cache Components stays off.** Nothing here argues for it.

Prove all of this with the route-table diff in `docs/automation.md`.

## Trust boundary

Two things cross from the browser.

1. **A URL path segment**, `id`, on a GET. It is validated as a UUID, then used
   only inside a query that also filters on the session's owner id. A valid id
   belonging to someone else returns `notFound()`, identical to an id that does
   not exist.
2. **One `FormData` field**, the id, on the delete action. Authorised by the
   Clerk session read inside the action; validated by the shared schema;
   ownership filtered in both the read and the delete. A rejected request
   returns `{ ok: false, error }` — a plain sentence in the site's register, no
   provider text, no row contents, no id echoed back.

Nothing else crosses. No user id, no Blob URL and no model id is accepted from
the client.

## Secrets and data

- **Reads:** `DATABASE_URL` through `getDb()`, `BLOB_READ_WRITE_TOKEN` through
  `@vercel/blob`, `CLERK_SECRET_KEY` and
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` through Clerk. All already provisioned. **No
  new environment variable is introduced by this step**, and none may be
  invented (§12 rule 6).
- **`NEXT_PUBLIC_*`:** only the two Clerk names already in use. Nothing new
  becomes public.
- **Stores:** nothing new. No column, no table, no row written.
- **Deletes:** one Blob object and one row, on the owner's explicit request.
- **Logs:** fixed strings only. No prompt, no email, no Blob URL, no owner id,
  no request body (§8.3 rule 2).
- **Transmits:** the row's own fields to its own owner, over the authenticated
  page. Nothing to a third party beyond the Blob delete call.

## Non-goals

- **No sharing, no public view of `/g/[id]`, no share link.** Step 8.
- **No publish or unpublish toggle.** Step 8. The route reports the visibility
  it finds and offers no control over it.
- **No `/library`, no pagination, no search, no soft delete.** Step 7.
- **No `deleted_at` column and no migration.** Decision 1 above.
- **No bulk delete**, no multi-select, no "delete all". One image, one action.
- **No image editing, no regenerate, no variations.** Step 13, and unapproved.
- **No Open Graph image, no metadata beyond a title.** The route is owner-only;
  there is nothing to preview to anyone.
- **No new token, radius, colour, motion row or z-index level.**
- **No change to the generation action, the model registry, or the schema.**

## Checks

Run all of these, quote the real output, and claim nothing unrun (§2, §12
rule 3):

1. `npm run lint`
2. `npm run build` — and read the route table in the output.
3. The **route-table diff** from `docs/automation.md`, stashing only the source
   files changed.
4. The **prerendered-HTML comparison of `/`** from `docs/automation.md`. Byte
   counts first, then the normalised diff. `IDENTICAL` is the required result.
5. The **environment-absent build** from `docs/automation.md`. The new query and
   the new storage helper must not construct anything at module scope.
6. The **client-bundle secret scan** from `docs/automation.md`, over
   `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL` and `CLERK_SECRET_KEY`. Read the
   context of any hit; the known permanent `CLERK_SECRET_KEY` name-only hit is
   documented there and is settled by the value search.
7. **The two-account check (§8.3 rule 4), against the database.** Use the
   read-only script recipe in `docs/automation.md`. Select `id` and `user_id`
   only — never `prompt`, never `image_url`. Signed in as one owner, request
   `/g/<another-owner's-id>` and confirm a 404. If the development database has
   only one owner, **say so plainly and verify what can be verified** — a
   well-formed UUID that matches no row, and a malformed one — rather than
   describing a test that was not possible.
8. Click the download link and confirm the browser saves a file rather than
   navigating to the image.
9. Delete one image end to end, then re-query the database read-only to confirm
   the row is gone, and fetch the Blob URL to confirm it no longer resolves.
   Delete a **private** image and confirm `/` was not revalidated; if a public
   one is deleted, confirm the strip updates.

## Recording the result

- `docs/backend.md` — the two new queries, the delete action's stages and its
  ordering argument, the permanent-delete decision and its divergence from §9.1,
  the redirect deviation from §10 rule 5, the updated route table, and the
  measured results of checks 7, 8 and 9.
- `design-system.md` — new §2.11 for the single-artefact record family, and the
  one-sentence §7 correction. **No §3 row**, because there is no new motion.
- `docs/automation.md` — check 7 is the candidate. Before writing it, look at
  the prompt-009 verification section of `docs/backend.md`: if a cross-owner
  check was already worked out by hand there, this is the second time and §3
  requires capturing it now. If it was not, note it as still uncaptured and
  leave the file alone.
- **`AGENTS.md` gets nothing** unless `docs/automation.md` gains a section, in
  which case its index row already covers it and no edit is needed at all.

## SKILLS USED

- `vercel:nextjs` — Next 16 App Router: dynamic segment `params`, `notFound()`,
  `redirect()` inside a Server Action, and route-group placement.
- `vercel:vercel-storage` — Vercel Blob: `del`, and `getDownloadUrl` with the
  `Content-Disposition` behaviour the download link depends on.
- `vercel:auth` — Clerk in Next 16: `auth()` in a Server Action, `auth.protect()`
  in a page, and the `proxy.ts` matcher.
- `drizzle-docs` — the `delete().where().returning()` form, and composing `and`
  over two equality filters. *(If no skill by this name is listed at execution
  time, read `node_modules/drizzle-orm` directly and say that is what happened.)*
- `neon-postgres` — the pooled runtime connection, and why a UUID cast error is
  not a missing row.
- `zod-docs` — the Zod 4 UUID helper's current name and the `safeParse` result
  shape. *(Same fallback: verify in `node_modules/zod` and say so.)*
- `tailwind-4-docs` — token-driven utilities only; every colour resolves from
  `app/globals.css`, no raw hex.
- `vercel-react-best-practices` — keeping the client leaf a leaf, and not
  turning the page into a client component to get one button.
- `design-taste-frontend` and `frontend-design:frontend-design` — the
  single-artefact layout family, so it does not become another image-plus-text
  split.
- `web-design-guidelines` — the confirm step's focus management and the
  announced result.

None of these is optional. `AGENTS.md` §4 is explicit that listing is not
loading: invoke each one at execution time, before writing code, and if a named
skill is not in the listing then say so rather than proceeding silently.
