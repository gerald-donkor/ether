# 023 — Account and data rights

## Scope, and why it is next

Build step 11 of AGENTS.md §5.2: **account and data rights — generation
defaults, export, and account deletion that actually removes the blobs as well
as the rows.**

It is next because it is the only unbuilt step in the sequence. Resolved from
the repository and `git log`, not from `prompts/`:

| step | evidence it is built |
| --- | --- |
| 1 | `a367b09` "Build backend foundation and generator app"; `app/(app)/`, `lib/db/`, `proxy.ts` |
| 2 | `4c5b9f7`; `app/(marketing)/{learn,build,product,community}` |
| 3 | `2389ddf`; the seven `app/(marketing)` destination routes |
| 4 | `2b612af`; `getPublicGalleryImages` in `lib/db/queries.ts` |
| 5 | `8ed5482`, `754ddbf`; `lib/ai/catalog.ts`, `components/app/GenerationControls.tsx` |
| 6 | `813c477`; `app/(generation)/g/[id]/` |
| 7 | `ed8e75b`; `app/(app)/library/` |
| 8 | `fa4747e`; `listCommunityGenerations`, `/community` |
| 9 | `2e1441e`; `lib/db/quotas.ts`, the usage group on `/account` |
| 10 | `02c4afa`; `lib/ai/moderation.ts`, `lib/db/moderation.ts`, `app/(generation)/g/[id]/report/` |

Steps 12–14 are phase three and AGENTS.md §5.2 states none of them may be
started without asking. So step 11 is the whole remaining plan, and it closes
the one promise the product currently cannot keep: §8.3 rule 5 says deletion
means deletion, and today the only thing that removes a Blob object is deleting
one image at a time from `/g/[id]`.

## Reference material read for this prompt

- `AGENTS.md` — §5.2 step 11, §6.1–§6.3, §8.2, §8.3, §8.4, §9, §10, §11, §12.
- `design-system.md` §2.8 (application shell, including the `/account` usage
  group as built), §2.11 (the two-step destructive confirm on `/g/[id]`),
  §1.1, §1.5, §6.
- `docs/backend.md` — "Data model" (lines 23–123), "Database boundary" (124),
  "Quotas and usage reading, prompt 021" (257), "The generation permalink and
  its delete" (310) including "`deleteGeneration`, and why it is ordered the way
  it is" (340), "Storage" (675), "User data" (735).
- Source read in full: `lib/db/schema.ts`, `lib/db/queries.ts` (exports),
  `lib/db/quotas.ts` (exports), `lib/storage/generations.ts`, `lib/auth/index.ts`,
  `lib/validation/generation.ts`, `lib/ai/catalog.ts` (head),
  `app/(app)/account/page.tsx`, `app/(app)/generate/page.tsx`,
  `app/(app)/library/actions.ts`, `app/(generation)/g/[id]/actions.ts`,
  `components/app/GenerationControls.tsx`, `components/app/GeneratorWorkspace.tsx`.
- APIs verified in `node_modules/` this session, per §12 rule 2:
  - `node_modules/@vercel/blob/dist/index.d.ts:78` —
    `del(urlOrPathname: string[] | string, options?): Promise<void>`. It takes
    an array; **no maximum array length is stated in the type**, so the
    implementation chunks and records the chunk size and its reason.
  - `node_modules/@clerk/nextjs/dist/types/server/clerkClient.d.ts` —
    `clerkClient` is `() => Promise<ClerkClient>`, so it is **awaited**, not
    called synchronously.
  - `node_modules/@clerk/backend/dist/api/endpoints/UserApi.d.ts:438` —
    `deleteUser(userId: string): Promise<User>`.
  - `@clerk/nextjs` is 7.7.4 (`node_modules/@clerk/nextjs/package.json`).

## What this prompt builds

### 1. Generation defaults

A per-owner preference row holding the four choices the generator already
takes: model, size, count, and default publication visibility. `/generate`
reads it and seeds the controls with it instead of
`DEFAULT_GENERATION_CHOICE`; `/account` is where it is edited.

