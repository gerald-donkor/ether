# 018 - Sharing and the community showcase

## Scope, and why it is next

**Build step 8, sharing and the community showcase**: make a generation
shareable from its permalink, replace the static `/community` threshold page
with a real showcase of opted-in work, migrate visibility from a boolean to the
contracted `private | unlisted | public` lifecycle, and remove the Clerk owner
id from every generation Blob pathname.

It is next because phase one and steps 5 through 7 are committed, and step 8 is
the next unbuilt row of `AGENTS.md` §5.2. This was resolved from the repository
and `git log`, not from the existence of prompt files:

- step 1 - `a367b09` builds the backend foundation and generator app;
- step 2 - `4c5b9f7` adds the four marketing navigation routes;
- step 3 - `2389ddf` adds the seven footer routes;
- step 4 - `2b612af` backs the landing gallery with public generations;
- step 5 - `8ed5482` and `754ddbf` add and stabilize generation controls;
- step 6 - `813c477` adds `/g/[id]` and permanent deletion;
- step 7 - `ed8e75b` adds `/library`, search, paging, removal and restore.

Step 8 depends on steps 4 and 6. Both exist. It is also the first step that can
resolve the privacy gap recorded in `docs/backend.md`: a current Blob pathname
contains the owner's Clerk id even when the query projection omits that column.

This prompt makes the visibility states mean exactly this:

| state | owner | anyone with the exact `/g/[id]` link | `/community` and `/` |
| --- | --- | --- | --- |
| `private` | full record and controls | 404 | absent |
| `unlisted` | full record and controls | image record, without prompt or owner | absent |
| `public` | full record and controls | image record, without prompt or owner | present |

The prompt remains private in every anonymous view. The existing generation
checkbox explicitly promises, `Your prompt stays private.` Step 8 must not
reinterpret image-publication consent as prompt-publication consent.

## Reference material read for this prompt

Read before this file was written:

- `AGENTS.md` - §1 workflow, §4 prompt contract, §5.2 build sequence, §6
  boundaries and file layout, §7.3 provider traps, §8 standing backend rules,
  §9 data model, §10 write path, §11 roles and §12 anti-fabrication rules.
- `design-system.md` - §1 foundations, §2.6 gallery strip, §2.8 application
  shell, §2.9 current community threshold, §2.11 artefact record, §2.12
  library, §3 motion, §5 skill constraints and §6 non-negotiables.
- `docs/backend.md` - the full schema and index record, public-gallery privacy
  boundary and known Blob-path gap, publication consent, permalink, library,
  storage, auth, environment and verification record.
- `docs/automation.md` - direct read-only database checks, route-table
  comparison, environment-absent build, landing HTML comparison and client
  secret scan.
- `app/(marketing)/community/page.tsx`, `app/(marketing)/layout.tsx`,
  `app/(app)/layout.tsx`, `app/(app)/g/[id]/page.tsx`,
  `app/(app)/g/[id]/actions.ts`, `app/(app)/generate/actions.ts`,
  `app/(app)/library/page.tsx`, `app/(app)/library/actions.ts`, `proxy.ts`.
- `components/ui/PromptField.tsx`, `components/app/GeneratorWorkspace.tsx`,
  `components/app/DeleteGenerationButton.tsx`,
  `components/app/LibraryRowActions.tsx`, `components/sections/Gallery.tsx`.
- `lib/db/schema.ts`, `lib/db/queries.ts`, `lib/storage/generations.ts`,
  `lib/validation/generation.ts`, `lib/auth/index.ts`, `lib/ai/catalog.ts`.
- `drizzle.config.ts`, `package.json`, and the committed migrations under
  `drizzle/`.

APIs verified from installed packages this session, rather than recalled:

- Next 16.3 Server Actions support `updateTag` for immediate tag expiry and
  `revalidatePath` for path invalidation at
  `node_modules/next/dist/docs/01-app/02-guides/server-actions.md:137-152`.
