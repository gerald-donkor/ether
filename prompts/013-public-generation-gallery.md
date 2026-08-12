# 013 - Back the gallery strip with opt-in public generations

Steps 1 through 3 of phase one are committed. The remaining phase-one step is
the gallery strip backed by real generations. It is next because phase two may
not begin while a phase-one step remains unbuilt, and because the existing
`/community` route still truthfully says that all generations are private and
the public space is closed.

This prompt adds an explicit, private-by-default publication choice to the
existing generation write path, reads the newest opted-in images into the
landing-page gallery, preserves the extracted artboard images as the per-slot
fallback, and updates `/community` to point at that public strip. It does not
build step 8's full community showcase or sharing model.

## Design read

Reading this as a preservation change to a finished product landing page for
working creatives, in Ether's measured dark studio-console language. Match the
existing site's high visual variance, existing ambient motion, and moderate
density. Do not reset those dials from a generic skill preset.

The gallery's edge-to-edge strip and two-axis ambient drift are the signature.
The one aesthetic risk was already taken and documented. This change replaces
eligible image sources without redesigning the composition, inventing another
interaction, or adding motion.

## SKILLS USED

- `design-taste-frontend` - audit and preserve the established gallery family,
  dark theme, token palette, square-corner exception, accessibility, and
  anti-template constraints.
- `frontend-design` - keep the new consent copy and `/community` revision
  specific, plain, and subordinate to the existing visual identity.
- `vercel-react-best-practices` - keep the database read in a Server Component,
  minimize serialized fields and client JavaScript, and avoid request
  waterfalls.
- `neon` - retain the existing Vercel plus Neon architecture and avoid
  provisioning or moving unrelated backend primitives.
- `neon-postgres` - add the Drizzle-owned flag, index, migration, and newest
  public-generation query with the correct pooled runtime and direct migration
  connection boundaries.
- `gsap-core` - preserve the gallery's existing `yPercent` tweens, named
  reduced-motion behavior, durations, directions, and hover pause.
- `gsap-react` - preserve the existing scoped `useGSAP` lifecycle and cleanup;
  no GSAP work may move into a Server Component.
- `gsap-performance` - keep the marquee transform-only and compositor-friendly
  while remote images replace local fallback images.

No dedicated Next.js, Tailwind CSS 4, Drizzle, Zod, or Vercel Blob skill is
available in this session. Before implementation, verify those APIs from the
installed Next.js 16.3 documentation and package source or types named below.
Do not write an API from memory.

## Reference material

Read again before implementation:

- `AGENTS.md` in full, especially the invariants and sections 5 through 12.
- `design-system.md` in full, especially §1.1 color, §1.4 layout, §1.5 shape,
  §2.6 gallery strip, §2.9 marketing information routes, §3 motion, §4 assets,
  §5 skill constraints, and §6 non-negotiables.
- `docs/backend.md` in full, especially the data model, database boundary,
  generation action, storage, route behavior, environment variables, and user
  data sections.
- `public/assets/ui/ref/AI Generator.pdf` and
  `public/assets/ui/ref/AI Generator.svg`, the 1440 by 3392 point reference
  artboard. The strip measurements already derived from them remain binding.
- `components/sections/Gallery.tsx`, `components/motion/ColumnDrift.tsx`,
  `components/ui/PromptField.tsx`, `components/app/GeneratorWorkspace.tsx`,
  `app/(marketing)/page.tsx`, `app/(marketing)/community/page.tsx`,
  `app/(app)/generate/actions.ts`, `app/(app)/generate/page.tsx`,
  `lib/db/schema.ts`, `lib/db/queries.ts`, `lib/db/index.ts`,
  `lib/validation/generation.ts`, `drizzle.config.ts`, `next.config.ts`, and the
  committed files under `drizzle/`.
- Installed Next.js 16.3 documentation:
  `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`,
  `06-fetching-data.md`, `07-mutating-data.md`, `09-revalidating.md`,
  `12-images.md`,
  `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`,
  and the API references for `unstable_cache`, `revalidatePath`, `updateTag`,
  and `next/image`.
- The installed Drizzle ORM and Zod package types for every schema, query,
  index, default, and form-value API used. The existing project patterns are a
  starting point, not a substitute for verification.

Cache Components is not enabled in `next.config.ts`. Do not enable it in this
step. Work with the documented previous caching model that this repository
currently uses.

## Data model and migration

Extend `generations` through Drizzle with one non-null boolean publication flag
mapped to a clear PostgreSQL column name and defaulting to `false`. Existing
rows must migrate as private. A migration must never opt old content into
public display.

Add the index required by the only new public read: publication state followed
by `created_at desc`. Keep the existing owner indexes unchanged. Drizzle owns
the schema and migration exclusively; write no ad hoc SQL outside the generated
migration and no SQL outside `lib/db/`.

