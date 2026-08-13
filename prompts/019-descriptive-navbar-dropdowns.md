# 019 - Descriptive navbar dropdowns

This user-requested site refinement is next because the four primary navigation
labels already point to real routes, but their chevrons still imply disclosure
behavior that does not exist. The work turns `Learn`, `Build`, `Product`, and
`Community` into accessible dropdown buttons whose panels explain the existing
destinations in enough detail to support a decision before navigation.

It is a targeted extension of the finished navigation. It does not create a
route, rename a primary label, change a URL, or claim a feature the repository
does not already provide.

## Design read

Reading this as: a preserve-mode refinement of Ether's marketing navigation for
working creatives, with the existing dark studio-console language and a compact
information-dense disclosure pattern.

Use these design dials while judging the work:

- `DESIGN_VARIANCE: 2` - the closed navigation must retain its current measured
  composition; hierarchy comes from type and spacing inside each panel.
- `MOTION_INTENSITY: 2` - the panel opens and closes as direct interface state.
  Existing hover and active feedback is sufficient, so no entrance tween,
  stagger, caret rotation, or new motion row is permitted.
- `VISUAL_DENSITY: 6` - each menu gives a useful title and one-sentence route
  description without becoming a full-screen mega menu on desktop.

The design move is a compact route index beneath each familiar label. Do not
spend this refinement on blur, glow, glass, decorative icons, new gradients, or
a second navigation language.

## Reference material

Read before implementation:

- `AGENTS.md` in full, especially the invariants, §1 workflow, §2 checks, §3
  automation, §4 prompt contract, §5 product scope, §6.1-§6.3 boundaries,
  §8.1 render impact, and §12 verification rules.
- `design-system.md` in full. §1 owns tokens, type, the 4px spacing scale,
  containers, and radii; §2.1 owns the 72px navigation; §2.2 owns buttons and
  focus; §3 is the complete motion allow-list; §5.3 owns bundle discipline; §6
  is binding.
- The user's desktop screenshot at
  `/home/gdk26/Pictures/Screenshots/Screenshot_20260813_192431.png`. It records
  the closed signed-in navigation state that must remain visually unchanged.
- `public/assets/ui/ref/AI Generator.pdf` and
  `public/assets/ui/ref/AI Generator.svg`, the 1440 by 3392 point source
  artboard. The artboard contains the closed nav, not an open dropdown, so do
  not claim the panel dimensions were measured from it.
- `components/sections/Nav.tsx`, `app/(marketing)/layout.tsx`,
  `app/globals.css`, `lib/z.ts`, `components/ui/Container.tsx`, and
  `components/sections/Footer.tsx`.
- The pages linked from the dropdown records:
  `app/(marketing)/learn/page.tsx`, `build/page.tsx`, `product/page.tsx`,
  `community/page.tsx`, `blog/page.tsx`, `newsletter/page.tsx`,
  `generator/page.tsx`, `services/page.tsx`, `grants/page.tsx`, and
  `careers/page.tsx`, plus `app/(app)/generate/page.tsx`,
  `app/(app)/library/page.tsx`, and `app/(app)/account/page.tsx`. Link copy must
  describe committed behavior only.
- `prompts/010-four-nav-routes.md`, especially its navigation preservation
  requirements and the old dropdown non-goal that this explicit user request
  now supersedes.
- Installed Next.js 16.3 documentation:
  `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`
  and `node_modules/next/dist/docs/03-architecture/accessibility.md`.
- `docs/automation.md`, especially the established environment-absent build,
  route-table comparison, and landing-output comparison procedures.

No Next.js-specific or Tailwind-specific skill is available in the current
skill listing. Verify those surfaces from the installed Next.js 16.3 docs,
the installed Tailwind CSS 4 package behavior, and the repository's existing
utility usage rather than writing APIs from memory.

## Information architecture and visible copy

Replace the flat `LINKS` records with a typed, module-scope navigation model.
Each top-level label is a disclosure button, and each panel begins with the
overview route matching that label. Use exactly these destination labels,
paths, and descriptions unless inspection at implementation time proves a
claim has become inaccurate:

### Learn

- `Prompt field guide` -> `/learn`
  `Choose a subject, setting, light and finish with more intention.`
- `Blog` -> `/blog`
  `Find Ether writing when the publication opens.`
- `Newsletter` -> `/newsletter`
  `Check the current publication and subscription status.`

### Build

- `Prompt assembly` -> `/build`
  `Combine concrete image choices into one concise prompt.`
- `Generator guide` -> `/generator`
  `See the current path from instruction to a private image.`
