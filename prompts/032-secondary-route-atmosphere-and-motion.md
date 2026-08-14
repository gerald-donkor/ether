# 032 - Secondary route atmosphere and motion

## Scope, and why it is next

Every route on the site **except `/`** currently renders as unlit type on flat
`--ink`. The user's screenshot of `/product` is the evidence: a 1440px viewport
showing a nav, a band of empty black, and a photograph, with no colour, no
atmosphere and no motion anywhere on the page. Eleven public marketing routes,
five signed-in surfaces and two auth screens are all in that state, while `/`
carries a violet hero wash, an ambient arc, two marquees, a physics simulation
and a live photograph.

This is not a build-sequence step. It is a **direct user request**, and it
overrides the sequence under `AGENTS.md` §1 rule 1: *"make the other pages
colorful, beautiful, animated and motion driven."* Phase-one and phase-two work
is complete through prompt 031, so no step is being skipped to reach it.

**Two explicit user decisions were taken before this file was written**, and
both are deviations that the workflow requires be named rather than absorbed
silently:

1. **Scope is every route page except the homepage**, asked and answered
   directly. That includes the signed-in surfaces, which `design-system.md` §2.8
   currently specifies as motion-free.
2. **One new gradient token, `--grad-page`, is approved**, composed only from
   hexes already in §1.1. `design-system.md` §1.2 says "Four, and only four" and
   becomes five in this change. **No new colour enters the palette**, and the
   two-accent lock (§6.2) is untouched: lime remains action-only and violet
   remains identity-only.

### The finding that shapes the whole approach

`--violet-deep` (`#832BC1`) and `--magenta` (`#F452FF`) are recorded in §1.1 as
"Gradient partner for atmosphere only" and are **used nowhere in the
codebase**. Verified:

```
grep -rn "violet-deep\|magenta" app components   # only app/globals.css, the @theme declaration
```

Two thirds of the system's atmospheric range has never been spent. The pages
therefore do not need new colour to stop reading as black documents; they need
the colour the system already owns to actually appear on them.

## Reference material read for this prompt

| source | what was taken from it |
| --- | --- |
| `/home/gdk26/Pictures/Screenshots/Screenshot_20260814_202526.png` | the reported defect: `/product` at desktop, flat `--ink`, image leading, no atmosphere |
| `design-system.md` §1.1 | the palette, and the unused atmosphere-only role of `--violet-deep` and `--magenta` |
| `design-system.md` §1.2 | the four gradients, each "one site of use"; the token this change adds is the fifth |
| `design-system.md` §1.4, §1.5, §1.6 | containers, the radius scale, and "there are no drop shadows on this page" |
| `design-system.md` §2.8 - §2.12 | the existing families for the app shell, the marketing information routes, the footer routes, the artefact record and the library, each of which says "no motion" or "no row in §3" |
| `design-system.md` §3 | the motion table and the reduced-motion paragraph this change extends |
| `design-system.md` §5.1, §5.2, §6 | the earned deviations, the binding rules, the non-negotiables |
| `app/globals.css` lines 45-70, 116-187 | the `@theme` tokens, the four gradient custom properties, `.text-grad-stat`, the `reveal-in` keyframe, `.reveal`, `.hero-in` and the reduced-motion block |
| `components/motion/LogoMarquee.tsx` | the house GSAP pattern this change copies exactly: module-scope `registerPlugin`, `useGSAP(fn, { scope })`, `gsap.matchMedia()`, named condition, `mm.revert()` cleanup |
| `components/sections/Hero.tsx:26`, `Stats.tsx:26` | how `--grad-hero` and `--grad-arc` are applied today, at `z.atmosphere` behind content |
| `lib/z.ts` | `atmosphere: 0`, the level the wash uses; no new level is added |
| `app/(marketing)/product/page.tsx` and the other sixteen route files | the current state of each family |
| `node_modules/gsap/ScrollTrigger.js` | confirmed present in the installed gsap 3.15; ScrollTrigger is not registered anywhere in the repo today |
| `docs/automation.md` §"Prove the landing page's output did not change" (line 85) | the verification command for the `/` invariant |

