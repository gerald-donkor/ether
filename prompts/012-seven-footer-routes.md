# 012 - The seven footer routes

Build step 3 is next because build steps 1 and 2 are committed as `a367b09`
and `4c5b9f7`, the protected app and four public navigation routes are present,
and all seven named footer destinations still render as `href="#"`. Build step
3 depends only on the completed backend foundation. The later database-backed
gallery remains blocked behind this phase-one link repair.

This prompt creates public routes for `Grants`, `Generator`, `Careers`,
`Disclaimer`, `Services`, `Blog`, and `Newsletter`, gives every named footer
item a real destination, and removes the footer social row's unverified `#`
targets without inventing social accounts. It does not start the public-gallery
data work from build step 4 or any phase-two product feature.

## Design read

Reading this as: seven concise product-information and status pages for working
creatives, extending Ether's dark studio-console language in preserve mode.
These are honest destinations for a finished marketing shell, not seven new
landing pages and not a redesign.

Use these dials while judging the work:

- `DESIGN_VARIANCE: 7` - each route needs a distinct reading family, but every
  family must come from Ether's existing tokens, primitives, and content.
- `MOTION_INTENSITY: 2` - static composition plus the established link hover
  and button active feedback only. No new automatic motion has an approved
  reason.
- `VISUAL_DENSITY: 3` - several routes are intentionally thin. A precise
  one-screen status is preferable to invented programs, roles, posts, or
  services.

The aesthetic risk is editorial restraint. Make absence useful and composed
without filling it with fake roadmaps, decorative metadata, invented proof, or
generic card grids. Spend no design freedom on a new palette, typeface,
gradient, radius, glow, or animation.

## Reference material

Read before implementation:

- `AGENTS.md` in full, especially the invariants, §5.2 build step 3, §6.1-§6.3,
  §8.1, §8.5, §11, and §12.
- `design-system.md` in full. §1 owns every token and measurement, §2.2 owns
  buttons, §2.7 owns the settled footer, §2.9 records the existing marketing
  information routes, §3 is the complete motion allow-list, §4 owns imagery,
  and §6 is binding.
- `docs/backend.md`, especially `Auth and routes`, to preserve `/generate` as a
  protected dynamic route and keep the seven new routes public and static.
- `public/assets/ui/ref/AI Generator.pdf` and
  `public/assets/ui/ref/AI Generator.svg`. The PDF is the single 1440 by 3392
  point reference artboard and remains the source of the footer composition.
- `components/sections/Footer.tsx`, `app/(marketing)/layout.tsx`,
  `app/(marketing)/page.tsx`, the four existing files under
  `app/(marketing)/{learn,build,product,community}/page.tsx`,
  `components/ui/Container.tsx`, `components/ui/Button.tsx`,
  `app/globals.css`, and the existing files under `public/assets/ui/img/`.
- Installed Next.js 16.3 documentation:
  `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`,
  `04-linking-and-navigating.md`, `12-images.md`, and
  `14-metadata-and-og-images.md`, plus
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
  and
  `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`.

There is no artboard for these seven routes. Do not imply that their page
layouts were measured from one. Derive every value from `design-system.md` and
judge the new compositions beside the existing landing and navigation routes
at the same recorded viewports.

## Route and destination contract

Use these exact public paths:

| Footer label | Public path | Destination job |
| --- | --- | --- |
| `Grants` | `/grants` | State whether Ether currently operates a grant program |
| `Generator` | `/generator` | Explain the current prompt-to-image workflow and lead to the protected tool |
| `Careers` | `/careers` | State whether Ether currently lists open roles |
| `Disclaimer` | `/disclaimer` | Set factual limits around generated output and service availability |
| `Services` | `/services` | Define the current self-serve product boundary |
| `Blog` | `/blog` | Provide an honest empty publication index |
| `Newsletter` | `/newsletter` | State the current publication and subscription status without collecting email |

`/generator` is deliberately distinct from `/generate`. The former is a public
static explanation reached from the marketing footer. The latter is the
existing signed-in product surface protected by Clerk, proxy, layout, page, and
Server Action checks. Do not rename, redirect, weaken, or duplicate
`/generate`.

Every new page is a Server Component by default, exports route-specific static
metadata, and remains statically renderable. None reads `headers()`,
`cookies()`, `auth()`, search parameters, the database, Blob, or the AI
Gateway. Do not create a shared page template that turns seven destinations
into the same layout with swapped copy.

The copy register is plain, technical, and confident. Use active voice, no
exclamation marks, no hype, no fabricated testimonial, no invented statistic,
and no visible em-dash or en-dash character. Claims must be supported by the
committed repository. Thin routes must say what is available now and stop.
They must not promise dates, future openings, planned programs, response times,
funding amounts, job counts, publishing cadence, subscriber benefits, legal
outcomes, or service capabilities that the repository does not establish.

