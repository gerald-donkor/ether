# 024 — Feature media pills become non-interactive lockups

## Scope, and why it is next

Turn the two `YOUTUBE` and `PODCAST` ghost pills in the left feature card from
`<a href="#">` into non-interactive visual lockups, so that no element on `/`
points at `#`.

**Why it is next.** Build steps 1–11 of AGENTS.md §5.2 are all committed
(`a367b09`, `4c5b9f7`, `2389ddf`, `2b612af`, `8ed5482`, `754ddbf`, `813c477`,
`ed8e75b`, `fa4747e`, `2e1441e`, `02c4afa`, `2fb7ea4`). Steps 12–14 are phase
three and none may be started without a decision from the user. The only
remaining work in the approved sequence is phase one's stated end condition,
which is not yet met:

> **Phase one — the site stops lying.** Every dead link and the dead form become
> real. At the end of phase one, nothing on the landing page points at `#`.

`grep -rn 'href="#"' components/ app/` returns exactly two hits, both in
`components/sections/Features.tsx` (lines 28 and 37). The dead form was made
real by step 1; these two pills are what is left.

**The resolution is already decided by the design system, not by this prompt.**
`design-system.md` §2.10 last paragraph:

> Footer destinations use real internal links; unverified social accounts remain
> non-interactive visual lockups until verified URLs exist.

Ether has no verified YouTube channel and no verified podcast. A URL invented
for either is a fabrication (AGENTS.md content conventions, §12 rule 7), and a
new internal route for a third-party channel invents a destination the product
does not have. The already-recorded rule applies unchanged: they become
lockups.

## Reference material read for this

| path / section | what it supplied |
|---|---|
| `AGENTS.md` §5.2, phase one preamble | the end condition this prompt closes |
| `design-system.md` §2.10, final paragraph | the binding rule: unverified social accounts are non-interactive lockups |
| `design-system.md` §2.2 | the ghost variant table row naming `YOUTUBE`, `PODCAST` as its use |
| `design-system.md` §2.4 | "Left card ends in two ghost pills" |
| `design-system.md` §6.8 | focus is visible at every stop |
| `components/sections/Footer.tsx:56–65` | the **existing implementation** of the same rule: a `<span aria-hidden="true">` per icon, under the comment `{/* Verified account URLs are required before these become links. */}` |
| `components/sections/Features.tsx:27–46` | the two pills, their classes, and their Phosphor icons |
| `components/ui/Button.tsx` | `base`, `variants.ghost`, and the `ComponentPropsWithoutRef<"a">` signature |
| `app/(generation)/g/[id]/page.tsx:134,142` | the two **real** `variant="ghost"` links, which is why the variant stays |

## What the implementation must hit

1. **The static rendered paint of `/` does not change at any breakpoint.** The
   pills keep their fill, hairline border, radius, padding, type size, tracking,
   uppercase transform, gap, icon size, icon weight and icon colour exactly.
   Verified by screenshot comparison, not by eye — procedure below.
2. **Neither pill is in the tab order**, because neither does anything. This is
   the one intended behavioural change and it does not weaken §6.8: that
   invariant is about interactive elements, and after this change these are not
   interactive.
3. **The visible words `Youtube` and `Podcast` stay in the accessibility tree.**
   They are real visible text. Only the decorative icons carry `aria-hidden`,
   exactly as `Footer.tsx` does. Do not `aria-hidden` the whole pill.
4. **No affordance that lies.** The lockup drops `hover:border-text-3`,
   `active:scale-[0.98]` and `transition-transform` — a hover or press response
   on something that cannot be pressed is a false affordance. Resting paint is
   unaffected; this changes hover and active states only, and that is intended.
5. **One source of truth for the pill's classes.** The lockup must not
   copy-paste `variants.ghost`'s class string. Extract the shared static
   half in `components/ui/Button.tsx` and have both compose from it, with the
   constraint that **`<Button variant="ghost">`'s rendered class list is byte
   identical to what it renders today** — `/g/[id]` depends on it.
6. **`variant="ghost"` is not removed.** It is still used by two real links on
   `/g/[id]`. Removing it is out of scope and would be wrong.
7. **The lockup carries the same comment the footer carries**, naming the
   condition that would turn it back into a link.

## Render impact

- **`/`** — the only route whose HTML changes. Two `<a href="#">` elements become
  two non-interactive elements. **Static visual output must be identical**;
  render mode is unchanged (whatever `/` is today, it stays). This is the
  deliberate, approved exception to §8.1's "leave its rendered output
  identical", agreed before the prompt was written, and it is confined to these
  two elements.
- **`/g/[id]`** — must not change at all. It shares `Button`, and the class
  extraction is the risk. Verify its ghost links still render identically.