## Non-goals, and why

- **`/` is not touched.** Not its markup, not its render mode, not one byte of
  its prerendered HTML. It is verified, not assumed (see Checks).
- **No page is reshaped into a shared template.** `design-system.md` §6.5 says
  layout families do not repeat, and this repository has thirteen distinct ones
  across §2.8 - §2.12 and §2.9 - §2.10. This change adds an atmosphere and
  motion layer **over** those families. It does not turn any page into a card
  grid, a hero clone, or another image-plus-text split. If a page's structure
  looks wrong after the wash lands, that is a separate prompt.
- **No third marquee region.** §5.2 is binding and unchanged: the gallery on two
  axes and the logo wall on one. Nothing here translates a strip of repeating
  content.
- **No new colour, no second design system, no component library.** Only
  `components/ui/` primitives.
- **No new z-index level.** `z.atmosphere` already exists for exactly this.
- **No new statistic, count, date, price or claim.** §12 rule 7. Nothing here
  renders a number.
- **No shadow.** §1.6 - depth comes from fill value and the ambient glow.
- **No content, copy or route change.** Every heading, paragraph, label and link
  destination stays exactly as committed. This is a presentation layer.
- **No change to any Server Action, query, schema, or the generation write
  path.** `/account/export` and `/api/stripe/webhook` have no UI and are out of
  scope entirely.
- **Not `priority` on any image.** The macaw on `/` remains the only one.

## Render impact

**Every route below already renders in the mode it will keep.** The wash is a
static server-rendered element and the motion components are client leaves;
neither reads a request, a cookie, a session or the database, so **no route
changes from static to dynamic or back**. This must be *verified* against the
route table, not assumed - `docs/automation.md` §"Compare a build's route table
across a change" is the command.

| route | change | mode |
| --- | --- | --- |
| `/` | **none. Byte-identical output required** | unchanged |
| `/learn`, `/build`, `/product`, `/community` | wash, masthead stagger, scroll motion | unchanged |
| `/grants`, `/generator`, `/careers`, `/disclaimer`, `/services`, `/blog`, `/newsletter` | wash, masthead stagger, scroll motion | unchanged |
| `/generate`, `/account`, `/library` | wash and masthead stagger only, restrained tier | unchanged |
| `/g/[id]`, `/g/[id]/report` | wash and masthead stagger only, restrained tier | unchanged |
| `/sign-in`, `/sign-up` | wash only | unchanged |

## Trust boundary

**None.** This change adds no request path, no form, no action, no route
handler and no query. Nothing crosses from the browser to the server that did
not already. The components added read no session, no `searchParams`, no
`headers()` and no `cookies()`.

## Secrets and data

**None.** No environment variable is read, added or removed. No user data is
stored, logged or transmitted. The wash is decorative geometry driven by a CSS
custom property; the motion components read only element bounds and the
`prefers-reduced-motion` media query. No module in this change imports from
`lib/db/`, `lib/ai/`, `lib/storage/` or `lib/auth/`, and none needs
`server-only`.

---

## What to build

### 1. The `--grad-page` token

In `app/globals.css`, alongside the existing four in `:root`. **Every hex in it
must already appear in §1.1** - `#6843EC`, `#832BC1`, `#F452FF`, `#0A0A0A`.
Lime is excluded on purpose: lime marks the thing you act on (§6.2), and a
page-wide wash is not clickable.

The token defines the *ramp*; the per-route variation is the **position and
angle**, supplied as separate custom properties so one gradient serves every
route without a second definition:

```css
/* 5. Page atmosphere - the ambient wash behind every route except `/`.
      The hero wash is the masthead's alone (see 1.2) and is never repeated;
      this is quieter, positionable, and carries no lime. */
--grad-page: radial-gradient(
  var(--page-wash-size, 90% 70%) at var(--page-wash-at, 50% 0%),
  ...
);
```