- `auth()` is asynchronous, may return no `userId`, and requires
  `clerkMiddleware`, at
  `node_modules/@clerk/nextjs/dist/types/app-router/server/auth.d.ts`.
- Drizzle 0.45.2 exports `pgEnum(name, values)` at
  `node_modules/drizzle-orm/pg-core/columns/enum.d.ts:82`.
- Vercel Blob 2.8.0 exports `rename(fromUrlOrPathname, toPathname, options)`;
  it copies to the new pathname and deletes the source only after the copy
  succeeds, and returns the new `url`, at
  `node_modules/@vercel/blob/dist/index.d.ts:347-378`.
- `drizzle-kit migrate` exists in the installed 0.31.10 CLI; its available
  flag is `--config`, verified with
  `node_modules/.bin/drizzle-kit migrate --help`.
- Installed versions are Next 16.3.0, React 19.2.8, Clerk 7.7.4, Drizzle ORM
  0.45.2, Drizzle Kit 0.31.10, Zod 4.4.3 and Vercel Blob 2.8.0.

No listed skill covers this project's Next.js 16.3, Tailwind CSS 4, Drizzle,
Zod, Clerk or Vercel Blob surfaces. The implementation must therefore re-read
the relevant installed package docs, declarations and source before using an
API, exactly as `AGENTS.md` §12 rule 2 requires. Do not substitute remembered
tutorial syntax.

## Design read and measurements

Reading this as a public exhibition index for working creatives, in Ether's
existing dark studio-console language. It is an extension of a measured system,
not a redesign. The design dials are **variance 7, motion 2, density 4**: the
showcase needs an asymmetric composition distinct from the landing strip, but
the work itself is the visual and no new ambient motion is justified.

No colour, radius, font, breakpoint or spacing token is invented:

- use only `--ink`, `--surface`, `--surface-2`, `--line`, `--violet`, `--lime`,
  `--text`, `--text-2` and `--text-3` through existing Tailwind tokens;
- violet identifies and lime acts. A save control may be lime with ink text.
  A visibility label is never a lime badge because it is not itself an action;
- use `--r-card` for generated-image frames, `--r-panel` for the artefact image
  panel, and `--r-pill` for controls. `/community` does not claim the gallery's
  `--r-none` exception;
- use `Container` and the existing `--container` width;
- use the existing `clamp(40px,6vw,60px)` community H1 role,
  `clamp(28px,5vw,40px)` artefact H1 role, 15px on 26px body role and 13px on
  22px metadata role;
- use the 4px spacing scale already recorded in `design-system.md`;
- no image is `priority`. The macaw remains the only priority image on the
  site. Every generated image supplies its stored ratio and a correct `sizes`;
- no raw hex enters a component file and `lib/z.ts` is unchanged.

The `/community` layout is a **staggered proof sheet**, not a card grid, a
marquee, a second landing gallery or an image-and-text split. A 12-column
desktop grid places uncropped generated images in alternating wide and narrow
spans with deliberate empty space; below `md` it becomes one strict column.
The 12 columns are a layout grid, not a user-facing statistic. The exact span
sequence must be written once at module scope and judged in screenshots at
390px, 768px and 1440px before it is recorded in `design-system.md`. Do not
eyeball additional pixel values into the component. Each image keeps its stored
aspect ratio, carries the generic consent-safe alt text already used by the
landing gallery, links to `/g/<id>`, and may show only real stored metadata such
as its creation date beneath it. No prompt, owner, fabricated caption, badge or
number appears.

The showcase reads at most **12** newest public live rows. This is an explicit
operational choice, not an artboard measurement and not visible copy: it gives
the proof-sheet span sequence one complete pass and bounds a public database
read. There is no pagination, infinite scroll, total count or claim that these
are all public generations. Adding any of those would broaden step 8.

The existing `/community` artboard photograph and threshold panel are removed
from that route. They were an honest placeholder for the future showcase and
must not remain above or below the real work as filler. The empty state is
plain and actionable: it says there is no public work to show yet and links to
`/generate`. It invents no counts, creators, moderation or curation claim.