**Where it is stored, and why not Clerk.** AGENTS.md §7.5 forbids a `users`
table because Clerk owns identity. A preferences row is not identity: it holds
no email, no name, no external id beyond the Clerk `user_id` that every other
table already carries as its owner column, and it is application data of
exactly the kind `lib/db/` owns. Clerk metadata would put application state
behind a second write path outside `lib/db/`, break the §6.1 data-layer
boundary, and make the export read from two providers. So: a new table,
`user_preferences`, keyed on `user_id` as its primary key.

Schema, to be added to `lib/db/schema.ts`:

| column | type | note |
| --- | --- | --- |
| `user_id` | `text` primary key | the Clerk owner id, from the session |
| `default_model` | `text` | validated against `IMAGE_MODEL_IDS` before write |
| `default_size` | `text` | validated as a size **of that model** |
| `default_count` | `integer` | one of `GENERATION_COUNTS` |
| `default_visibility` | `generation_visibility` | reuses the existing enum. `unlisted` is **not** offered as a default; see below |
| `created_at` | `timestamptz not null default now()` | §9 rule 4 |
| `updated_at` | `timestamptz not null default now()` | stamped on every write |

No index beyond the primary key: every read is by exact `user_id`.

**Two constraints the implementation must honour.**

- The model/size pair is only ever valid together, exactly as
  `generationRequestSchema.superRefine` already enforces. The preferences
  schema reuses that pairing rule rather than restating it — extract the shared
  check if that is what it takes, but the rule must have one definition.
- **A stored default that later becomes invalid must not break `/generate`.**
  A model can leave `lib/ai/catalog.ts` (§5.3 rule 2 makes the id one edit).
  The read path therefore *resolves* preferences through the catalog and falls
  back to `DEFAULT_GENERATION_CHOICE` field by field when a stored value is no
  longer in the closed list. It never renders an option that does not exist and
  never sends one to the action.
- **Defaults are a convenience, never an authorisation or a consent.** The
  generate action keeps parsing the submitted form with
  `generationRequestSchema` and keeps deriving visibility from the submitted
  checkbox. A stored `default_visibility` of `public` sets the checkbox's
  initial checked state on `/generate` and nothing more; the server still reads
  consent from the request. `unlisted` is excluded from the default because the
  publish control is a binary checkbox and a default the control cannot express
  would be a lie about what will happen.

### 2. Export

`GET /account/export` — a Route Handler at
`app/(app)/account/export/route.ts` returning `application/json` with
`Content-Disposition: attachment`, containing everything Ether stores about the
signed-in owner.