Resolve the exact stops and opacities during implementation by **measuring
against the built page**, not by eyeballing: the wash must be clearly present
at 1440px and must never lift the ground above the contrast the type needs.
`--text-3` on the washed ground **must still clear 4.5:1** (§6.6, "contrast is
checked, not assumed") - check the darkest and lightest points of the wash where
`--text-3` type actually sits, and record both figures.

Record the finished token, its stops, and the measured contrast in
`design-system.md` §1.2 as the fifth gradient with its single stated role.

### 2. `components/motion/PageAtmosphere.tsx`

One client leaf, the wash and its drift. It is the only new visual primitive.

- Renders a `pointer-events-none` element at `style={{ zIndex: z.atmosphere }}`,
  `position: fixed`, `inset: 0`, painted with `var(--grad-page)`, behind all
  content. **It must not create horizontal overflow and must not intercept a
  single click or tab stop** - verify by keyboard-traversing a route after.
- A `variant` prop selects from a **module-scope** table of wash positions and
  angles (`vercel-react-best-practices` `rendering-hoist-jsx`), so each route
  gets its own placement from one shared definition. No component defined inside
  a component, no hex literal in the file - only token references and geometry.
- **Motion:** a slow drift of the wash, `transform` and `opacity` only, never
  `width`/`height`/`top`/`left` (§5.2). Follow `LogoMarquee.tsx` exactly:
  `gsap.registerPlugin(useGSAP)` at module scope, `useGSAP(fn, { scope })`,
  `gsap.matchMedia()` with **`"(prefers-reduced-motion: no-preference)"` named
  explicitly**, `return () => mm.revert()`. Under reduced motion **no tween is
  created at all** and the wash renders static at its resting values.
- **Opacity is capped**, in the same spirit as the arc's `opacity <= 0.5`. Pick
  the cap by measurement against the contrast check above and record it.
- Add a `will-change: transform` **only if measurement shows it is needed**.
  `globals.css` currently reserves that for `[data-photo]` alone and says
  "Nowhere else"; if this earns it, amend that comment in the same change (§12
  rule 8).

### 3. Masthead entrance

Every route in scope opens with a heading that currently arrives all at once
after a band of empty black.

- Reuse the **existing `.hero-in` CSS class and its `--i` stagger** in
  `globals.css`. It is CSS-only, needs no client bundle, is already inside the
  `prefers-reduced-motion: no-preference` guard, and already ships the content
  visible. Do not build a JavaScript entrance for something CSS already does.
- Its comment currently reads "The hero is above the fold, so it plays on load
  rather than on scroll." That reasoning applies verbatim to every route
  masthead. **Widen the comment in the same change** rather than leaving it
  describing a narrower scope than the class has (§12 rule 8).
- Give each route **one violet eyebrow** at the §1.3 label role - 12px, 500,
  `0.12em`, uppercase, `--violet`. Eyebrow budget §6.4 is one per three
  sections; these routes are one to three sections each, so one is within
  budget. **The eyebrow states what the page is and invents nothing.**
- On `/product` specifically, the screenshot shows the photograph leading with
  the heading below it. Order the masthead so the page states what it is before
  it shows a picture. This is the one structural correction in this prompt, it
  is confined to that route, and it changes no copy.

### 4. Scroll motion, marketing tier only

The eleven public marketing routes. Two behaviours, no more.

- **Hairline draw.** These pages are built almost entirely from 1px `--line`
  rules, and those rules *are* the structure. Each scales in from its leading
  edge as its section enters, `transform: scaleX` with
  `transform-origin: left`, **scrubbed** to scroll. First ScrollTrigger use in
  the repository: register it at module scope beside `useGSAP`, create triggers
  in top-to-bottom page order, and **never leave `markers: true`** in committed
  code.
- **Image drift.** The four routes carrying a photograph - `/product`,
  `/learn`, `/build`, `/generator` - let it drift within its existing
  `overflow-hidden` frame, scrubbed, transform only. **The frame does not
  move**, so no neighbouring element is displaced and no layout shifts. This is
  the quiet cousin of the hero photo's drift, not a second copy of it: no
  hover magnify, no pointer tracking, no bead layer.
- **Rows use the existing `Reveal`**, not GSAP. It is a server component, the
  reveal is CSS scroll-driven, the content ships visible, and `AGENTS.md`
  forbids converting it to an observer. Use GSAP only for the scrubbed
  behaviours above, which CSS here cannot express.

### 5. Restrained tier: the signed-in and auth surfaces

`/generate`, `/account`, `/library`, `/g/[id]`, `/g/[id]/report`, `/sign-in`,
`/sign-up`.

**`design-system.md` §2.8, §2.11 and §2.12 each state these routes add no
motion. The user has explicitly asked for motion on every route except `/`,
which overrides that under `AGENTS.md` §1 rule 1.** Amend those sections to say
what is now true, and say plainly that the change was requested - do not leave
three sections asserting something the repository contradicts (§12 rule 8).

The override is not a licence to make a working surface restless:

- The wash, at a **lower opacity** than the marketing tier, and the masthead
  stagger. Nothing else.
- **No scrubbed motion, no drift, on any route with a form.** `/generate` is a
  page a user watches while a multi-second model call runs, and §3 already gives
  that wait its own `--grad-arc` rotation inside the reserved result slot. The
  wash must not compete with it, and the result slot's reserved space (§8.2 rule
  6) is untouched.