## Route content and distinct layout families

### `/grants` - an availability threshold

Purpose: answer the footer label without manufacturing a grant program.

Use a compact one-screen threshold composition with a left-aligned statement
and one quiet supporting region that defines the current boundary. State that
Ether does not list an open grant program today. Do not invent eligibility,
award sizes, deadlines, application criteria, partner organizations, an
application form, or a waitlist. A single contextual link to `/product` is
allowed if it helps the reader understand what Ether currently provides.

This family is an asymmetric threshold, not another capability ledger, status
card, numbered process, or image-plus-text split.

### `/generator` - a working path into the product

Purpose: explain the real workflow and lead the reader into `/generate`.

Compose the page as a vertical prompt-to-result path with three semantic
moments: write a prompt, request one square image, and return to private recent
work. Sequence may be communicated through natural reading order and spacing,
not `Step 1` labels, invented performance figures, fake controls, or a mocked
product screenshot. Use one existing artboard photograph as a visual reference
only if it clarifies the transition from instruction to image. Do not label it
as an Ether generation. End with one `Open generator` action to `/generate`.

Do not reuse the `/build` horizontal clause bench, `/learn` field-guide bands,
`/product` capability ledger, landing-page prompt field, or authenticated
workspace.

### `/careers` - an empty vacancy board

Purpose: answer whether Ether is currently recruiting without inventing a
company story or role.

Use a one-screen vacancy-board family with a strong plain status and a small
definition of what is absent. State that Ether does not list open roles today.
Do not invent job titles, departments, locations, benefits, culture claims,
employee names, application email addresses, talent pools, or speculative
applications. No form and no resume upload.

The empty state must remain semantic page content, not a decorative dashboard,
table, or disabled collection of fake job rows.

### `/disclaimer` - a restrained document column

Purpose: give readers a factual, readable account of the current product's
limits.

Use a narrow document family with one H1 and a short set of clearly headed
sections. Limit the subject matter to facts the repository supports:

- a prompt is sent to an image model and an output can fail or be refused;
- generated results can vary and should be reviewed before use;
- service availability is not guaranteed, including while the recorded
  Gateway billing block remains unresolved;
- users should not submit material they are not permitted to use;
- the page is a practical product disclaimer and must not fabricate a legal
  entity, jurisdiction, governing law, warranty term, ownership grant, privacy
  policy, or contractual promise.

Do not expose provider strings, secrets, internal error details, user prompts,
or the operational billing message as marketing copy. Do not call this a Terms
of Service or Privacy Policy. Do not claim legal review. Keep paragraphs under
65ch and use hierarchy and whitespace rather than a card around each section.

### `/services` - a scope boundary rail

Purpose: distinguish the product that exists from services that do not.

Use a sparse boundary-rail composition with the self-serve generator as the
available side and unprovided managed work as the unavailable side. State only
that Ether currently provides the signed-in image generator described by the
committed product. Do not invent consulting, creative direction, enterprise
implementation, custom-model work, support tiers, pricing, booking, contact
forms, or service-level agreements. End with at most one action to `/generate`.

This family must not become two equal feature cards, a comparison pricing
table, or a repeat of `/product`'s capability ledger.

### `/blog` - an empty editorial index

Purpose: make the destination honest before any writing exists.

Use an editorial index frame with a clear page title, a short status, and an
empty publication region that reads intentionally at desktop and mobile. State
that no articles are published. Do not create sample posts, dates, authors,
categories, thumbnails, reading times, archive counts, RSS claims, or a dynamic
`[slug]` route. No database, CMS, markdown pipeline, or content collection is
part of this step.

Do not turn the empty index into a card grid or copy the `/careers` vacancy
board composition.

### `/newsletter` - a dispatch notice

Purpose: answer the footer label without collecting data before a newsletter
and consent path exist.

Use a compact dispatch-notice family with a plain publication status and a
short explanation. State that Ether does not currently publish a newsletter or
accept subscriptions. Do not render an email input, disabled form, fake success
state, external signup link, issue preview, frequency claim, subscriber count,
privacy consent, or mailing-list storage. No Server Action, provider, API route,
or environment variable is needed.

This family must be visibly distinct from the grants threshold and careers
vacancy board through composition, not through new colors or decoration.

## Measurements and responsive procedure

Use only the measured system in `design-system.md`:

- the shared nav and footer remain on `--container-wide`; route content uses
  the existing `Container` with `width="inner"`;
- the nav stays 72px tall; content clears it with values from the established
  4px spacing scale, and normal desktop section rhythm remains 120px;
- H1, H2, body, label, caption, and button roles use the type sizes, weights,
  tracking, and loose display leading recorded in `design-system.md` §1.3;
- all surfaces use `--r-card`, `--r-panel`, or `--r-pill`. The gallery-only
  square-corner exception does not extend to these pages;