**This is a stated deviation from AGENTS.md §6.1** ("Route Handlers … for
*external* callers only"), and it must be recorded in `docs/backend.md` rather
than passed over. The argument: §6.2's hard boundary is about *mutations* — the
UI must not mutate through a Route Handler, and this handler mutates nothing.
An export is a read that has to answer with a non-HTML content type and a
download disposition, which a Server Component cannot do and a Server Action
cannot do without shipping the whole payload into the browser as a string and
building a `blob:` URL in client code. The handler stays thin: session, then
one call into `lib/db/`, then serialise.

Rules for it:

- `await auth()`; no session is a `401` with a plain JSON body, not a redirect
  and not an HTML error page.
- The owner id comes from the session. There is no query parameter naming a
  user, and one arriving is ignored (§6.2).
- It reads through `lib/db/`. No SQL in the handler.
- The payload contains, all filtered on the owner inside the queries:
  - the identity fields `/account` already reads from Clerk (email, join date)
    plus the Clerk user id, so the file is self-describing;
  - **every** generation row including soft-deleted and taken-down ones — the
    prompt, image url, model, dimensions, visibility, and the three timestamps.
    A removed row is still the user's data;
  - the `usage_events` rows;
  - the preferences row, if one exists;
  - the reports the user filed, by category and date. **Not** reports filed
    *against* their generations, and never a reporter's id — that is somebody
    else's data.
- A version field and a generated-at timestamp, so the file is legible later.
- **Nothing is logged.** The payload is prompts and an email address, which
  §8.3 rule 2 puts off-limits to the console entirely. A failure logs the error
  name only.
- Node.js runtime, dynamic. No `runtime = "edge"` (§7.5).

Non-goal, stated in the file: it is a JSON manifest carrying image **urls**,
not a zip of image bytes. Bundling megabytes of Blob objects through a function
is a different problem with a memory and duration budget, and the urls in the
manifest are directly fetchable for as long as the account exists.

### 3. Account deletion

A `deleteAccount` Server Action colocated at `app/(app)/account/actions.ts`,
driven by a two-step confirm on `/account`, that removes the Blob objects, then
the rows, then the Clerk user.

It follows §10's lettered path, and its ordering argument is the one
`deleteGeneration` already makes and `docs/backend.md` line 340 already
records — **blobs before rows**, because a deleted row whose image is still
live at a public url is a broken promise behind a success message.

- **a.** `const { userId } = await auth()`; no session is a typed error.
- **b.** Parse the confirmation field with a schema in
  `lib/validation/account.ts`. The confirm is a typed word, matching the
  markup-level two-step confirm §2.11 established rather than a browser
  `confirm()` dialog — and per the harness rules, a dialog is not an option
  here anyway. The exact word is the implementation's call; it must be stated
  in the UI copy, in the register (§5, no em-dashes, no exclamation marks).
- **c.** No quota check. Deleting spends no provider money.
- **d.** Authorisation *is* the owner filter: every statement below is
  `where user_id = $session`.
- **e.** Read every Blob url this owner has, including soft-deleted and
  taken-down rows, and `del()` them in chunks. A chunk failure aborts before
  any row is deleted and returns a handled error; nothing is half-removed
  behind a success.
- **f.** Delete the rows, in one transaction where the driver allows it:
  `generations` (which cascades `reports.generation_id`), `usage_events`,
  `user_preferences`, and reports where `reporter_user_id` is this owner.
  Deleting the owner's usage events is correct rather than a quota hole: the
  Clerk account is gone and a new signup gets a new id, so retention would
  protect nothing and would keep data the user asked to have removed.
- **g.** `(await clerkClient()).users.deleteUser(userId)`. If this fails after
  the rows are gone, the user is told something **true** — the data is deleted
  and the sign-in could not be removed — and the error name is logged without
  any prompt, url or email.
- **h.** Revalidate. If any deleted row was `public`, `updateTag(PUBLIC_GENERATIONS_TAG)`
  plus `revalidatePath("/")` and `revalidatePath("/community")`, matching the
  rule `deleteGeneration` follows. Then `redirect("/")` — the account whose page
  this is no longer exists, so there is no slot to render into. That is the same
  stated deviation from §10 rule 5 that `deleteGeneration` already carries, and
  `redirect` throws, so it sits **outside** every `try`.

## Measurements and design

No new token, radius, colour, z-index level, motion row, or component library.
Everything below reuses values already recorded in `design-system.md`.

- `/account` gains two groups below the existing usage group, each opened by a
  single `--line` hairline and `mt-12 pt-8`, matching the usage group's exact
  spacing as built in `app/(app)/account/page.tsx`.
- Headings are the established 22px/30px `--text` role. Labels are the 12px
  uppercase `--text-3` role. Explanatory text is 15px/26px `--text-2`.
- The defaults form reuses `components/app/GenerationControls.tsx` unchanged if
  its props allow, and the publish checkbox pattern already in `PromptField`.
  Controls stay native `<select>` and `<input type="checkbox">`, inheriting the
  global lime `:focus-visible` ring.
- Buttons are the existing pill primitives. **The destructive control does not
  become a new colour** (§2.11, and the two-accent invariant). Delete is a
  two-step confirm in markup: the first press reveals a plain sentence, the
  typed confirmation field, a confirm button and a `Cancel`; focus moves to the
  first control of the revealed step and returns to the opener on cancel.
- Export is a plain link to `/account/export`, styled as an existing ghost pill.
  It is a same-origin navigation, so no client-side download machinery is
  needed.
- Every outcome is announced through a mounted, focusable `role="status"`
  region, as `/g/[id]` and `/library` already do, and reads without colour.
- The result slot for each form is mounted from first paint (§8.2 rule 6).

## Render impact

- `/` — **no markup change.** Revalidated only when a deletion removed a public
  row, which is the existing `deleteGeneration` behaviour, not a new one. Its
  render mode does not change.
- `/community` — same: revalidation only, no markup or mode change.
- `/account` — already a dynamic authenticated route. Gains two groups.
- `/generate` — already dynamic. Its initial control values now come from the
  preferences row, falling back to `DEFAULT_GENERATION_CHOICE`. **No markup
  restructuring**; the reserved result slot logic is unchanged in mechanism,
  though its initial dimensions follow the seeded choice.
- `/account/export` — new dynamic Route Handler.
- Every marketing route, `/library`, `/g/[id]` and the sign-in and sign-up
  screens: unchanged. **This must be verified against the route table**, not
  assumed.

## Trust boundary

Three request paths cross from the browser.

| path | authorises | validates | rejection |
| --- | --- | --- | --- |
| `savePreferences` action | `await auth()` session; the row is keyed on that id | shared schema in `lib/validation/`, model/size pair included | typed `{ ok: false, error }`, field errors where they help |
| `deleteAccount` action | `await auth()` session; every statement filters on it | confirmation word, shared schema | typed `{ ok: false, error }`; nothing deleted |
| `GET /account/export` | `await auth()` session | nothing crosses but the session | `401` with a plain JSON body |

No client-supplied user id is read on any of them. No route parameter selects
whose data is returned. The raw provider or database error never reaches the
client (§8.3 rule 6).

## Secrets and data

- Environment variables read: **none new.** The change uses `DATABASE_URL` via
  `getDb()`, `BLOB_READ_WRITE_TOKEN` via `@vercel/blob`, and `CLERK_SECRET_KEY`
  via `clerkClient()`, all already provisioned and all already server-only. No
  `NEXT_PUBLIC_*` variable is added, so nothing new reaches the browser.
- Data stored: one `user_preferences` row per owner, holding four enum-shaped
  choices and two timestamps. No new personal data.
- Data transmitted: the export sends the owner their own prompts, image urls,
  email and usage rows, over the authenticated session, to nobody else.
- Data logged: **nothing but error names.** Prompts, emails, urls and the whole
  export payload are off-limits (§8.3 rule 2). The existing `safeErrorMessage`
  redaction pattern in `app/(generation)/g/[id]/actions.ts` is the model where a
  message must be kept.
- Data deleted: on account deletion, every Blob object and every row this owner
  owns, plus the Clerk user.

## Non-goals

- **No admin role and no admin surface.** §11.1 still says there is no admin
  role, and nothing here needs one.
- **No grace period, no scheduled deletion, no undo on account deletion.** The
  library's soft delete is the undo layer for images; an account deletion is
  immediate and the copy says so.
- **No zip export of image bytes** (argued above).
- **No email confirmation of deletion.** There is no mail provider in this
  project and adding one is a §7.4 decision, not a step-11 detail.
- **No new `collection` table.** §9.1 makes it step-7 optional and step 7 did
  not need it.
- **No change to the generate action's validation or its quota path.**
  Preferences seed the form; they never alter what the server enforces.
- **Nothing on the marketing routes.**

## Files

**Create**

- `lib/validation/account.ts` — the preferences schema and the deletion
  confirmation schema, plus their field-name constants. Not `server-only`, like
  the rest of `lib/validation/`, and it must not import from `lib/db/`.
- `lib/db/account.ts` — the preferences read and upsert, and the account
  purge's queries. May instead extend `lib/db/queries.ts` if that reads better;
  the constraint is only that no SQL leaves `lib/db/`.
- `app/(app)/account/actions.ts` — `savePreferences`, `deleteAccount`.
- `app/(app)/account/export/route.ts` — the export handler.
- `components/app/GenerationDefaultsForm.tsx` — client leaf.
- `components/app/DeleteAccountForm.tsx` — client leaf, two-step confirm.
- `drizzle/0006_*.sql` and its `meta` entries, from `npm run db:generate`.
  **Generated, never hand-written.**

**Modify**

- `lib/db/schema.ts` — `userPreferences`, with a comment saying why it is not a
  users table.
- `app/(app)/account/page.tsx` — read preferences, render the two groups.
- `app/(app)/generate/page.tsx` — read preferences, pass the resolved initial
  choice.
- `components/app/GeneratorWorkspace.tsx` — accept an initial choice, defaulting
  to `DEFAULT_GENERATION_CHOICE`.
- `components/app/GenerationControls.tsx` — only if the account form genuinely
  cannot reuse it as-is. Its post-action reset effect and its comment must
  survive intact.
- `lib/storage/generations.ts` — a chunked multi-url delete, if that is where it
  belongs. `@vercel/blob` keeps exactly one importer outside `lib/`.
- `docs/backend.md` — the record (§8.5).
- `design-system.md` §2.8 — extend the `/account` paragraph with the two new
  groups. No new §3 row: nothing here animates.

**Must not touch**

`app/(marketing)/**`, `components/sections/**`, `components/brand/**`,
`components/motion/**`, `app/globals.css`, `lib/z.ts`, `lib/ai/**`,
`lib/db/quotas.ts`, `lib/db/moderation.ts`, `proxy.ts`, `next.config.ts`,
`app/(app)/generate/actions.ts`, `app/(app)/library/**`,
`app/(generation)/**`, and `AGENTS.md` — the last one except for a §12 rule 8
correction, which would be stated out loud.

## Checks to run, and where the result is recorded

Report the exact output of each; never claim one passed without running it
(§2, §12 rule 3).

1. `npm run db:generate`, then `npm run db:migrate`. Read the generated SQL
   before applying it and quote the DDL in `docs/backend.md`.
2. `npm run lint`.
3. `npm test`.
4. `npm run build`, and diff its route table against a pre-change build to
   prove only `/account/export` is new and no existing route changed mode. Use
   the route-table comparison already in `docs/automation.md`.
5. **The environment-absent build:** `mv .env.local .env.local.bak`, build,
   move it back. The new module must not construct a client at module scope.
6. The client-bundle secret scan from `docs/automation.md` — `CLERK_SECRET_KEY`
   and `BLOB_READ_WRITE_TOKEN` absent from `.next/static`.
7. A read-only database query, per `docs/automation.md`, confirming the
   `user_preferences` shape after migration.
8. **The deletion, end to end, against a throwaway account**: generate one
   image, make it public, soft-delete a second, then delete the account and
   verify the Blob urls 404, the rows are gone from all four tables, the Clerk
   user is gone, and `/` and `/community` no longer show the public image. If
   any part of this cannot be run, say which part and why, and do not describe
   it as passed (§12 rule 9).
9. The export downloaded once and opened, confirming it contains the
   soft-deleted row and contains no other user's data.

Record the schema DDL, the export's shape and its §6.1 deviation argument, the
deletion ordering, the Blob chunk size and its reason, and every verification
result in **`docs/backend.md`** under a `## Account and data rights, prompt 023`
heading with a `### Verification, prompt 023` subsection. Record the `/account`
surface changes in **`design-system.md` §2.8**. Record nothing in `AGENTS.md`.

If any step in check 4 or 8 was repeated by hand a second time this session,
add it to `docs/automation.md` in the same change (§3).

## SKILLS USED

- **`vercel:nextjs`** — Route Handler vs Server Action boundaries, the `route.ts`
  contract, async `auth()`/`headers()`, `redirect` semantics inside actions, and
  Next 16 conventions. Loaded while writing this prompt.
- **`vercel:vercel-storage`** — Vercel Blob delete semantics and the lazy
  `getDb()` build-time rule. Loaded while writing this prompt.
- **`neon-postgres`** — pooled `DATABASE_URL` for the app versus unpooled
  `DATABASE_URL_UNPOOLED` for the migration, and transaction behaviour on the
  serverless driver, which the multi-table purge depends on.
- **`vercel:auth`** — Clerk on Next.js: `clerkClient()`, backend user deletion,
  and what happens to the session after the user is destroyed.
- **`vercel:env-vars`** — confirming no new variable is needed and that nothing
  added is `NEXT_PUBLIC_*`.
- **`vercel:vercel-functions`** — the Node.js runtime and duration budget for the
  export handler and the chunked blob purge.
- **`vercel-react-best-practices`** — the two new client leaves, `useActionState`
  and `useFormStatus` usage, and keeping the server/client split correct.
- **`web-design-guidelines`** — the destructive confirm's focus management and
  the announced result regions.
- **No skill covers Drizzle or Zod in this installation.** AGENTS.md §1 step 2
  names `drizzle-docs`, `zod-docs` and `tailwind-4-docs`, and none of the three
  is in the available-skills listing. Both APIs must therefore be verified
  against `node_modules/` before use (§12 rule 2), and the existing
  `lib/db/schema.ts` and `lib/validation/generation.ts` are the in-repo
  precedent to follow.