- **Nothing animates in response to a pending action, a status region, or a
  result.** The `role="status"` regions, focus management and two-step confirms
  across §2.8, §2.11 and §2.12 are behavioural contracts. They are not touched.
- `/sign-in` and `/sign-up` get the wash only. Clerk's components are themed
  through the single `appearance` prop on `<ClerkProvider>` (§7.2) and that
  prop is **not** edited here.

### 6. Record the motion

Every animation needs a row in `design-system.md` §3 with a stated reason, or
it does not ship. Add one row per behaviour - page atmosphere drift, route
masthead entrance, hairline draw, secondary image drift - each naming its real
reason, not a restatement of what it does.

Extend §3's reduced-motion paragraph to list every new behaviour as disabled,
and §5.1 with the deviations this change earns: the fifth gradient, and motion
on the application routes.

---

## Files

**Create**
- `components/motion/PageAtmosphere.tsx`
- one client leaf for the scrubbed marketing motion, in `components/motion/`

**Modify**
- `app/globals.css` - the `--grad-page` token, the widened `.hero-in` comment,
  and the `will-change` comment only if measurement earns it
- the seventeen route files listed in Render impact
- `design-system.md` - §1.2, §2.8, §2.9, §2.10, §2.11, §2.12, §3, §5.1
- `AGENTS.md` - **at most one index row**, and only if warranted. The cap rule
  is explicit: a finished prompt does not grow that file

**Must not touch**
- `app/(marketing)/page.tsx` and every component it renders: `Hero`,
  `Features`, `Stats`, `Gallery`, `LogoWall`, `Footer`, `components/brand/`,
  and the existing `components/motion/` files
- `components/sections/Nav.tsx` and `Footer.tsx` - shared chrome. Changing
  either changes `/`
- `lib/z.ts`, `lib/db/`, `lib/ai/`, `lib/storage/`, `lib/auth/`,
  `lib/validation/`, `proxy.ts`, `next.config.ts`
- any `actions.ts`, `app/api/`, or `app/(app)/account/export/route.ts`
- `.env.local`, and anything under `public/assets/ui/ref/`

## Checks

Run every one and quote its real output (§2, §12 rule 3).