No new motion ships. The page uses existing link colour transitions and button
`active:scale` only, so `design-system.md` §3 receives no row.

## Render impact

- **`/community` - deliberately replaced.** Its static threshold composition
  becomes the real cached public proof sheet. The route remains public and must
  build without environment variables by returning the factual empty state
  when the database is unavailable. Record the actual route-table symbol after
  the build rather than predicting it.
- **`/g/[id]` - deliberately changes its access and layout ownership.** It
  moves out of the authenticated `(app)` layout into a small public generation
  shell. The URL stays identical. It remains dynamic. Owners see the current
  full record and controls. Anonymous users and signed-in non-owners see only
  shareable image fields for `unlisted` or `public`; a private or removed row is
  404. The prompt and owner id never enter the public projection or metadata.
- **`/generate` - small deliberate UI and data-shape change.** Its publication
  checkbox now means `visibility = public` rather than `is_public = true`, and
  its copy names both the home gallery and Community while retaining `Your
  prompt stays private.` The landing page's inert `PromptField` output must be
  byte-identical because it passes no publication option.
- **`/library` - small deliberate label and mutation-shape change.** Active
  rows report `Private`, `Unlisted` or `Public` from the enum. Search, paging,
  removal, restore and permanent delete keep their behaviour and layout.
- **`/account` - no visible or render-mode change.** Its owner count still
  excludes removed rows.
- **`/` - same composition and render mode, with an approved data-only URL
  change.** Public selection changes from `is_public = true` to
  `visibility = 'public'`. Existing public Blob URLs change once to remove the
  Clerk owner id; this changes generated `src`/`srcset` values but no layout,
  copy, fallback asset, ordering, slot, animation or component markup. With an
  empty public table, the normalized prerendered HTML must remain identical.
  With real public rows, compare the structure after accounting only for the
  expected old-to-new Blob URL mapping and stop on any other difference.
- **Every other route - unchanged.** Verify the route table rather than
  assuming it.

This prompt is the up-front approval for the `/community`, `/g/[id]`,
`/generate`, `/library`, and public-image URL changes above. It does not permit
restyling the landing page or any settled section.

## Trust boundary

Four request paths matter.

1. **`/g/[id]` read.** The route segment is hostile input. Await `params`, parse
   `id` with the existing `generationIdSchema`, and return `notFound()` on a
   failed parse. Read the Clerk session optionally with `auth()`. If a user id
   exists, first attempt the owner-filtered live-row query. If no owned row is
   found, use a separate anonymous projection that matches the id, requires
   `deleted_at IS NULL`, and accepts only `unlisted` or `public`. That projection
   selects only `id`, `image_url`, `model`, `width`, `height`, `visibility` and
   `created_at`. It must not select `user_id` or `prompt`. A private, removed,
   missing or malformed row returns the same 404.
2. **Change visibility.** A Server Action receives exactly `generationId` and
   `visibility`. It reads the owner from Clerk on the server, parses both fields
   through the shared Zod schema, and performs an owner-filtered update guarded
   by `deleted_at IS NULL`. A missing id and another owner's id return the same
   `That image could not be found.` result. There is no quota check because this
   spends no model money. It returns a discriminated result, revalidates the
   owner surfaces and `/g/<id>`, and expires the public-generation cache plus
   `/` and `/community` after every successful change. The unconditional public
   invalidation is intentionally simpler and safer than attempting to infer the
   previous visibility outside one owner-filtered write.
3. **Copy share link.** This is a client-only interaction and sends no request.
   It exists only for `unlisted` and `public`. Copy the current canonical
   `/g/<id>` URL with feature detection, announce success or failure through a
   mounted `role="status"`, and keep the link itself available as an ordinary
   anchor when clipboard access is unavailable. Do not expose a link for a
   private row.
4. **Public community read.** It accepts no browser parameters. It selects the
   bounded newest public rows through `lib/db/queries.ts`, with a projection
   that excludes `user_id` and `prompt`. A database failure returns the empty
   state and logs one fixed string with no row data.

