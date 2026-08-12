# 002 - Gallery stacked columns scroll vertically (GSAP)

**Status:** proposed
**Depends on:** `001-landing-page.md` (executed), `design-system.md` §2.6, §3, §5
**Touches:** `components/sections/Gallery.tsx`, new `components/motion/ColumnDrift.tsx`, `package.json`, `design-system.md` §3
**Reference:** user screenshot `Screenshot_20260812_143208.png` - the two red-circled columns

---

## Goal

The two stacked columns in the gallery strip - the one holding `48,000` + the Bruges canal photo, and the one holding the turquoise truck + the club crowd - scroll **continuously and vertically**, forever, in opposite directions, while the strip keeps its existing slow horizontal drift. The two single-photo columns (coast, snow) do not move vertically; the contrast between the moving pairs and the still full-height photos is the point.

## Scope

**In:** vertical infinite loop on the stacked columns only, GSAP-driven, seamless (no visible seam or reset), pausing with the horizontal drift on hover, disabled under `prefers-reduced-motion`.

**Out:** any change to the horizontal drift's speed or mechanism, tile content, tile order, the other page sections, ScrollTrigger or scroll-linked behaviour of any kind.

---

## Preconditions

1. Read the relevant guide in `node_modules/next/dist/docs/` before writing the client component. This Next.js is 16.x and diverges from training data.
2. Read `.agents/skills/gsap-react/SKILL.md`, `.agents/skills/gsap-core/SKILL.md` (§ `gsap.matchMedia()`), `.agents/skills/gsap-timeline/SKILL.md`, `.agents/skills/gsap-performance/SKILL.md`.
3. Read `design-system.md` §2.6, §3, §5.2 in full.

## Dependencies to add

```
npm i gsap @gsap/react
```

This supersedes 001's "No GSAP" line. 001 declined GSAP because nothing pinned or scrubbed, and that is still true - nothing here scrubs. GSAP earns its place for a different reason: an infinite, seam-free, pausable transform loop with a single kill switch is exactly what `gsap.matchMedia()` + a repeating tween give, and what `motion`'s declarative API would need hand-rolled state to fake. `motion` stays for everything it already drives; the two libraries do not overlap on any element.

## Deviations to record

| Rule | What we do | Why |
|---|---|---|
| §5.2 / §3 "One marquee per page" | The gallery's columns gain a second axis | It is the *same* marquee, in the same section, in the same slot - one region of the page moves, not two. No other section gains motion. |

Everything else in §5.2 stays binding. In particular: transform only (`yPercent`), never `top`/`height`; reduced motion collapses the vertical loop the same way it collapses the drift.

---

## Mechanism

The loop is a two-pass translate, the same trick the horizontal track already uses, rotated 90°.

Per stacked column, inside the existing fixed-height row:

- The **column** becomes the viewport: `relative overflow-hidden`, keeping its current width classes and its place in the flex row so the horizontal drift is untouched.
- The **inner stack** is `h-[200%]` - twice the column height - laid out `flex flex-col`, holding the column's tiles **twice**: pass A then pass B.
- Each tile is `shrink-0 h-[calc(25%-4px)] mb-1`. Against a `200%` parent that is `(H/2) - 4px` tall with a 4px bottom margin, so one pass of two tiles measures exactly `H` and the full stack measures exactly `2H`. Gaps stay margins rather than flex `gap`, for the same reason the horizontal track does it: two passes must measure exactly twice one pass or the loop shows a seam.
- The tween is `gsap.to(stack, { yPercent: -50, duration, ease: "none", repeat: -1 })`. `-50%` of a `2H` element is `H`, exactly one pass, so frame zero of the repeat is pixel-identical to the last frame.
- Direction is per column: the `48,000` column runs **downward** (`gsap.fromTo(stack, { yPercent: -50 }, { yPercent: 0, ... })`), the truck column runs **upward** (`yPercent: 0 → -50`). Opposing directions read as a living wall rather than a single sliding sheet.
- Duration: 22s upward, 26s downward. Deliberately unequal, so the two columns never re-sync into a lockstep that reads as one block. `ease: "none"` - a marquee that eases is a marquee that stutters.