Run `npm run db:generate` after the schema edit. Inspect the generated SQL and
metadata before applying it. Use `npm run db:push`, which reads the direct
`DATABASE_URL_UNPOOLED`, for the configured development database. Confirm the
new column, default, nullability, and index with a read-only database query.
Do not provision a new database, storage provider, or environment variable.

Record the exact PostgreSQL type, default, migration filename, index, applied
state, and verification result in `docs/backend.md` after execution.

## Publication consent and write path

Publication is explicit and private by default. Add one unchecked checkbox to
the real `/generate` form only. Its label must say plainly that opting in can
place the generated image in the public gallery. If the prompt will be exposed
anywhere in this step, the label must say that too. Do not render this control
on the inert landing-page `PromptField`.

The control belongs to the existing form, not to a new card or modal. Use the
existing type, spacing, color, and focus tokens. A checked native control may
use lime because it is interactive; text on lime remains ink. It needs a real
label, a visible keyboard focus state, and a pending state that does not erase
or silently change consent. Do not add motion.

Extend the shared Zod request schema so the server accepts only the form's
closed opt-in representation and maps absence to `false`. Do not use permissive
truthiness. The Server Action must re-read the Clerk session, validate prompt
and publication choice together, preserve the existing quota and provider
ordering, and write the validated boolean with the generation row. A client
`userId`, image URL, model id, or publication state outside the validated form
field is never trusted.

The successful action continues to revalidate `/generate`. When and only when
the created generation is public, expire the tagged public-gallery database
read and revalidate `/` using the installed Next.js APIs verified this session.
Do not invalidate the landing route for a private generation.

Keep the result a handled discriminated union. Existing provider, Blob,
database, quota, and cleanup failures remain handled. Do not log the prompt,
publication form payload, Clerk id, image URL, or request body.

## Public gallery query and curation rule

Add one server-only data-layer query for the newest public generations. Its
curation rule is intentionally small and deterministic:

1. include only rows whose validated publication flag is true;
2. order newest first by `created_at desc`;
3. return at most the number of photographic slots in one existing gallery
   pass;
4. select only the fields the strip renders: stable id, Blob URL, width, and
   height. Do not select, serialize, or expose owner id, prompt, model, or any
   other user data;
5. assign results to photographic slots in the existing slot order;
6. fill every unoccupied slot with that slot's current extracted artboard
   image, so zero to four public rows still produce a complete strip.

The `48,000` data tile is not a photographic slot and never comes from the
database. Its copy, position, count, and styling stay unchanged. Do not add a
second metric, ranking, popularity score, moderation claim, editorial approval
claim, shuffle, personalization, or owner preference.

Wrap the non-`fetch` public query with the documented cache primitive for this
repository's non-Cache-Components model and give it one stable tag used by the
generation action. Prefer event-driven invalidation from a successful public
write over an invented polling interval. Keep the cache declaration and query
server-only.

The landing build must still succeed without environment variables. If
`DATABASE_URL` is absent during build, or the public query fails at render
time, return the complete artboard fallback rather than failing `/`. A runtime
database failure may be logged only as a generic server-side gallery-read
failure with no row or user data. Do not turn a provider outage into an empty
strip or a visible error on the marketing page.

## Gallery rendering contract

Refactor `Gallery` only as far as needed to accept the curated public image
records from its Server Component read. Keep all of these exact behaviors and
measurements:

- the existing `--container` heading and copy;
- one four-column pass followed by its hidden duplicate;
- the current column order, full-height versus stacked-slot structure, data
  tile position, 4px seams, 220px, 280px, and 340px responsive column widths,
  and 420px and 520px strip heights;
- square `--r-none` gallery tiles, the only radius exception;
- the 70-second horizontal CSS drift, its hover pause, and the 22-second up and
  26-second down GSAP counter-scrolls;
- the existing scoped `useGSAP`, module-scope registration, named
  `prefers-reduced-motion` path, listener cleanup, and `mm.revert()` cleanup;
- transform-only animation and `will-change` only on elements that animate;
- the second horizontal pass and second vertical pass hidden from assistive
  technology.

Remote Blob images render through `next/image` under the already configured
`/generations/**` `remotePatterns` entry. Supply the stored intrinsic width and
height and accurate `sizes`; preserve the fixed slot geometry with
`object-cover`. No gallery image gets `priority`.

Because this query deliberately does not expose prompts, give public gallery
images concise factual alt text that does not claim a subject the application
does not know. Repeated loop copies remain empty and `aria-hidden`. Keep the
current descriptive alt text for each artboard fallback. Do not derive alt text
from a user prompt unless the consent text and data contract are explicitly
expanded first.