- every paragraph stays within 65ch;
- pages that use an existing artboard image render it with `next/image`, reserve
  its intrinsic ratio, set accurate `sizes`, and use accurate or deliberately
  empty alt text. No new page image gets `priority`;
- all asymmetric and multi-column compositions collapse explicitly before
  768px. Validate at the recorded `sm`, `md`, `lg`, and 1440px widths rather
  than introducing a new breakpoint.

Not every thin status route needs a photograph. Use an image only when the
route's content needs it, and only from `public/assets/ui/img/`. Never add stock,
generated site imagery, avatars presented as staff, or a new file under
`public/`. Existing artboard photographs are references, not product outputs,
grant recipients, employees, clients, authors, or subscribers.

## Footer change

Change the module-scope `COLUMNS` records in
`components/sections/Footer.tsx` to typed `{ label, href }` destinations in the
existing order. Render internal footer destinations with `next/link`:

- `Grants` to `/grants`;
- `Generator` to `/generator`;
- `Careers` to `/careers`;
- `Disclaimer` to `/disclaimer`;
- `Services` to `/services`;
- `Blog` to `/blog`;
- `Newsletter` to `/newsletter`.

Preserve the footer's plate, container, wordmark, copy, columns, headings,
spacing, label styling, order, and static pixels. The seven new destinations
are the only intended change to the named link row.

The social account URLs are not provisioned or recorded anywhere in the
repository, so do not invent them. Replace their five `href="#"` anchors with
non-interactive visual lockups using semantic list markup and `aria-hidden`
icons. Preserve icon identity, size, order, color, spacing, and resting visual
output, but remove hover, focus, link semantics, and screen-reader labels that
would imply an account exists. Add a concise source comment explaining that
real anchors return only when verified account URLs are provided. The phase-one
result must contain no `href="#"` on `/`.

Do not change the footer into a client component. Keep the content records at
module scope and avoid unnecessary client JavaScript.

## Render impact

- `/grants`, `/generator`, `/careers`, `/disclaimer`, `/services`, `/blog`, and
  `/newsletter` are new public static routes.
- `/` remains static and visually pixel-stable. Its intentional HTML and
  behavior changes are limited to the seven named footer destinations and the
  five unverified social icons becoming non-interactive lockups.
- `/learn`, `/build`, `/product`, and `/community` receive the same footer
  changes through the shared marketing layout but retain their page output and
  static render mode.
- `/sign-in`, `/sign-up`, `/generate`, and `/account` retain their current
  output, access boundary, and render behavior. The authenticated app shell has
  no marketing footer and is not modified.
- No route enables Cache Components, dynamic rendering, ISR, request-time data,
  or a new client boundary.

Verify render modes from the production build route table. Do not infer them
from this prompt.

## Trust boundary

None. These routes add no form, mutation, route handler, Server Action, request
body, user-supplied parameter, user-content read, or external navigation. The
only boundary crossed is a public internal route path handled by Next.js.
`/generate` remains independently protected by the existing proxy, app layout,
page, and action checks.

## Secrets and data

No new environment variable is read and no `NEXT_PUBLIC_*` variable is
introduced. The pages store, log, collect, or transmit no user data, email
address, prompt, request body, generation record, image, resume, or application.
Do not import from `lib/db/`, `lib/ai/`, `lib/storage/`, `lib/auth/`, or
`lib/validation/`.

## Files

Create:

- `app/(marketing)/grants/page.tsx`
- `app/(marketing)/generator/page.tsx`
- `app/(marketing)/careers/page.tsx`
- `app/(marketing)/disclaimer/page.tsx`
- `app/(marketing)/services/page.tsx`
- `app/(marketing)/blog/page.tsx`
- `app/(marketing)/newsletter/page.tsx`

A narrowly scoped shared component under `components/marketing/` is allowed
only when at least two pages share actual behavior, not merely page-lead markup.
Do not abstract the seven layout families into one configurable template.

Modify:

- `components/sections/Footer.tsx`
- `design-system.md`, extending it with a concise component record for the
  seven route families, their factual empty-state policy, static behavior,
  asset use, and absence of new motion.

Do not modify:

- `app/(marketing)/page.tsx`, `app/(marketing)/layout.tsx`, `app/layout.tsx`,
  `app/globals.css`, `next.config.ts`, or `proxy.ts`;
- the existing page files under `app/(marketing)/learn`, `build`, `product`, or
  `community`;
- `components/sections/Nav.tsx`, `Hero.tsx`, `Features.tsx`, `Stats.tsx`,
  `Gallery.tsx`, or `LogoWall.tsx`;
- anything under `components/motion/`, `components/brand/`, `components/app/`,
  `lib/db/`, `lib/ai/`, `lib/storage/`, `lib/auth/`, `lib/validation/`, or
  `drizzle/`;