1. `npm run lint`
2. `npm run build`
3. **`/` is byte-identical.** `docs/automation.md` §"Prove the landing page's
   output did not change", line 85. This is the check that decides whether the
   change is correct; a non-empty diff means it is wrong.
4. **Route table unchanged.** `docs/automation.md` §"Compare a build's route
   table across a change" - every route keeps its current render mode.
5. **The environment-absent build** (§2): `mv .env.local .env.local.bak`,
   build, move it back.
6. `npm test`
7. **Contrast, measured not assumed** (§6.6): `--text-3`, `--text-2` and
   `--text` against the washed ground at the wash's brightest point, with the
   figures recorded.
8. **Keyboard traversal** of at least `/product`, `/library` and `/g/[id]`: a
   visible lime ring at every stop, and the fixed wash intercepts nothing.
   `docs/automation.md` §"Confirm a tab stop was removed without walking the
   whole page" (line 164) is the cheaper form of this.
9. **Reduced motion**: with `prefers-reduced-motion: reduce`, confirm no inline
   transform is written by any new component - the same evidence §3 already
   records for the brand block, not a claim that `matchMedia` was used.
10. **No horizontal overflow** at 390px and 1440px on a wash-carrying route.

## Where the result is recorded

`design-system.md`, per §8.5: §1.2 gains the fifth gradient and its measured
contrast; §2.8 - §2.12 are corrected where they currently say "no motion"; §3
gains one row per behaviour with its reason plus the reduced-motion list; §5.1
gains the two earned deviations. **Nothing is recorded in `AGENTS.md` beyond at
most one index row**, and nothing goes in `docs/backend.md` - this change has no
backend surface.

## If something here turns out to be wrong

§12 rule 9: report it, do not route around it. Specifically - if the wash
cannot reach a convincing colour at a contrast the type survives, say so with
both measured figures rather than shipping a wash so faint it changes nothing,
and rather than shipping type that fails. If ScrollTrigger's scrub fights the
existing CSS scroll-driven reveals on the same page, name the conflict instead
of removing `Reveal`.

## SKILLS USED

- `gsap-react` - `useGSAP`, refs, scoping and automatic cleanup for every client
  leaf added here
- `gsap-scrolltrigger` - first ScrollTrigger use in this repository: plugin
  registration, `scrub`, trigger creation order, and no `markers` in committed
  code
- `gsap-core` - `gsap.matchMedia()` with every condition named, easing and
  stagger, and the reduced-motion path that creates no tween
- `gsap-timeline` - sequencing the masthead entrance if the CSS `.hero-in`
  stagger proves insufficient
- `gsap-performance` - transform and opacity only, `will-change` discipline, and
  avoiding layout thrash on a fixed full-viewport wash
- `gsap-utils` - `toArray`, `clamp` and `mapRange` for the wash placement table
- `tailwind-4-docs` - config-less Tailwind 4, `@theme`, and adding a custom
  property in `app/globals.css` rather than a config file
- `design-taste-frontend` - the anti-slop constraints recorded in
  `design-system.md` §5; §9.A's no-glow rule governs how far the wash may go
- `frontend-design:frontend-design` - visual direction for eleven pages that
  must each stay a distinct family
- `web-design-guidelines` - focus visibility, contrast, and reduced-motion
  review of every changed route
- `vercel-react-best-practices` - `rendering-hoist-jsx` for the module-scope
  placement table, `rerender-no-inline-components`, and keeping the client
  bundle to leaves
- `vercel:nextjs` - App Router server/client boundary, so the route pages stay
  Server Components with client leaves beneath them
- `nextjs` docs at `node_modules/next/dist/docs/` - the installed 16.3 behaviour,
  which outranks any skill where they disagree (§1 step 2b)

No skill covers the `--grad-page` colour decision or the per-route wash
placement. Those are measured against the built page and recorded in
`design-system.md` §1.2, per §12 rule 4: a judged value is stated as judged, and
against what.
