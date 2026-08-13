# 017 - The generation library

## Scope, and why it is next

**Build step 7, `/library`**: the user's own generations with pagination, prompt
search, and soft delete, plus the shrinking of `/generate`'s history grid to a
recent strip that links here.

It is next because phase one and steps 5 and 6 are committed and step 7 is the
next unbuilt row of `AGENTS.md` §5.2. Resolved from the repository, not from
`prompts/`:

- step 1 - `a367b09` "Build backend foundation and generator app"
- step 2 - `4c5b9f7` "Add four marketing navigation routes"
- step 3 - `2389ddf` "Add seven footer destination routes"
- step 4 - `2b612af` "Back the gallery strip with opt-in public generations"
- step 5 - `8ed5482` / `754ddbf` (generation controls)
- step 6 - `813c477` "Give every generation a permalink it can be deleted from"

Step 7 declares its dependencies as 1 and 6. Both exist: `app/(app)/generate/`
and `app/(app)/g/[id]/` are on disk with `lib/db/queries.ts` behind them. Step 8
(sharing) depends on 4 and 6, not on 7, but step 7 is the earlier row and it is
the one that pays down the soft-delete debt prompt 016 deliberately deferred.

**The soft delete question is already settled, and this prompt inherits the
answer.** `docs/backend.md` (§"`deleteGeneration`, and why it is ordered the way
it is") records the user's 2026-08-13 decision that deletion on `/g/[id]` is
permanent, because a row marked deleted while its image stays fetchable at a
public Blob url is a broken promise rather than an audit trail. It then states:
*"Step 7's soft-delete state is therefore an undo layer over the library, not
the delete mechanism, and step 7's prompt has to say so."* This prompt says so.
The two operations are different things and both exist after this change:

| operation | where | what happens |
| --- | --- | --- |
| **Remove** (soft) | `/library` | `deleted_at` is stamped. The row leaves every listing, the permalink, the public gallery and the account count. The Blob object stays. Undoable. |
| **Delete permanently** | `/g/[id]`, and the library's Removed view | The Blob object and the row both go, in that order. Not undoable. Unchanged from prompt 016. |

## Reference material read for this prompt

By path, all read before writing this file:

- `AGENTS.md` - §1 workflow, §4 prompt contract, §5.2 build sequence,
  §6.2 boundaries, §6.3 file layout, §8.1-8.5, §9 data model, §10 write path,
  §11 roles, §12.
- `design-system.md` - §1.1 colour, §1.5 shape, §2.8 application shell,
  §2.11 the single artefact record, §6 non-negotiables.
- `docs/backend.md` - data model (lines 23-72), database boundary (74-120),
  generation action (122-205), the permalink and its delete (206-287).
- `docs/automation.md` - the route-table comparison, the environment-absent
  build, the landing-page HTML comparison, the client-bundle secret scan.
- `lib/db/schema.ts`, `lib/db/queries.ts`, `lib/validation/generation.ts`,
  `lib/auth/index.ts`.
- `app/(app)/layout.tsx`, `app/(app)/generate/page.tsx`,
  `app/(app)/account/page.tsx`, `app/(app)/g/[id]/page.tsx`,
  `app/(app)/g/[id]/actions.ts`, `components/app/GeneratorWorkspace.tsx`,
  `components/app/DeleteGenerationButton.tsx`, `proxy.ts`.

APIs verified this session rather than recalled:

- `searchParams` is `Promise<{ [key: string]: string | string[] | undefined }>`
  and must be awaited -
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:75`.
  Reading it opts the route into dynamic rendering, which is correct here.
- Drizzle 0.45.2 exports `ilike(column, value)`
  (`node_modules/drizzle-orm/sql/expressions/conditions.d.ts:364`) and
  `isNull(value)` (`:206`); `.limit()` and `.offset()` are on the pg select
  builder (`node_modules/drizzle-orm/pg-core/query-builders/select.d.ts:558`,
  `:575`).
- Versions in `node_modules`: `next` 16.3.0, `drizzle-orm` 0.45.2, `zod` 4.4.3.

## The measurements, and where they come from

No new number is invented and nothing is eyeballed. Every value below is an
existing one, quoted from the file that owns it:

- container, spacing and type roles: `Container`, the 4px scale, and the
  `clamp(36px,7vw,64px)` / `clamp(28px,5vw,40px)` / 15px-on-26px / 13px roles
  already used by `app/(app)/generate/page.tsx` and `app/(app)/g/[id]/page.tsx`.
- colour: `--ink`, `--surface`, `--surface-2`, `--line`, `--text`, `--text-2`,
  `--text-3` only. No new token, no raw hex.
- radius: `--r-card` for a thumbnail, `--r-pill` for a control. No new radius,
  and the gallery keeps its `--r-none` exception.
- the ghost control treatment is copied from
  `components/app/DeleteGenerationButton.tsx:21-22`, which itself records why it
  is written out rather than using `Button`.
- **page size is 20 and it is a choice, not a measurement.** Say so in the
  comment: it is a round number that fills the ledger without a second screen of
  scrolling, and it is one constant to change.
- the recent strip on `/generate` shows **6**, also a stated choice: two rows of
  three at the existing three-column grid, so the section keeps its shape while
  losing its role as the whole history.

Anything measured during execution (row counts, timings) is recorded as measured
and says whether the database was warm (`AGENTS.md` §7.3, Neon scale-to-zero).

## Render impact

- **`/` - markup unchanged, content filtered.** `listPublicGenerations` gains
  an `is_public = true AND deleted_at IS NULL` filter, so a removed public image
  leaves the strip. The route's render mode does not change: it stays the
  `unstable_cache` read behind `PUBLIC_GALLERY_TAG`, and the soft-delete and
  restore actions expire that tag exactly as `deleteGeneration` already does.
  The prerendered HTML must be **byte-identical** by the `docs/automation.md`
  comparison, because the local database has no public rows from another
  account in play; if it is not identical, stop and report rather than
  normalising the difference away.
- **`/generate` - changes, deliberately.** The history section becomes a recent
  strip of 6 with a link to `/library`. Still dynamic, still owner-filtered.
- **`/account` - unchanged markup; the `Images` figure now excludes removed
  rows**, which is the honest reading of a count the user can act on.
- **`/g/[id]` - unchanged markup.** A removed row now `notFound()`s here,
  because the page's read excludes soft-deleted rows.
- **`/library` - new dynamic route.** Dynamic by construction: it awaits
  `searchParams` and reads the session.
- **Every marketing route - no change.** Verified by the route-table diff and
  the landing-page HTML comparison, not assumed.

## Trust boundary

Three request paths cross from the browser.

1. **`/library` search and pagination**, as `GET` query parameters: `q`, `page`,
   `view`. A native `<form method="get">` for the search; plain `<Link>`s for
   pagination and the view switch. **No client-side data fetching** (§6.2).
   All three are parsed server-side with a Zod schema in
   `lib/validation/library.ts`: `q` trimmed and capped at the prompt's own 500,
   `page` coerced to a positive integer with an upper bound, `view` an enum of
   `active | removed`. A malformed value falls back to the default rather than
   throwing, because a mistyped url must not 500 a page.
2. **Remove**, a Server Action, one field: the generation id, parsed with the
   existing `generationIdSchema`. Authorised by an owner-filtered update; a
   wrong owner matches no row and returns the existing `That image could not be
   found.` message, which is the same answer as "no such image" so neither
   confirms an id exists.
3. **Restore**, the same shape, the same authorisation, the same message.

Permanent delete is unchanged apart from where it returns to. **No `userId`
crosses in any of these**; it is read from the Clerk session on the server every
time. Rejections are typed results, never thrown strings. `proxy.ts` gains
`/library` in both the route matcher and `config.matcher`, so no static
marketing route starts paying for auth per request (§11 rule 5).

## Secrets and data

- **No new environment variable.** No `NEXT_PUBLIC_*` addition. The change reads
  nothing the app does not already read.
- **Stores** one new column, `generations.deleted_at`, a nullable
  `timestamp with time zone`. It is a lifecycle transition timestamp, which
  §9 rule 4 requires rather than a bare boolean.
- **Logs** fixed strings only. Every `console.error` on the new paths reuses the
  redaction already written in `app/(app)/g/[id]/actions.ts:39-48`: the row's
  prompt **and** its Blob url are replaced before anything is logged, the url
  because Blob pathnames carry the owner's Clerk id (`docs/backend.md`, known
  gap under the public gallery read).
- **Transmits** nothing new to any provider. There is no model call and no Blob
  write on this route.
- The search term is the user's own text matched against their own rows. It is
  never logged and never leaves the request.

## The data model change

One column, one migration.

```
deleted_at  timestamp with time zone  null   -- when the owner removed it
```

`NULL` means live, which is what migrates every existing row correctly with no
backfill. Add it to `lib/db/schema.ts` with a comment saying it is the undo
layer and not the delete mechanism, and pointing at `docs/backend.md`.

**No new index**, and the reason is stated rather than assumed: the listing
still enters through `generations_user_created_at_idx` on
`(user_id, created_at desc)`, and `deleted_at IS NULL` is a filter on the rows
that index already narrows to one owner. A partial index is a step 9/11
question, not this one. If the execution measures a listing that says otherwise,
record the measurement rather than adding an index on instinct.

Apply it the way `docs/backend.md` records the last one being applied:

```bash
npm run db:generate
# read both statements, confirm they are additive, then:
dotenv -e .env.local -- drizzle-kit push --force
```

`--force` is needed because `strict` is set in `drizzle.config.ts` and push
wants a TTY. Then confirm the column with the read-only script in
`docs/automation.md` - `information_schema.columns` for the type and nullability,
`pg_indexes` for the unchanged index set - and paste the real output into
`docs/backend.md`.

## The query layer

All of it in `lib/db/queries.ts`; nothing else writes SQL (§6.2).

**Existing queries that gain `isNull(generations.deletedAt)`:**

- `listGenerationsForUser` - the recent strip.
- `countGenerationsForUser` - `/account`'s figure.
- `listPublicGenerations` - the landing gallery.
- `getGenerationForOwner` - the permalink read.

**One existing query that must NOT gain it, and the comment must say why:**

- `countRecentGenerationsForUser` - the hourly floor. The provider was already
  paid for a removed image, so excluding it would let a user reset their own
  quota by removing rows. Counting spend, not inventory.

**New queries:**

- `listLibraryPage({ userId, search, page, pageSize, removed })` - owner
  filtered, `deleted_at IS NULL` or `IS NOT NULL` by the `removed` flag,
  `ilike(prompt, '%' + escaped + '%')` when a search term is present, ordered
  `created_at desc`, `.limit(pageSize + 1).offset((page - 1) * pageSize)`.
  **The `+ 1` is how "is there a next page" is answered without a second count
  query**, and the extra row is dropped before the caller sees it. Return
  `{ rows, hasMore }`.
  **Escape `%` and `_` in the search term** before interpolating it into the
  pattern, or a user searching for `100%` silently matches everything.
- `getGenerationForOwnerIncludingRemoved(id, userId)` - the same two-column
  filter, without the `deleted_at` condition. Only the permanent-delete action
  uses it, so that a removed row can still be destroyed for good.
- `softDeleteGenerationForOwner(id, userId)` - `update ... set deleted_at = now()
  where id = $1 and user_id = $2 and deleted_at is null`, returning
  `{ id, isPublic }`. Returning `is_public` is what tells the action whether to
  expire the gallery tag; the `deleted_at is null` guard makes a double submit a
  no-op rather than a second timestamp.
- `restoreGenerationForOwner(id, userId)` - the mirror, guarded on
  `deleted_at is not null`, returning the same projection.

Both mutations filter on the owner **inside the statement** (§9 rule 1), so a
wrong id matches nothing rather than returning a row to a check that was
forgotten.

## The actions

`app/(app)/library/actions.ts`, colocated with the route (§6.3). Two exports,
both following `AGENTS.md` §10's lettered stages and both returning a
discriminated union - never a thrown string, never a bare string.

```ts
export type LibraryActionState =
  | { ok: null; error: null }
  | { ok: true; error: null }
  | { ok: false; error: string };
```

`removeGeneration` and `restoreGeneration`:

- a. session from `auth()`, awaited (Core 3). No client `userId` exists to
  ignore, because the form carries only the id.
- b. parse the id with `generationIdSchema`.
- c. **no quota check**, and comment the omission as prompt 016 did: neither
  operation spends provider money.
- d/g. the owner-filtered update *is* the authorisation and the write.
- h. `revalidatePath("/library")` and `revalidatePath("/generate")` always;
  `updateTag(PUBLIC_GALLERY_TAG)` and `revalidatePath("/")` **only when the
  returned row was public**, matching `deleteGeneration`'s existing rule.
- **No redirect.** §10 rule 5 applies in full here: the row's surface still
  exists, the user stays where they are, and the result appears in a slot that
  was already reserved. This is not `/g/[id]`, where the page's whole subject
  ceased to exist.

**One change to `app/(app)/g/[id]/actions.ts`, and only one behavioural bit:**

- it reads through `getGenerationForOwnerIncludingRemoved`, so a removed row can
  still be permanently deleted;
- it accepts an optional `returnTo` field validated against a **closed list of
  exactly two paths**, `/generate` and `/library`, defaulting to `/generate`.
  Anything else falls back to the default. An open redirect through a
  user-supplied path is the failure this guard exists to prevent.

Its ordering, its logging, its redaction and its blob-before-row argument are
unchanged. Do not restructure that file.

## The route and its layout family

`app/(app)/library/page.tsx`, a Server Component. `requireUserId()` first - the
proxy is optimistic and is not the boundary (§11 rule 1).

**A new layout family, because §6.5 says families do not repeat.** `/generate`
is a form-led column with a three-column card grid; `/g/[id]` is an image-led
record. **`/library` is a ledger**: full-width rows separated by hairlines, each
row a small square `--r-card` thumbnail at the left, the prompt as the reading
column, model, size and date as quiet meta, and the row's actions at the right.
It reads as an index of work, not a second gallery, which is also what makes
search and pagination feel native to it. Explicitly **not** another
image-plus-text split.

The page carries, in order:

1. the heading at the `clamp(36px,7vw,64px)` role, one line of plain copy;
2. a `GET` search form - a real `<label>`, a `--surface-2` field at `--r-pill`,
   a submit control. It preserves `view` in a hidden field so searching inside
   the Removed view stays there. It inherits the global lime `:focus-visible`
   ring;
3. the two-view switch, `Your images` / `Removed`, as links that keep `q` and
   reset `page`. The current view is marked with `aria-current="page"`;
4. the rows, each prompt linking to `/g/<id>` in the active view. In the Removed
   view the prompt is **not** a link, because that permalink 404s by design -
   the row offers `Restore` and `Delete permanently` instead;
5. the pagination rail: `Newer` and `Older` links, disabled-looking as plain
   text when there is nowhere to go, never a dead link. Page numbers are not
   invented - the rail says `Page N` from the parsed parameter and nothing
   about a total, because a total would need a count query this design
   deliberately avoids;
6. real empty states, three of them and each factual: no images yet, no search
   match (quoting the term back), nothing removed.

**No new motion.** Nothing here animates beyond the existing link hover colour
transition and the button `active:scale`, so **no row is added to
`design-system.md` §3**. Do not add a GSAP tween, a `Reveal`, or a transition on
the row list.

**Accessibility, from §8.2 rules 4-6:** both actions announce through a
`role="status"` node that stays mounted; the message reads without colour; the
`Remove` control is a two-step confirm in markup exactly as
`DeleteGenerationButton` does it, moving focus to the confirm and back to the
opener on cancel; `Restore` is one press, because it is not destructive.

The client leaf for the row actions goes in
`components/app/LibraryRowActions.tsx`, using `useActionState` and
`useFormStatus` as the existing leaves do. **No new colour for a destructive
control** - two accents stay locked, the words carry the weight
(`design-system.md` §6.2, and the precedent at
`components/app/DeleteGenerationButton.tsx:18-22`).

## The rest of the surface

- `app/(app)/layout.tsx` - a `Library` link between `Generate` and `Account`, in
  the existing nav treatment. No other change to the shell.
- `components/app/GeneratorWorkspace.tsx` - the history section becomes
  `Recent images`, shows the 6 it is given, and ends with a link to `/library`.
  The card markup itself (image box, two-line caption, hover transition) does
  not change. The generator form, the controls, the result slots, the pending
  overlay and the status line are **untouched**.
- `app/(app)/generate/page.tsx` - asks for 6 instead of 24.
- `proxy.ts` - `/library(.*)` in `isProtectedRoute`, `/library/:path*` in
  `config.matcher`.

## Non-goals

Deliberately out of scope, each with its reason:

- **No `collection` table.** §9.1 admits one "if the library needs it". Search
  and pagination do not need it, and an unused table is dead weight.
- **No sharing, no publish toggle, no public view of a library row.** That is
  step 8, and it also owns the Blob-pathname-carries-the-owner-id gap.
- **No quota or usage reading here.** Step 9.
- **No export, no account deletion, no blob purge on soft delete.** Step 11.
  The Blob object of a removed row survives on purpose, which is exactly what
  makes restore possible, and it is why removal is called `Remove` in the UI and
  never `Delete`.
- **No auto-purge cron for removed rows.** That is a retention policy, which is
  a decision, not an implementation detail.
- **No bulk selection, no infinite scroll, no client-side fetching, no
  optimistic list mutation.** Server Components read, Server Actions mutate
  (§6.2).
- **No new provider, package, token, radius, colour, z-index level or motion
  row.**
- **No change to any marketing route, to `components/sections/`,
  `components/motion/`, `components/brand/`, or `app/globals.css`.**

## Files

**Create**

- `lib/validation/library.ts` - the search, page and view schema. Not
  `server-only`, deliberately, and it imports nothing from `lib/db/` (§6.3).
- `app/(app)/library/page.tsx`
- `app/(app)/library/actions.ts`
- `components/app/LibraryRowActions.tsx`
- one migration under `drizzle/`, generated not hand-written.

**Modify**

- `lib/db/schema.ts`, `lib/db/queries.ts`
- `app/(app)/g/[id]/actions.ts` (the two bits named above, nothing else)
- `app/(app)/generate/page.tsx`, `components/app/GeneratorWorkspace.tsx`
- `app/(app)/layout.tsx`, `proxy.ts`
- `docs/backend.md`, `design-system.md` (a new §2.12), `AGENTS.md` (**one index
  row only, if any** - the cap rule; no build-record text)
- `docs/automation.md`, only if a step gets worked out a second time (§3)

**Must not touch**

- `app/(marketing)/**`, `components/sections/**`, `components/motion/**`,
  `components/brand/**`, `app/globals.css`, `lib/z.ts`
- `lib/ai/**`, `lib/storage/**` - there is no model call and no blob write here
- `app/(app)/generate/actions.ts` - the generate path does not change
- `components/ui/PromptField.tsx`, `components/app/GenerationControls.tsx`,
  `components/app/DeleteGenerationButton.tsx`

## Checks, and where each result is recorded

Run them, quote the real output, and never claim one passed without it (§2,
§12 rule 3).

1. `npm run lint`
2. `npm run build`
3. **Route table diff** - `docs/automation.md` §"Compare a build's route table
   across a change". Expect exactly one added row, `/library`, dynamic.
4. **Landing page HTML identity** - `docs/automation.md` §"Prove the landing
   page's output did not change". `IDENTICAL` is the required answer.
5. **Environment-absent build** - `docs/automation.md` §"Prove an environment
   read is lazy". Confirm `.env.local` is back afterwards.
6. **Client bundle secret scan** - `docs/automation.md` §"Check a secret never
   reached the browser", for `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`,
   `CLERK_SECRET_KEY`, `CLOUDFLARE_API_TOKEN`. The known `CLERK_SECRET_KEY`
   name-only hit is settled by the value search already documented there.
7. **Schema verification** - the read-only script in `docs/automation.md`
   against `information_schema.columns` and `pg_indexes`.
8. **Behaviour, by hand on `npm run dev`**: remove an image and confirm it
   leaves `/library`, `/generate`, `/account`'s count and `/g/[id]`; restore it
   and confirm it comes back everywhere; remove a **public** image and confirm
   it leaves `/`; search for a term that matches and one that does not; search
   for a literal `%` and confirm it does not match everything; page past 20 rows
   if the account has them, and say plainly if it does not; permanently delete a
   removed row from the Removed view and confirm it returns to `/library`.
9. **Ownership** - a second account must not see or act on the first's rows.
   `docs/backend.md` records that the two-account check could not be run in
   prompt 016 and what was run instead. **Attempt it; if it is still not
   possible, say so explicitly and run the same substitute**, rather than
   claiming a verification that did not happen (§12 rule 9).

**Recording (§8.5).** The schema change, the migration's contents, the new
queries and their filters, the two actions, the `returnTo` closed list, the
quota-count exception, and every measurement go in **`docs/backend.md`**. The
ledger layout family, the row anatomy, the search and pagination treatment, the
recent-strip change to §2.8 and the confirmation that no §3 row was added go in
**`design-system.md` as a new §2.12**. Nothing but at most one index row goes in
`AGENTS.md`.

Then commit to `main`, unpushed (§1 step 11).

## SKILLS USED

Invoke each of these at execution time, before writing code (§1 step 8). Listing
is not loading.

- **`vercel:nextjs`** - `searchParams` as a Promise, dynamic rendering, Server
  Component vs Server Action boundaries, `not-found`, and the Next 16 `proxy.ts`
  convention.
- **`neon-postgres`** - pooled `DATABASE_URL` for the app and direct
  `DATABASE_URL_UNPOOLED` for the migration, scale-to-zero when timing anything.
- **`vercel-react-best-practices`** - keeping the new client leaf small, no
  client-side fetching, no unnecessary state.
- **`design-taste-frontend`** - the ledger family has to read as deliberate and
  not as a default table; the anti-slop pass applies with `design-system.md`
  overriding it wherever the two disagree (`design-system.md` front matter).
- **`web-design-guidelines`** - the form, the focus management, the two-step
  confirm, and the announced results.
- **`vercel:vercel-cli`** - only if a provisioning state needs reading back;
  nothing here provisions anything.

**Skills `AGENTS.md` §1 step 2 names that are not available in this session, and
this must not be papered over:** there is **no `drizzle-docs`, no `zod-docs` and
no `tailwind-4-docs`** in the skill listing. Those three surfaces are therefore
verified against `node_modules/` directly - `drizzle-orm` 0.45.2 for `ilike`,
`isNull`, `.limit()`/`.offset()` and the `pg-core` column builders, `zod` 4.4.3
for schema APIs, and `app/globals.css` for every Tailwind 4 token - and any API
that cannot be verified there is reported as unverified rather than written from
memory (§12 rule 2).