- `docs/backend.md`, because this prompt adds no backend behavior;
- any existing asset or prompt file.

## Non-goals

- No database-backed gallery, public generation flag, curation, sharing, or
  community feed. Those are build steps 4 and 8.
- No grant application system, careers system, CMS, blog post route, newsletter
  provider, email collection, contact form, CRM, booking system, consulting
  workflow, legal-policy suite, or social-account setup.
- No generation controls, image permalink, library, quotas, moderation,
  billing, editing, teams, or public API.
- No new provider, dependency, component library, token, font, icon family,
  gradient, radius, z-index level, or animation.
- No redirect, alias, or collision between `/generator` and `/generate`.
- No redesign or refactor of the landing page, navigation routes, application
  shell, or settled footer composition.

## Constraints

- One dark theme from start to finish.
- Violet identifies and lime acts. Lime appears only on real actions; violet is
  never a button fill; text on lime is ink.
- No raw hex in a component file and no change to the established token set.
- Zero em-dashes or en-dashes in visible copy, metadata descriptions, alt text,
  captions, or accessible labels.
- No invented number. These routes need no statistic, date, count, price,
  deadline, cadence, or performance claim.
- Seven distinct route families. None may repeat the landing hero grid, logo
  wall, feature pair, stat split, gallery strip, footer, app form column, or any
  of the four existing marketing information-route families.
- No new motion. Existing link color transitions and button active feedback are
  sufficient, so `design-system.md` §3 gains no row.
- Every real keyboard stop keeps the global 2px lime focus ring at 2px offset.
  Non-interactive social lockups are not keyboard stops.
- Phosphor icons remain direct SSR imports. Add no hand-rolled SVG and no second
  icon family.
- Keep static arrays and content records at module scope. Do not define
  components inside components or add client components for static content.
- Preserve the one-per-page image priority rule by adding no priority image to
  these routes.

## Verification

Run and report exact output for:

1. `npm run lint`.
2. The environment-absent production build required by `AGENTS.md`: move
   `.env.local` to `.env.local.bak` if it exists, run `npm run build`, and
   restore it even if the build fails.
3. Read the production build route table. Verify all seven new routes are
   static, `/` and the four existing public information routes remain static,
   and protected routes retain their current behavior.
4. Compare `/` before and after at the recorded `sm`, `md`, `lg`, and 1440px
   widths. Pixels must remain identical at rest. The intended differences are
   link destinations and the absence of link semantics and hover behavior on
   unverified social icons. Confirm the existing hero, gallery, logo-wall,
   stat, bead, and brand-shape motion still runs.
5. Open every new route directly and through the desktop and mobile footer.
   Verify no 404, no horizontal overflow, no clipped display type, and explicit
   single-column fallbacks where required.
6. Confirm `/generator` is public and static, its action reaches `/generate`,
   and `/generate` remains protected and dynamic in both signed-out and
   signed-in checks.
7. Traverse the footer and all seven pages by keyboard. Every actual link shows
   the lime focus ring, each page has one H1 and logical heading order, and the
   five social lockups receive no focus and expose no false link semantics.
8. Inspect every visible string and metadata field for an em-dash, en-dash,
   exclamation mark, invented figure, unsupported future promise, fake legal
   claim, or implication that an artboard image is real user, employee, client,
   applicant, author, or subscriber content.
9. Search the rendered landing HTML and `components/sections/Footer.tsx` to
   confirm there is no `href="#"`. Also search all of `app/` and `components/`
   so any remaining dead anchor is reported rather than silently ignored.
10. Confirm no new page imports a client-only hook, provider package, database,
    auth, AI, storage, validation, or environment access.

If screenshot comparison is worked out manually for a second time during this
implementation, follow `AGENTS.md` §3: create `docs/automation.md`, record the
repeatable command, and add that file to the project-notes index in `AGENTS.md`
in the same change.

Record the finished visual work in `design-system.md`. Do not record it in
`AGENTS.md` or `docs/backend.md`. After all checks pass, commit the complete
implementation to `main` without pushing.

## SKILLS USED

- `design-taste-frontend` - preserve the established brand, compose seven
  distinct and truthful route families, and run the anti-template,
  accessibility, copy, and responsive pre-flight.
- `frontend-design` - make absent programs and publications readable without
  filler, and give each page an intentional content structure inside Ether's
  settled visual language.
- `vercel-react-best-practices` - keep static page content server-first,
  module-scoped, directly imported, and free of unnecessary client JavaScript
  or bundle growth.

No Next.js-specific or Tailwind-specific skill is available in the current
skill listing. During implementation, verify Next.js 16.3 behavior from the
installed documentation named above and Tailwind CSS 4 usage from the committed
tokens and utility patterns in `app/globals.css` and existing components rather
than writing either API from memory.