When no public generations exist, the rendered strip must match the current
artboard-backed output exactly. When public generations exist, only the
photographic image sources, their intrinsic dimensions, and their truthful alt
text may change. Heading, metric tile, geometry, order of slot types, motion,
and responsive behavior remain stable.

## `/community` bridge

The current static `/community` page says every generation is private and the
public showcase is closed. That becomes false in this step. Keep the route a
static Server Component and retain its existing layout family, artboard image,
tokens, spacing, and lack of new motion, but revise its metadata and visible
copy to state the actual boundary:

- generations remain private by default;
- an owner can explicitly opt one new generation into the public gallery;
- the landing-page strip shows the current public work.

Change its single action to a clear internal link to `/#gallery-title`. Do not
make `/community` query the database, render a second gallery, expose prompts,
add a share link, or imply moderation, curation by staff, community profiles,
likes, comments, or permanence. Those belong to step 8 or are not in the
product sequence.

Use plain technical copy with no exclamation mark, invented number, em-dash, or
en-dash. Re-read every new label, status, alt string, metadata string, and error
message before shipping.

## Render impact

- `/` changes from a fully artboard-backed static landing page to a cached,
  database-backed public gallery read with on-demand revalidation. With no
  public rows or no database environment, its rendered gallery must be
  identical to the current fallback. With public rows, only eligible photo
  slots change.
- `/generate` remains dynamic and owner-scoped. Its form gains one unchecked
  publication choice, and successful opted-in writes also invalidate the
  public gallery.
- `/community` remains static but its stale private-only copy and one action
  change to describe and link to the opt-in gallery.
- `/sign-in`, `/sign-up`, `/account`, `/learn`, `/build`, `/product`, all seven
  footer destinations, and every other existing route must keep the same
  output and render behavior.

Do not predict the production build's route symbols. Run the build and record
the route table it actually prints.

## Trust boundary

One new value crosses from the signed-in browser form to the Server Action: the
publication checkbox. The shared Zod schema validates the exact closed value
and defaults absence to private. The action authorizes with Clerk inside the
action and takes the owner only from that server session. A rejected value
returns the existing typed handled error shape and creates no model call, Blob,
or row.

The marketing read accepts no browser input and requires no session. It queries
only rows already marked public and projects only non-owner display fields. A
missing database configuration or read failure resolves to the local fallback,
not to leaked details or a thrown marketing-page error.

There is no mutation for making an existing generation public or private in
this step. No client-supplied generation id is accepted. Sharing, unlisted
state, later visibility changes, and the full `/community` showcase remain step
8 work.

## Secrets and data

This change reads the existing server-only `DATABASE_URL` at runtime and
`DATABASE_URL_UNPOOLED` during migration. The existing generation action still
uses `CLERK_SECRET_KEY`, `BLOB_READ_WRITE_TOKEN`, and `VERCEL_OIDC_TOKEN`
through their established server-only modules. No new environment variable is
introduced. The only browser-visible provider variable remains
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, with the existing public Clerk routing
variables unchanged.

The new stored datum is one boolean publication choice on each generation.
Public gallery rendering transmits the opted-in image URL and stored dimensions
to anonymous visitors. It does not transmit owner id, prompt, model id, Clerk
identity, or email. Generated images remain in Blob, never in `public/` or Git.
No prompt, image URL, identity, request body, or form payload is logged.

## Files

Create:

- `prompts/013-public-generation-gallery.md`.
- the next Drizzle migration SQL and generated metadata files under
  `drizzle/`, using `npm run db:generate` rather than hand-authoring them.

Modify as required:

- `lib/db/schema.ts`.
- `lib/db/queries.ts`.
- `lib/validation/generation.ts`.
- `app/(app)/generate/actions.ts`.
- `components/ui/PromptField.tsx`.
- `components/app/GeneratorWorkspace.tsx` only if it must pass a narrowly
  scoped form option or result field.
- `components/sections/Gallery.tsx`.
- `app/(marketing)/community/page.tsx`.
- `docs/backend.md`.
- `design-system.md`.

`app/(marketing)/page.tsx` may be modified only if the verified Next.js Server
Component composition requires it. `next.config.ts` may be modified only if the
existing Blob `remotePatterns` entry is proven insufficient by the installed
docs and actual generated URL. Do not broaden the hostname or pathname pattern
speculatively.

Do not modify `components/motion/ColumnDrift.tsx` unless a verified defect makes
the existing data-independent animation incompatible with the new records. If
that happens, stop and explain the defect before widening the scope. Do not
touch any other file under `components/motion/`, any file under
`components/brand/`, `Hero`, `Features`, `Stats`, `LogoWall`, `Footer`,
`app/globals.css`, the app shell, auth screens, AI model module, storage module,
proxy, or unrelated marketing pages.