Every mutation authorises inside the action. `proxy.ts` no longer protects
`/g`, because shareability is decided by the row query, not by a route-wide
redirect. `/generate`, `/account` and `/library` remain the only proxy-protected
paths and continue to enforce their own sessions.

## Secrets and data

- **No new environment variable.** The existing server-only
  `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `BLOB_READ_WRITE_TOKEN` are used.
  No new `NEXT_PUBLIC_*` name is added.
- **Schema data changes.** `is_public boolean` is replaced by
  `visibility generation_visibility`, whose closed values are `private`,
  `unlisted`, `public`. Existing false rows become private and existing true
  rows become public. The default is private. Removed rows retain their
  visibility but remain absent from every live/public read.
- **Stored Blob paths change.** Future images use
  `generations/<generation-uuid>.<jpg|png>`, never a Clerk id. Existing rows are
  moved once to the same form and their `image_url` is updated. The UUID is
  already the unguessable route identifier and is not an invented owner field.
- **Anonymous transmission.** A public or unlisted image transmits its image
  URL, model id, stored dimensions, visibility and creation time. It never
  transmits the owner id or prompt. Only public rows reach `/community` and `/`.
- **Logging.** No prompt, owner id, old Blob URL, new Blob URL, request body or
  search value is logged. Migration output is aggregate counts only. Existing
  error redaction remains in permanent deletion.
- **Provider traffic.** No model call is added. Blob `rename` is used only for
  the one-time pathname migration; ordinary visibility changes do not copy or
  move image bytes.

## Visibility as one closed definition

Create one pure, client-safe visibility registry under `lib/generations/`:

```ts
export const GENERATION_VISIBILITIES = [
  "private",
  "unlisted",
  "public",
] as const;

export type GenerationVisibility =
  (typeof GENERATION_VISIBILITIES)[number];