- Every other route — no change. `Features` is rendered only by
  `app/(marketing)/page.tsx`.

**Trust boundary:** none. No request path, no input, no session read.
**Secrets and data:** none. No environment variable is read; no user data is
stored, logged or transmitted.

## Non-goals

- **No new route.** A `/youtube` or `/podcast` page would be a destination the
  product does not have, and §2.10 already rejects that shape.
- **No external URL**, invented or guessed, for either platform.
- **No removal of the pills.** They are artboard elements
  (`prompts/001-landing-page.md` §4) and the reference is 1:1.
- **No relayout, no retypesetting, no token change**, and no new palette entry —
  `--youtube` stays reserved for the lockup exactly as §1.1 has it.
- **No motion.** `design-system.md` §3 gains no row, because this adds no
  animation and removes two transitions.
- **No change to `Footer.tsx`, `Nav.tsx`, or the right feature card's
  `PromptField`.**
- **No phase-three work.** Steps 12–14 stay unstarted.

## Files

**Modify**

- `components/sections/Features.tsx` — the two pills become lockups.
- `components/ui/Button.tsx` — extract the shared static pill classes so the
  lockup and the ghost variant cannot drift. `Button`'s public API and its
  rendered output are unchanged.
- `design-system.md` — amend §2.2's ghost row (its `Use` column currently names
  `YOUTUBE`, `PODCAST`, which will no longer be true; the real ghost links are
  on `/g/[id]`) and §2.4's "Left card ends in two ghost pills", and record the
  lockup under the §2.10 rule it follows. Per AGENTS.md §12 rule 8, this
  correction lands in the same change, not later.
- `docs/automation.md` — see checks.

**Create** — none, unless the lockup is cleaner as its own small presentational
component; if so it lives in `components/ui/` beside the existing primitives and
introduces no second design system.

**Delete** — none.

**Must not touch** — `app/globals.css`, `lib/z.ts`, `components/motion/*`,
`components/brand/*`, `Hero`, `Stats`, `Gallery`, `LogoWall`, `Nav`, `Footer`,
`components/ui/PromptField.tsx`, anything under `lib/db/`, `lib/ai/`,
`lib/auth/`, `lib/storage/`, `drizzle/`, and every route outside `/`.

## Checks

1. `npm run lint`
2. `npm run build` — and diff the route table against the current build's. It
   must be unchanged; no route is added or removed and no render mode moves.
3. `npm test`
4. **Screenshot comparison of `/` at `sm`, `md` and `lg`, before and after**,
   confirming the two pills are pixel-identical at rest and that the hero drift,
   beads, drips, marquees, spiral and count-up are all still running (AGENTS.md
   §8.1).
5. **Keyboard traversal of `/`** — confirm the two pills are no longer tab
   stops, that every remaining stop still shows the 2px lime ring, and that no
   other stop was lost.
6. Confirm `grep -rn 'href="#"' components/ app/` returns nothing.
7. Load `/g/[id]` for an existing generation and confirm its two ghost links are
   unchanged and still focusable.

**This is the second time screenshot comparison of `/` across breakpoints has
been worked out by hand** (AGENTS.md §3 names it as still uncaptured, done once).
So this change must add the command to `docs/automation.md`, in the same commit,
alongside the existing route-table comparison entry.

**Where the result is recorded:** `design-system.md`, per AGENTS.md §8.5 — this
is site work, not backend work. Nothing about it goes in `AGENTS.md`; it adds no
index row and no new site-wide invariant, because §2.10 already carries the rule
this change obeys.

## SKILLS USED

- **`vercel:nextjs`** — Next 16 App Router conventions; confirms nothing about a
  Server Component marketing surface changes when an anchor becomes a span, and
  that no route or metadata convention is affected.
- **`design-taste-frontend`** — the visual judgement call that a non-interactive
  lockup must not keep hover and press affordances, and must still read as a
  deliberate brand element rather than a disabled button.
- **`frontend-design:frontend-design`** — same surface, for the resting
  appearance staying exactly as the artboard has it.
- **`web-design-guidelines`** — accessibility review of the result: removing a
  tab stop, keeping the visible label in the accessibility tree, `aria-hidden`
  on decorative icons only, and no `role` or `tabindex` added to something
  non-interactive.

**Not available in this workspace, and named so the omission is not silent:**
AGENTS.md §1 step 2 lists `tailwind-4-docs` for styling work, but **no Tailwind
skill appears in this session's skill listing.** The Tailwind 4 classes used
here are all already present in `Button.tsx` and `Features.tsx` and are being
recomposed, not authored, so nothing new is written from memory — but no
Tailwind skill was loaded, and the class extraction must be verified by the
build and the screenshot check rather than assumed correct.