- `Open generator` -> `/generate`
  `Create and keep images in your signed-in workspace.`

### Product

- `Product overview` -> `/product`
  `Review the capabilities available in Ether today.`
- `Generation library` -> `/library`
  `Search, open and manage the images attached to your account.`
- `Account` -> `/account`
  `Review the identity and access attached to your workspace.`
- `Services` -> `/services`
  `Understand what the self-serve product provides today.`

### Community

- `Community showcase` -> `/community`
  `Browse images their owners chose to publish.`
- `Grants` -> `/grants`
  `Check the current status of Ether grant programs.`
- `Careers` -> `/careers`
  `See roles Ether has made available.`

Do not include `Disclaimer` in a product-navigation dropdown. It remains in the
footer, where legal information belongs. Do not duplicate the signed-in
`Generate` link or Clerk user button inside Product. The Build panel's `Open
generator` entry is contextual product navigation and is allowed in both auth
states; the existing proxy and protected app layout continue to enforce access.

Every string follows Ether's plain technical register. There are no exclamation
marks, statistics, hype, future promises, visible em-dashes, or claims that an
extracted artboard image is user work.

## Desktop disclosure behavior

At `lg` and above:

1. Keep the wordmark, top-level label order, 32px list gap, 15px label role,
   caret size, signed-in and signed-out branches, 72px nav height, and overall
   closed-state pixels unchanged.
2. Render each top-level label and caret as one native `button` with
   `type="button"`, `aria-expanded`, and `aria-controls`. The button replaces
   the current top-level `Link`; the overview route remains the first link in
   its panel, so no existing destination is lost.
3. Only one panel may be open. Clicking a closed trigger opens it; clicking the
   same trigger closes it; opening another closes the previous one.
4. Pointer hover or keyboard focus within a navigation item opens or preserves
   its panel. Pointer exit closes it only when focus is not still inside that
   item. Do not create an activation gap between trigger and panel.
5. `Escape` closes the open panel and returns focus to its trigger. A pointer
   interaction outside the open navigation item closes it. Selecting a route
   closes the panel before navigation.
6. Preserve normal Tab and Shift+Tab order through triggers and panel links.
   Do not add `role="menu"` or arrow-key-only navigation to a set of ordinary
   website links. Native buttons and links keep their native semantics.
7. The panel is absolutely positioned below its trigger, aligned to keep its
   complete width inside the 1240px wide container. The Community panel aligns
   to the right edge. No panel may create horizontal viewport overflow.
8. Panel state is local transient UI state. Do not add a global store, context,
   dependency, route handler, or server action.

## Panel composition and measurements

Use the established system only:

- `--surface` provides the panel fill, `--line` the 1px boundary,
  `--r-panel` the panel radius, `--text` the destination title,
  `--text-3` the description, and `--lime` only for the existing focus ring.
  Do not use violet as a button fill and do not add a shadow or backdrop blur.
- Use a 360px desktop panel width. This is 90 units on the established 4px
  scale and gives the longest approved description a compact readable wrap at
  the existing utility-copy role. Use 12px panel inset and 4px between title
  and description; both values are on the same scale.
- Each destination is a single block link with 12px vertical and horizontal
  inset. Use the existing 14px navigation-link role for its title and the
  existing 13px/22px caption role for its description.
- Separate destinations through spacing and hover fill, not a border on every
  row. Use `--surface-2` for hover and focus-adjacent visual feedback while the
  global focus ring remains fully visible.
- The panel begins immediately below the trigger's navigation item with a 4px
  visual offset implemented as padding on the positioned wrapper, so moving the
  pointer from trigger to panel cannot cross a dead zone.
- The open state appears without an entrance animation. Existing color
  transitions may remain; do not add transform or opacity transitions, rotate
  the caret, or edit `design-system.md` §3.
- The closed state must match the supplied screenshot at its native viewport
  and at the recorded `lg` and 1440px widths. If the 360px panel creates a
  viewport collision at the lower edge of `lg`, align the wrapper rather than
  changing the panel width or top-level nav spacing.

No raw hex may appear in the component. Do not edit the token set in
`app/globals.css`.

## Mobile disclosure behavior

Below `lg`, preserve the existing full-screen mobile dialog, focus transfer,
Escape behavior, scroll lock, close button, and focus return to the hamburger.
Inside that dialog:

- render the same four top-level labels as full-width disclosure buttons with
  carets and `aria-expanded` / `aria-controls`;
- allow only one mobile section to be expanded at a time;
- place the same descriptive destination links directly beneath its trigger;
- close the full-screen dialog when any destination is selected;
- keep signed-out `Sign in` and `Try Free` controls and signed-in `Generate`
  and `UserButton` controls after the four disclosure groups;
- make the dialog content vertically scrollable while body scroll remains
  locked, so the expanded descriptions never make the close control or final
  auth controls unreachable on a short viewport;
- retain the existing 30px top-level text role. Use the desktop panel's 14px
  title and 13px/22px description roles for the nested routes, with spacing
  selected only from the established 4px scale;
- do not style nested links as floating cards. Use indentation, spacing, and a
  single group boundary to express hierarchy inside the full-screen panel.

Escape first closes the whole mobile dialog, matching the existing behavior.
The mobile accordion state is discarded with the dialog and does not need a
separate Escape layer.

## State and component structure

Keep `Nav` as the existing client leaf. Static navigation records stay at module
scope. A small module-scope `NavDisclosure` component is allowed to keep the
desktop and mobile map legible, but do not define components inside `Nav` and do
not split the interaction into unnecessary client bundles.

Use a discriminated key type derived from the module-scope data for the open
desktop and mobile section state. Store the open section identifier, not four
booleans. Use refs only for trigger focus return, containment checks, and the
existing mobile focus behavior. Any document event listener must exist only
while needed and must be removed in effect cleanup.

Do not add GSAP, Motion, a headless UI dependency, a custom focus-trap package,
or a new icon. The existing directly imported Phosphor `CaretDown` remains the
only dropdown glyph.

## Render impact

- `/`, `/learn`, `/build`, `/product`, `/community`, `/grants`, `/generator`,
  `/careers`, `/disclaimer`, `/services`, `/blog`, and `/newsletter` all share
  the marketing layout. Their navigation HTML and client behavior change, but
  their page content, data access, metadata, and render modes must not change.
- `/` intentionally changes from flat nav links to disclosure buttons and
  hidden descriptive panels. This is the user-approved exception to the
  landing page's byte-stability rule. Its closed-state rendered pixels outside
  the nav must remain identical, and its hero, sections, footer, and motion
  output must remain unchanged.
- `/community` remains the only database-reading marketing destination in this
  set and retains its current render behavior. The dropdown must not read or
  pass its data.
- `/generate`, `/library`, and `/account` receive incoming links but their app
  shell, auth enforcement, route output, and render behavior do not change.
- `/sign-in`, `/sign-up`, and `/g/[id]` do not use the marketing `Nav` and must
  remain unchanged.

Verify render modes from the production build route table rather than assuming
them from this prompt.

## Trust boundary

The browser supplies only local pointer and keyboard events and chooses a fixed
route from a closed module-scope list. There is no request body, user-authored
text, dynamic href, form, mutation, server action, or route handler. Protected
destinations continue to authenticate and authorize independently on the
server. A rejected protected navigation follows the existing Clerk behavior;
the dropdown does not implement or bypass it.

## Secrets and data

No environment variable is added or read. No `NEXT_PUBLIC_*` variable is
introduced. The change stores, logs, transmits, or persists no user data,
prompt, account id, generation record, pointer position, or navigation history.
Do not add analytics or local storage.

## Files

Create:

- no source or asset file beyond this approved prompt.

Modify during implementation:

- `components/sections/Nav.tsx`
- `design-system.md`, extending §2.1 with the dropdown information architecture,
  dimensions, desktop and mobile behavior, accessibility semantics, and the
  explicit statement that no motion row or token was added.

Do not modify:

- `app/globals.css`, `lib/z.ts`, `package.json`, `next.config.ts`, or any route
  file;
- `app/(marketing)/page.tsx`, `app/(marketing)/layout.tsx`, or any application,
  generation, sign-in, or sign-up layout;
- `components/sections/Hero.tsx`, `Features.tsx`, `Stats.tsx`, `Gallery.tsx`,
  `LogoWall.tsx`, or `Footer.tsx`;
- anything under `components/motion/`, `components/brand/`, `components/app/`,
  `lib/db/`, `lib/ai/`, `lib/storage/`, `lib/auth/`, `lib/validation/`, or
  `drizzle/`;
- `docs/backend.md`, because this adds no server or provider behavior;
- any existing prompt or asset file.

## Non-goals

- No new route, route slug, page copy, metadata, footer destination, social
  link, or generated content.
- No mega menu, full-width desktop overlay, nav redesign, sticky header,
  breadcrumb, command palette, search field, notification surface, or nested
  submenu.
- No new feature claim, statistic, testimonial, external URL, provider, data
  query, auth rule, or backend mutation.
- No new token, raw component hex, font, icon family, gradient, radius, shadow,
  blur, z-index level, or dependency.
- No new automatic motion, opening tween, stagger, caret rotation, or
  `design-system.md` §3 row.
- No restyling of the finished landing sections or the authenticated app shell.

## Constraints

- One dark theme from start to finish.
- Violet identifies and lime acts. The panel uses neutral surface tokens;
  violet is never a button fill, and lime remains the focus/action accent.
- Every surface uses the documented radius scale. The dropdown uses
  `--r-panel`, not the gallery-only square-corner exception.
- Zero visible em-dashes or en-dashes. Zero exclamation marks. No invented
  numbers or uncommitted product claims.
- Every keyboard stop retains the global 2px lime focus ring at 2px offset.
- Desktop navigation remains one line and 72px tall.
- Native buttons control disclosure state; native `next/link` anchors navigate.
  Do not misuse ARIA menu roles.
- Static arrays and records live at module scope. No inline component
  definitions, global mutable state, or duplicated per-item booleans.
- Direct icon imports only. Continue importing `CaretDown` from
  `@phosphor-icons/react/dist/ssr/CaretDown`.
- The implementation must not add a client-side fetch, a server fetch, a
  database read, or a secret import.

## Verification

Run and report exact output for:

1. `npm run lint`.
2. The environment-absent production build documented in
   `docs/automation.md`: move `.env.local` to `.env.local.bak` if present, run
   `npm run build`, and restore it even if the build fails.
3. Read the production route table. Verify every existing route retains its
   previous render mode and no route was added or removed.
4. Use the established landing-output comparison from `docs/automation.md` and
   inspect its raw difference. The nav HTML is intentionally different, so do
   not report `IDENTICAL`; prove that the visible server-rendered page content
   outside the nav and the closed nav's labels remain unchanged.
5. Compare the closed signed-in nav against the supplied screenshot at its
   native viewport, then inspect the closed nav at `lg` and 1440px. Confirm the
   bar remains 72px, one line, transparent, and pixel-stable in label placement.
6. Open every desktop dropdown by pointer hover, click, Enter, and Space. Verify
   one panel at a time, no hover gap, correct toggle behavior, outside-click
   close, route-selection close, no horizontal overflow, and correct right-edge
   alignment for Community.
7. Traverse the desktop nav using Tab and Shift+Tab. Verify trigger
   `aria-expanded` values, unique `aria-controls` relationships, logical link
   order, visible focus at every stop, Escape close, and focus return to the
   active trigger. Confirm ordinary links retain ordinary link semantics.
8. Exercise the full-screen mobile dialog at representative narrow and short
   viewports. Verify one expanded section at a time, vertical scrolling, all
   descriptions readable, final auth controls reachable, destination selection
   closes the dialog, Escape and close-button behavior remain intact, body
   scroll restores, and focus returns to the hamburger.
9. Exercise signed-out and signed-in Clerk states. Preserve `Sign in`, `Try
   Free`, `Generate`, and `UserButton`; verify protected destination behavior is
   unchanged.
10. Visit every dropdown destination. Confirm the path, title, and description
    match current committed behavior, no 404 occurs, and no menu description
    promises unavailable content.
11. Inspect every new visible and accessible string for an em-dash, en-dash,
    exclamation mark, invented statistic, vague hype, or inaccurate feature
    claim.
12. Search the diff for raw hex, arbitrary z-index utilities, `role="menu"`,
    new dependencies, animation utilities, and edits outside the approved file
    list.

There is no typecheck script or test runner in `package.json`; do not claim or
invoke either. The landing comparison and route-table procedures are already in
`docs/automation.md`, so this task does not add another automation entry unless
implementation reveals a genuinely repeated uncaptured procedure.

Record the finished visual and interaction contract in `design-system.md`, not
`AGENTS.md` or `docs/backend.md`. After every check passes, commit the complete
implementation to `main` without pushing.

## SKILLS USED

- `design-taste-frontend` - preserve the existing brand and information
  architecture, calibrate the compact disclosure pattern, and run the
  navigation, accessibility, color, shape, copy, and motion pre-flight.
- `frontend-design` - make route descriptions useful and specific while
  extending the studio-console language instead of introducing a generic mega
  menu.
- `vercel-react-best-practices` - keep static records at module scope, avoid
  inline components and unnecessary state, clean up event listeners, preserve
  direct imports, and prevent client bundle growth.