Do not delete files. If the landing-page screenshot or route-table comparison
procedure is manually reconstructed for a second time during execution, follow
`AGENTS.md` §3 by creating `docs/automation.md` and adding it to the project
notes index in the same implementation. Do not create an automation file with
untested commands.

## Non-goals

- No step 5 controls, model registry, aspect-ratio choice, or image count.
- No `/g/[id]`, `/library`, full database-backed `/community`, share link,
  unlisted state, owner visibility toggle, likes, comments, profiles, or
  moderation workflow.
- No deletion or Blob cleanup change.
- No new provider, environment variable, analytics, admin role, CMS, route
  handler, API server, client-side data-fetching library, or polling.
- No prompt display in the landing gallery, unless the consent and minimal data
  contract above are deliberately and visibly expanded before implementation.
- No landing-page redesign, new metric, stock image, generated site asset,
  color, radius, stacking level, priority image, animation, or marquee region.
- No changes to the existing `48,000`, `10.2M+`, `300+`, or `1000+` figures.

## Measurements and responsive procedure

Use the values already measured and encoded in `Gallery.tsx` and
`design-system.md`; do not eyeball replacements. Compare the implementation
against a clean `main` baseline at `sm`, `md`, `lg`, and 1440px with an empty
public result set first. The heading baseline, section padding, strip top gap,
column widths, heights, seams, tile boundaries, data tile, and motion must
overlay the baseline.

Then verify with one through the full photographic-slot count of public rows.
At every count, the strip stays full, new rows occupy deterministic slots, and
the remaining exact fallback images stay in their original slots. Verify both
horizontal loop seams and both vertical loop seams for long enough to cross a
complete cycle, hover pause and resume, and reduced motion with no tween
created.

Check remote image aspect ratios at narrow mobile, 768px, 1024px, and 1440px.
No image load may move tile boundaries or the section below it. Check that
every remote request is accepted by `next/image`, receives an accurate `sizes`
candidate, and does not become priority.

## Documentation after implementation

Extend `docs/backend.md`, do not rewrite it, with the migration, boolean
default, public index, minimal query projection, cache tag and invalidation,
publication validation, consent boundary, `/` fallback behavior, actual render
mode, and verification results.

Extend `design-system.md` §2.6 with the dynamic-photo substitution and exact
fallback rule. Update §2.9 for `/community`'s bridge to the landing gallery.
The §3 gallery motion row and reduced-motion sentence should remain unchanged
unless execution proves the implementation altered them; this prompt adds no
motion. Record no build history in `AGENTS.md`.

## Checks

Run and report exact output from every applicable command:

1. `npm run db:generate`, then inspect the generated migration and metadata.
2. `npm run db:push`, then run a read-only database verification of the new
   column, default, nullability, index, and the public query ordering.
3. `npm run lint`.
4. Build without provider variables by temporarily moving `.env.local` to a
   validated backup path, running `npm run build`, and restoring it even if the
   build fails. The fallback gallery must make this pass. Do not use a broad or
   destructive path.
5. Run `npm run build` with the configured environment and record the actual
   route table for `/`, `/generate`, and `/community`.
6. Compare `/` against clean `main` at the recorded viewports with no public
   rows. Pixel output must match. Confirm Hero drift, beads, drips, both existing
   marquee regions, spiral, reveals, and count-up still run.
7. Seed or create private and public rows only through a safe, reversible test
   procedure that does not expose real user data. Confirm private rows never
   enter the anonymous gallery, public rows are newest first, the row limit is
   exact, and missing slots retain their assigned fallbacks. Remove synthetic
   rows and Blobs after verification and state how they were removed.
8. Generate through the real form when the Gateway account permits it. Confirm
   unchecked creates private, checked creates public, the choice is server
   validated, `/generate` refreshes, and `/` updates after public success. If
   the recorded Gateway billing block remains, report that live generation is
   blocked and verify the database/render path without pretending the provider
   call passed.
9. Confirm `/community` remains static, states private-by-default accurately,
   and its single action reaches `/#gallery-title` with keyboard focus visible.
10. Keyboard-only and screen-reader pass on the new checkbox, status result,
    gallery, and community link. Confirm duplicate loop content stays hidden.
11. `prefers-reduced-motion: reduce`: no gallery GSAP tween is created and the
    full strip remains readable. Normal motion retains the current directions,
    durations, seamless loops, and hover pause.
12. Search visible authored strings for em-dash and en-dash characters, raw
    component hex values, invented statistics, and unapproved copy. Distinguish
    user content from authored UI when auditing.
13. Search the production output for the Clerk secret, Blob token, database
    URLs, and OIDC token without printing their values. No server secret may
    appear in a client asset.
14. Confirm `git status` contains only this prompt's approved files, inspect
    `git diff --check`, and commit the executed implementation to `main`. Do not
    push.

There is still no typecheck script or test runner in `package.json`. Do not
claim either ran and do not reference an invented command.