```

It imports nothing and reads no environment variable. Drizzle, Zod, actions and
UI import this tuple/type rather than redeclaring string unions. This is the
single definition `AGENTS.md` §9 rule 3 requires.

`lib/validation/visibility.ts` builds the Zod schema from that tuple and exports
the `visibility` field name. It is deliberately not `server-only` because the
client leaf and action share it. Validate the generation id with the existing
schema rather than redefining UUID validation.

The generate request may retain the browser field name `publish` and literal
`public`, because it is an unchecked-by-default binary convenience at creation:
checked creates public, absent creates private. `unlisted` is selected later on
the artefact record. The parsed result must become a visibility value rather
than a boolean. Do not let three lifecycle states leak back into another
boolean.

## Database migration

In `lib/db/schema.ts`:

- declare a PostgreSQL enum named `generation_visibility` from the one shared
  tuple;
- replace `isPublic` / `is_public` with `visibility` / `visibility`, not null,
  default `private`;
- replace `generations_public_created_at_idx` with
  `generations_visibility_created_at_idx` on
  `(visibility, created_at desc)`;
- leave `deleted_at` and the owner indexes unchanged.

Generate one migration with `npm run db:generate`, then read it in full. A
generated drop-and-add migration is not safe by itself because it would erase
the existing consent state. The committed migration must perform this ordered
data-preserving transition:

1. create `generation_visibility` with the three closed values;
2. add `visibility` as non-null with default `private`;
3. update rows whose old `is_public` is true to `public`;
4. drop the old public index;
5. drop `is_public`;
6. add `generations_visibility_created_at_idx`.

Do not use `db:push` for this transformation. Apply the reviewed committed
migration with:

```bash
dotenv -e .env.local -- drizzle-kit migrate
```

The direct `DATABASE_URL_UNPOOLED` comes from `drizzle.config.ts`. Before and
after applying it, run aggregate-only read checks that print no prompt, owner or
URL: total rows, old true/false counts before, new visibility counts after,
column type/default/nullability, enum labels, and index names. The before and
after totals and boolean-to-enum counts must reconcile exactly.

## Opaque Blob pathname migration

Future writes allocate `crypto.randomUUID()` before storing bytes, pass that id
to `storeGenerationImage`, and insert the same id into the row. The storage
helper accepts `generationId`, not `userId`, and writes
`generations/<generationId>.<extension>`. The action's existing per-image
cleanup and partial-success behaviour remain unchanged.

Existing rows require a one-time migration after the enum migration and before
the public route is verified. Implement it as a temporary, rerunnable module
inside `lib/db/` so SQL never leaves the data layer. Create it with
`apply_patch`, execute it with `.env.local` and React Server conditions as
documented in `docs/automation.md`, and delete it with `apply_patch` before the
final commit.

For each row, without printing its id or URL:

1. skip a pathname already in canonical `generations/<row-id>.<ext>` form;
2. accept only the stored `.jpg` or `.png` extension. Stop on anything else;
3. call verified Blob `rename(oldUrl, canonicalPath, { access: "public",
   addRandomSuffix: false })`. Do not allow overwrite; a collision is a stop,
   not permission to replace an object;
4. update `image_url` with a compare-and-set condition on row id and the old
   URL, and require exactly one returned row;
5. if the database update fails, attempt to rename the new object back to the
   old pathname, then stop and report both outcomes without printing either
   URL;
6. output only `{ scanned, moved, skipped, failed }` aggregate counts.

Afterwards, query aggregate counts proving every `image_url` pathname is in the
canonical id-based form and that zero URLs contain their row's `user_id`. Use
Blob `head` on the migrated objects without printing URLs and confirm the old
objects return not found. A partial or unverifiable migration blocks the step;
do not ship public sharing around it.

## Query layer and cache

All SQL remains in `lib/db/queries.ts`.

Mechanical enum replacements:

- every `isPublic` projection and return value becomes `visibility`;
- `listPublicGenerations` filters `visibility = 'public'` and
  `deleted_at IS NULL`;
- gallery invalidation checks become `visibility === 'public'`;
- `/library` and `/g/[id]` render the three-state label instead of converting a
  boolean to two labels;
- recent-count quota logic remains independent of visibility and still counts
  removed rows.

Add these reads/writes:

- `getShareableGeneration(id)` - live row, id match, visibility in the closed
  `unlisted | public` subset, anonymous projection only. No prompt and no owner.
- `listCommunityGenerations(limit)` - newest live `public` rows, bounded by the
  caller, selecting only the image fields, id and creation time needed by the
  proof sheet. No prompt, owner or model unless the UI actually renders the
  model. Do not select a field speculatively.
- `setGenerationVisibilityForOwner(id, userId, visibility)` - an update guarded
  by id, owner and `deleted_at IS NULL`, returning id and the new visibility.

Rename the too-narrow cache vocabulary from `PUBLIC_GALLERY_TAG` to
`PUBLIC_GENERATIONS_TAG`. The landing gallery and Community may have separate
cached read functions, but both carry that one tag because every successful
public visibility mutation affects both surfaces. Keep failure handling outside
the cached functions so an outage is never cached. Do not add polling or a time
revalidation interval.

## `/g/[id]`, owner controls and the public projection

Move the route from `app/(app)/g/[id]/` to `app/(generation)/g/[id]/`; route
groups do not change the URL. Add `app/(generation)/layout.tsx` as a compact
public generation shell using the existing wordmark, `Container`, focus ring,
radius and z-index scale. It does not call `requireUserId`. It provides a skip
link, a one-line header, a link to Community and a link to Generate. Signed-in
identity UI may render only through Clerk's installed components and must be
checked signed out rather than assumed.

The page reads optional auth, then follows the trust-boundary order above. Keep
the current image-led artefact family, 880px cap, stored-ratio reservation,
definition-list treatment and no-priority rule.

For the owner:

- retain `Back to your images`, image, prompt, model, size, created, download
  and permanent delete;
- replace the boolean visibility line with the exact enum label;
- add one native labelled visibility select and `Save visibility` control;
- explain the three choices in plain text and repeat that the prompt stays
  private;
- show an ordinary `/g/<id>` anchor plus `Copy link` only for unlisted/public;
- render action success/failure in a mounted `role="status"`, focus the result,
  and keep the message legible without colour.

For an anonymous or signed-in non-owner viewer:

- render the image, model label, size, created date, and whether it is unlisted
  or public;
- never render the prompt, owner controls, delete, visibility mutation or a
  back link into the owner's library;
- offer the existing cross-origin-safe Download link;
- use static metadata. No prompt, owner, model id or generated-image URL enters
  the document title or description.

`GenerationVisibilityControls.tsx` is the only new client mutation leaf. Keep
the copy-link interaction in the same leaf unless separating it materially
reduces client code. Use `useActionState` and `useFormStatus`, native controls,
and no client-side data fetching. No browser alert or confirm dialog.

The existing permanent-delete action moves with the route. Its blob-before-row
ordering, redaction, return-path closed list and redirect argument remain
unchanged. Only enum-based public cache invalidation and import paths change.

## `/community`

Keep the marketing shell. Replace only
`app/(marketing)/community/page.tsx`; do not change `Nav`, `Footer` or another
marketing route.

The route is an async Server Component and renders:

1. the existing Community H1 role with plain copy stating that only images
   owners made public appear, and prompts remain private;
2. the staggered proof sheet of up to 12 real public rows;
3. a factual empty state and one Generate action when there are no rows.

Every image is `next/image`, uses its stored width and height to reserve space,
sets responsive `sizes`, is not priority, and links to `/g/<id>`. Use the same
generic public-image alt contract as the landing gallery. Do not invent creator
names, prompts, categories, likes, counts, rankings, curation, moderation or
engagement controls. No new image asset is generated or committed: real user
generations are the content and the empty state needs no decorative stock.

## Generate, library, remove, restore and delete

- `components/ui/PromptField.tsx`: only the real `/generate` opt-in copy changes
  to say the image can appear on the home page and in Community, and that the
  prompt stays private. The inert landing instance must render exactly the same
  markup as before.
- `app/(app)/generate/actions.ts`: create the row UUID before Blob storage,
  write the opaque path, store enum visibility, and expire both public surfaces
  after a public write. Keep auth, validation, quota order, serial generation,
  partial success, failure messages, logging and cleanup unchanged.
- `components/app/GeneratorWorkspace.tsx`: replace its result boolean with the
  visibility value and keep the status message truthful. Do not change form
  reset handling, slots, controls or history layout.
- `/library`: render the enum label. Its row layout and all search/paging
  behaviour remain unchanged.
- remove, restore and permanent delete: return/check `visibility === 'public'`
  for public cache expiry. They do not change visibility themselves. A removed
  public row keeps `public` in storage so restore returns it to Community; this
  is existing restore behaviour translated from the boolean, not a new side
  effect.

## Accessibility and interaction states

- The visibility select has a real label and explanatory text linked with
  `aria-describedby`.
- Save and Copy link have pending/success/failure states. Copy failure leaves
  the ordinary link usable.
- Every result is announced through a mounted live region and remains legible
  without colour.
- Every link, select and button receives the global 2px lime focus ring at 2px
  offset. Verify third-party signed-in/signed-out header states rather than
  assuming them.
- Button labels do not wrap at desktop, button text on lime is ink, and no
  destructive control introduces a new colour.
- No animation is added, so reduced motion needs no new branch.

## Non-goals

- No public prompt, owner profile, username, avatar, email or creator page. The
  existing consent covers the image only.
- No likes, follows, comments, ranking, trending score, view count, report
  button, moderation claim or admin surface. Moderation and reporting are step
  10.
- No pagination, filtering, search, categories or infinite scrolling on
  Community.
- No quota or Upstash work. That is step 9.
- No new provider, model call, upload surface, package, environment variable,
  token, radius, colour, z-index level or motion row.
- No custom Open Graph image or dynamic metadata containing user content.
- No change to the landing gallery's composition, fallback assets, motion,
  data tile, column order, seams or copy.
- No change to `components/motion/**`, `components/brand/**`, `Nav`, `Footer`,
  `app/globals.css` or `lib/z.ts`.
- No stock image and no generated site asset. The proof sheet is either real
  opted-in work or an honest empty state.

## Files

**Create**

- `lib/generations/visibility.ts` - pure tuple and type, the one visibility
  definition.
- `lib/validation/visibility.ts` - shared Zod schema and field name.
- `components/app/GenerationVisibilityControls.tsx` - visibility mutation and
  share-link client leaf.
- `app/(generation)/layout.tsx` - public generation shell.
- one generated and reviewed migration under `drizzle/`.
- a temporary migration module under `lib/db/` for the one-time Blob rename;
  delete it before commit.

**Move**

- `app/(app)/g/[id]/page.tsx` to `app/(generation)/g/[id]/page.tsx`.
- `app/(app)/g/[id]/actions.ts` to
  `app/(generation)/g/[id]/actions.ts`.

**Modify**

- `app/(marketing)/community/page.tsx`
- `app/(app)/generate/actions.ts`
- `app/(app)/library/actions.ts`
- `app/(app)/library/page.tsx`
- `components/ui/PromptField.tsx`
- `components/app/GeneratorWorkspace.tsx`
- `components/app/DeleteGenerationButton.tsx` and
  `components/app/LibraryRowActions.tsx` only for the moved action import and
  enum return shape
- `lib/db/schema.ts`, `lib/db/queries.ts`
- `lib/storage/generations.ts`
- `lib/validation/generation.ts`
- `proxy.ts`
- `docs/backend.md`
- `design-system.md`, adding the built Community proof sheet and shared
  artefact states, with no new §3 row
- `docs/automation.md`, because the cross-owner query-boundary check was first
  attempted in prompt 016 and this is the second worked-out occurrence
- `AGENTS.md` only if an existing contract line is stale and must be replaced.
  Do not add build-record prose or tick the sequence.

**Delete**

- the old `app/(app)/g/[id]/` paths after the move;
- the temporary Blob migration module after it succeeds and is verified.

**Must not touch**

- `app/(marketing)/page.tsx`
- every marketing route except `/community`
- `components/sections/**`, `components/motion/**`, `components/brand/**`
- `app/globals.css`, `lib/z.ts`, `lib/ai/**`
- reference artboard files and `public/assets/ui/**`
- any installed package or package version.

If implementation discovers that one named file must change to keep a typed
enum shape coherent, stop and explain the exact dependency before broadening
the file list. Do not use a mechanical repository-wide replacement without
reading each hit.

## Checks, and where each result is recorded

Run and quote exact output. A check that cannot run is recorded as not run with
the precise reason.

1. **Static checks**

   ```bash
   npm run lint
   node_modules/.bin/tsc --noEmit
   npm run build
   ```

   There is still no typecheck script, so invoke `tsc` directly and do not add a
   script merely to make this list look complete.

2. **Schema and migration**

   - read the generated SQL before applying it;
   - apply with `dotenv -e .env.local -- drizzle-kit migrate`;
   - use the read-only pattern in `docs/automation.md` to print aggregate
     before/after row and visibility counts, enum labels, column properties and
     indexes;
   - prove false mapped to private, true mapped to public, row totals did not
     change, `is_public` is gone, and the visibility index exists;
   - print no prompt, owner id or Blob URL.

3. **Blob pathname migration**

   - run the temporary migration and quote only its aggregate result;
   - prove every stored URL is canonical and zero contain their row owner id;
   - confirm new objects exist and old objects do not without printing URLs;
   - rerun once and require every row to be skipped with zero moved and zero
     failed, proving idempotence;
   - delete the temporary module before the final build and commit.

4. **Visibility and query boundary**

   Use isolated synthetic rows and a temporary Blob object, then clean up both
   even if an assertion fails. Do not mutate a person's real generation merely
   to satisfy a check.

   Verify:

   - owner lookup returns the full live row;
   - another owner cannot receive it through the owner query;
   - anonymous projection returns public and unlisted rows but not private or
     removed rows;
   - anonymous projections have no `prompt` or `userId` key;
   - Community returns only live public rows, newest first, at its exact limit;
   - private to unlisted to public to private transitions are owner-filtered;
   - the wrong owner update is a no-op;
   - cleanup deletes the synthetic row and Blob.

   This is the second worked-out cross-owner query check after prompt 016, so
   add the reusable, privacy-safe procedure to `docs/automation.md` in this
   change.

5. **Route and browser checks**

   - anonymous private `/g/<id>` is 404;
   - anonymous unlisted and public `/g/<id>` are 200;
   - signed-in owner sees prompt and controls;
   - anonymous and signed-in non-owner HTML contain neither prompt nor owner id;
   - unlisted never appears in `/community` or `/`;
   - public appears in `/community` and is linked to its `/g/<id>` record;
   - visibility mutation announces its result and refreshes all affected
     surfaces;
   - Copy link announces success; when clipboard access is unavailable, the
     ordinary link remains usable;
   - keyboard traversal shows the lime focus ring at every stop;
   - inspect `/community` at 390px, 768px and 1440px. Images remain uncropped,
     no horizontal overflow appears, the desktop proof-sheet asymmetry is
     intentional, and mobile is one column;
   - verify the landing gallery motion, logo marquee and all settled landing
     motion still run. No new motion exists on Community or the artefact.

6. **Route table, landing output and absent environment**

   Follow `docs/automation.md` exactly.

   - Compare route tables. `/g/[id]` keeps its URL and dynamic symbol;
     `/community`'s actual symbol is recorded. No unrelated route changes.
   - With no public database rows, the normalized landing prerendered HTML is
     byte-identical.
   - With a public row, inspect the raw diff and allow only the expected opaque
     Blob URL replacement. Any structural, copy, asset, ordering or motion
     difference is a failure.
   - Move `.env.local` aside, run the production build, restore it even on
     failure, and confirm it exists afterwards.

7. **Secrets and privacy scan**

   Search `.next/static/` for the exact variable names and, where available,
   their values according to `docs/automation.md`. Zero secret-value hits are
   required. Search rendered anonymous `/community` and `/g/<id>` output for
   the synthetic prompt and owner id; both must return zero.

8. **Copy audit**

   Read every new visible string. Require zero em-dashes, zero invented
   numbers, no exclamation marks, no hype, and no statement that Ether curates,
   moderates or identifies creators.

9. **Record and commit**

   - `docs/backend.md`: enum and migration SQL, mappings, query projections,
     action fields, cache invalidation, Blob pathname migration, access states,
     real verification output and anything not run.
   - `design-system.md`: the measured Community proof-sheet layout and shared
     artefact owner/viewer states. Do not add a motion row.
   - `docs/automation.md`: the now-repeated cross-owner query procedure.
   - `AGENTS.md`: replace only stale contract text if necessary; no progress
     diary and no completed checkbox.
   - `git diff --check`, inspect `git diff --stat`, then commit the complete
     prompt and implementation to `main`. Do not push.

## SKILLS USED

- `design-taste-frontend` - preserve Ether's established brand system, set the
  design read and dials, and keep Community out of generic card-grid patterns.
- `frontend-design` - make the public proof sheet a deliberate new layout
  family whose real images, hierarchy and copy serve working creatives.
- `vercel-react-best-practices` - keep the database reads in Server Components,
  isolate the visibility interaction as a small client leaf, avoid waterfalls
  and prevent unnecessary client serialization.
- `neon` - apply the provider's current backend and branch-aware operating
  guidance before touching Lakebase Postgres.
- `neon-postgres` - use the direct connection for the reviewed migration,
  preserve schema history in Drizzle, and verify the enum/index transition
  against the database.