The second `<Track hidden />` pass renders the same columns again, so **four** stacks animate. They are targeted by `[data-column-drift]` within the component scope, with direction and duration read from data attributes, not from index arithmetic.

## Structure

```
components/motion/ColumnDrift.tsx   new, client component, "use client"
components/sections/Gallery.tsx     stays a server component
```

`ColumnDrift` renders a single `<div ref={scope}>{children}</div>` and nothing else. `Gallery` stays a server component and passes the already-rendered strip through as `children`, so the tiles and the `next/image` markup are still server-rendered - only the ~2kB animation driver ships as client JS.

### `ColumnDrift.tsx`

```tsx
"use client";
// useGSAP handles revert on unmount; gsap.matchMedia handles reduced motion.
gsap.registerPlugin(useGSAP);

useGSAP(() => {
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    tweens = gsap.utils.toArray("[data-column-drift]").map((stack) => { ... });
    // pointerenter / pointerleave on scope.current pause and resume every tween,
    // matching the horizontal drift's hover pause. Listeners are removed in the
    // returned cleanup.
    return () => { /* remove listeners */ };
  });
  return () => mm.revert();
}, { scope });
```

Requirements on the implementation:

- `scope` is passed to `useGSAP`; **no unscoped selector strings** (gsap-react §Do Not).
- `mm.revert()` in cleanup; no `gsap.context()` nested inside `matchMedia` (gsap-core §matchMedia).
- Hover listeners are attached inside the `matchMedia` callback and removed in its returned cleanup, so nothing survives a media-query flip or an unmount.
- `will-change: transform` on the animated stacks only (gsap-performance), via a Tailwind class on the stack, not on the tiles.

### `Gallery.tsx`

- The `Tile` union gains nothing; `COLUMNS` stays at module scope (`rendering-hoist-jsx`).
- `Track` learns to render a stacked column (`column.length > 1`) as `viewport → stack → tiles rendered twice`, and a single-tile column exactly as it does today. Single-photo columns get no wrapper and no attribute.
- The duplicated tiles inside a stack are decorative repeats: `alt=""` and `aria-hidden` on the second pass, on top of the existing `hidden` handling for the whole second `Track`.
- The strip's outer markup is wrapped in `<ColumnDrift>`; the `group` / `motion-safe:animate-(--animate-drift)` / `group-hover:[animation-play-state:paused]` classes stay exactly as they are.

## Accessibility and motion

- `prefers-reduced-motion: reduce` → the `matchMedia` block never runs, no tween is created, the columns render as a static stack showing pass A. Combined with the existing `motion-safe:` on the horizontal drift, the whole strip is still under reduce.
- The vertical loop carries no information - every photo is decorative and the `48,000` figure is legible at rest in pass A, so nothing is hidden from a user who never sees a given frame.
- Hover pause covers the pointer case; the strip has no focusable children, so there is no focus-pause case to answer.

## Verification

1. `npx tsc --noEmit` and `npm run lint` clean.
2. `npm run build` succeeds; confirm `Gallery` still server-renders (the tile `<img>` tags are in the initial HTML).
3. `npm run dev`, open `/`, scroll to the gallery:
   - both stacked columns move vertically, in opposite directions, forever;
   - no seam, jump, or blank gap at the loop point - watch one full cycle of each;
   - the horizontal drift is unchanged in speed and direction;
   - hovering the strip pauses horizontal **and** vertical motion; leaving resumes both.
4. DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` → the strip is completely still.
5. Check 375px, 768px, 1440px: the stacked columns keep square corners, tiles stay edge to edge, nothing overflows the row height.

## Documentation

Update `design-system.md` §3, Gallery row: `Slow horizontal drift, pauses on hover` → note the stacked columns' vertical counter-scroll and its reason (breadth on two axes without a second marquee region). Add the §5.1 deviation row above. The document stays the source of truth; the code does not diverge from it silently.

## Commit

One commit on `main`: `Scroll the gallery's stacked columns vertically with GSAP`. Do not push.
