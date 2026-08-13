# Ether - Design System

Derived from `public/assets/ui/ref/AI Generator.pdf` and `AI Generator.svg` (single artboard, **1440 × 3392 pt**). All measurements below are read 1:1 off that artboard at 72 dpi, so `1pt = 1px` at the desktop breakpoint.

**Design read:** product landing page for an AI image generator, aimed at working creatives, in a *dark studio-console* language - near-black ground, one electric violet and one acid lime, geometric sans set with unusually loose leading. The brief pins the palette and the type; this document records it rather than reinterpreting it.

> **Brief overrides house defaults.** The anti-slop guidance in `.agents/skills/design-taste-frontend` discourages "AI purple" and dark-with-neon-accent as *defaults*. Here violet + lime is the client's named brand direction, not a fallback, so it is followed exactly. The obligation that carries over is execution: one locked accent pair, one radius scale, one theme, no drift.

---

## 1. Foundations

### 1.1 Color

Every hex below is sampled from the reference vector, not invented.

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#0A0A0A` | Page ground. The whole site sits on this. |
| `--ink-raised` | `#0F0F0F` | Footer plate, faint separation from `--ink`. |
| `--surface` | `#19161C` | Card fill (feature cards, prompt panel). Very slightly warm - this is the only warm neutral in the system. |
| `--surface-2` | `#292929` | Input wells, inner fields, hairline fills. |
| `--line` | `#292929` | Borders and dividers at 1px. |
| `--violet` | `#6843EC` | Primary accent. Eyebrows, brand block, gradient origin. |
| `--violet-deep` | `#832BC1` | Gradient partner for atmosphere only. |
| `--magenta` | `#F452FF` | Gradient partner for atmosphere only. Never a solid fill. |
| `--lime` | `#D2FF3A` | Action accent. Primary CTA, `300+ Projects` tile, gradient terminus. |
| `--text` | `#FFFFFF` | Headlines and primary copy. |
| `--text-2` | `#C4C4C4` | Body paragraphs. |
| `--text-3` | `#848895` | Labels, captions, footer links, stat labels. Cool grey - deliberately not a tint of `--surface`. |
| `--youtube` | `#ED1D24` | Reserved. Brand-lockup use only (the YouTube pill). Not part of the palette. |

**Rules**

- **Two accents, locked.** `--violet` carries identity, `--lime` carries action. A lime element is always something you can click. Violet is never a button fill.
- **Text on lime is `--ink`, never white.** `#D2FF3A` on white is 1.3:1 - an automatic accessibility failure. `#0A0A0A` on `#D2FF3A` is 15.9:1.
- **Text on violet is white.** `#FFFFFF` on `#6843EC` is 5.6:1, passes AA for body.
- `--text-3` on `--ink` is 6.3:1 - safe for the small uppercase labels it is used for.
- No section inverts. The page is dark end to end (see §6).

### 1.2 Gradients

Four, and only four. Each has one job.

```css
/* 1. Hero wash - violet bleeding out of the top-left corner into black.
      Anchors the masthead; never repeated elsewhere. */
--grad-hero: radial-gradient(120% 90% at 0% 0%, #4B2FA8 0%, #2A1A5E 28%, #0A0A0A 62%);

/* 2. Stat numerals - violet to lime through sRGB, which passes through a
      desaturated olive-grey mid. That muddy middle is intentional and is what
      makes the numbers read as one continuous run rather than two colors. */
--grad-stat: linear-gradient(90deg, #6843EC 0%, #D2FF3A 100%);

/* 3. Ambient arc - the wide thin ring behind the community section. */
--grad-arc: conic-gradient(from 200deg, #832BC1, #F452FF, #6843EC, #1FBF8F, #832BC1);

/* 4. Brand block - the violet tile holding the abstract mark. */
--grad-block: linear-gradient(135deg, #6843EC 0%, #4322A8 100%);
```

`--grad-stat` is applied with `background-clip: text; color: transparent;` and **must** carry a `color` fallback of `--lime` for `@supports not (background-clip: text)`.

### 1.3 Typography

Two families. Both are on Google Fonts and both ship via `next/font/google` - no `<link>` tags.

| Family | Weights | Use |
|---|---|---|
| **Outfit** | 300, 400, 500, 600 | Everything: display, body, labels, buttons, nav. |
| **Tektur** | 500 | The `Ether` wordmark only. Nowhere else. |

**Outfit** is a geometric sans with a single-storey `a` and circular bowls - verified as the reference face by glyph comparison against the outlined PDF. **Tektur** is a chamfered techno face; its `E`, `t`, `h`, `e`, `r` match the reference wordmark's cut corners exactly.

Tektur is a logotype, not a text face. Do not set navigation, headings, or numerals in it - the temptation to "use the brand font more" is what would break this system.

#### Type scale (desktop, 1440)

| Role | Size / Leading | Weight | Tracking | Color |
|---|---|---|---|---|
| Wordmark | 26 / 1 | Tektur 500 | 0 | `--text` |
| H1 | 60 / 90 *(1.5)* | 400 | `-0.01em` | `--text` |
| H2 (section) | 40 / 58 *(1.45)* | 400 | `-0.01em` | `--text` |
| H3 (card title) | 22 / 30 | 400 | 0 | `--text` |
| Stat numeral | 84 / 1 | 400 | `-0.02em` | `--grad-stat` |
| Tile display (`300+ Projects`) | 30 / 36 | 600 | `-0.01em` | `--ink` |
| Body | 15 / 26 | 400 | 0 | `--text-2` |
| Body small | 13 / 22 | 400 | 0 | `--text-2` |
| Label / eyebrow | 12 / 1 | 500 | `0.12em`, uppercase | `--violet` or `--text-3` |
| Button | 15 / 1 | 500 | `0.02em` | contextual |

**The loose-leading rule.** Display type in this system is set at ~1.45-1.5 leading, not the usual 1.0-1.1 for large text. That airiness is the single most characteristic thing about the reference and it is *not* a mistake to tighten away. A three-line H1 occupies 270px of vertical space on purpose.

**Reference deviation, deliberate:** the reference body copy measures 13px. Body is specified here at **15px** for the main hero paragraph and long-form copy; 13px is retained only for genuinely secondary captions. The reference is a static mock and does not have to be read.

Never set a paragraph wider than `65ch`.

### 1.4 Spacing & layout

4px base unit. Steps: `4 8 12 16 20 24 32 40 48 64 80 96 120 160`.

**Two containers**, both measured from the artboard:

| Container | Width | Used by |
|---|---|---|
| `--container-wide` | **1240px** (100px page gutter) | Nav, hero, hero tile grid, footer |
| `--container` | **1080px** (180px page gutter) | Logo wall, feature cards, stats, gallery heading |

The narrowing after the hero is a real structural move: the masthead is the widest thing on the page and everything below it steps in. Preserve it.

Authenticated application routes use `--container`, not `--container-wide`.
Their compact shell and form-led content are deliberately narrower than the
marketing masthead.

**Section rhythm:** `padding-block: 120px` default, `160px` where a section needs to breathe against the ambient glow (the community/stats block). Hero top padding is `40px` below a `72px` nav - the hero must not float.

**Breakpoints:** `sm 640 · md 768 · lg 1024 · xl 1280`. Full-height regions use `min-h-[100dvh]`, never `h-screen`.

### 1.5 Shape

One radius scale, applied without exception:

| Token | Value | Applied to |
|---|---|---|
| `--r-card` | `24px` | Hero tiles, image cards, brand block |
| `--r-panel` | `16px` | Feature cards, prompt panel |
| `--r-pill` | `9999px` | Buttons, inputs, avatar stack, tags |
| `--r-none` | `0` | Gallery tiles **only** |

The gallery is the one square-cornered surface on the page. That is the documented exception, and it earns itself: the tiles butt edge-to-edge into a full-bleed strip, and any radius would read as a gap.

### 1.6 Elevation

There are no drop shadows on this page. Depth comes from fill value (`--ink` → `--surface`) and from the ambient gradient glow. If a shadow becomes genuinely necessary, tint it violet - `0 24px 64px -24px rgba(104,67,236,0.45)` - never black.

---

## 2. Components

### 2.1 Navigation

72px tall, `--container-wide`, wordmark left, five menu items right with chevrons. Single line at `lg` and above - condense labels before wrapping. Below `md`, collapse to a hamburger with a full-screen `--ink` panel. Transparent over the hero wash; no border.

### 2.2 Buttons

| Variant | Fill | Text | Border | Use |
|---|---|---|---|---|
| Primary | `--lime` | `--ink` | none | `Try Free ↗`, `Generate` |
| Ghost | transparent | `--text` | `1px --line` | `YOUTUBE`, `PODCAST` media pills |
| Nav | transparent | `--text` | none | menu items |

All `--r-pill`. Labels max 3 words and **must not wrap at desktop**. `:active` applies `scale(0.98)`. Focus is a 2px `--lime` ring at 2px offset - visible on every interactive element, no exceptions.

### 2.3 Hero tile grid

The signature composition: five tiles of unequal size in a two-row asymmetric grid - a generated-image card with an overlaid `AI Generator` caption, a lime `300+ Projects` tile, a violet community card with an avatar stack, a violet brand block carrying the abstract mark, and the lime `Try Free ↗` CTA. Cells overlap the row seam rather than aligning to it.

This grid has exactly five cells because there are exactly five things to say. Do not pad it to six for symmetry.

### 2.4 Feature cards

`--surface` fill, `--r-panel`, 32px padding, two-up on `--container`. Left card ends in two ghost pills; right card ends in a live prompt field - a `--surface-2` pill input with a `--lime` `Generate` button inset on the right. Label sits above the input; placeholder is never the label.

### 2.5 Stat block

Split: H2 left, three stacked stats right. Each stat is a `--grad-stat` numeral over a `--text-3` uppercase label. Numbers count up on scroll into view, once.

`10.2M+`, `300+`, `1000+` are the reference's figures. They are marketing claims from the brief - carry them as-is, and do not invent additional precision anywhere else on the page.

### 2.6 Gallery strip

Full-bleed, edge-to-edge, `--r-none`, mixed tile heights, bleeding past both viewport edges. Two tiles are data cards rather than photographs (`48,000 · IMAGES GENERATED BY ARTIFICIAL INTELLIGENCE` in `--lime`), which is what stops the strip from reading as a stock-photo wall.

**The photographs are now substitutable.** One pass of the strip holds five photographic slots, and the section reads the newest public generations into them, newest first, in the order the slots already render: the stacked column's lower tile, the first full-height column, the second stacked column's two tiles, then the last full-height column. Every slot the database does not fill keeps its extracted artboard image and its original alt text, so zero through five public rows all produce a complete strip and the empty case is byte-identical to the artboard build. A missing database or a failed read resolves to the same complete fallback rather than an empty strip or an error.

The fallback rule is exact and the rest of the family is frozen: heading, `48,000` tile position and copy, column order, 4px seams, the 220/280/340px column widths, the 420/520px strip heights, both loop passes and their `aria-hidden` duplicates, and all of §3's motion are unchanged. **The data tile is not a photographic slot and never comes from the database.**

Blob images render through `next/image` under the existing `/generations/**` remote pattern, carry their stored intrinsic dimensions, and set `sizes` to the column widths above. The artboard images deliberately do not gain `sizes`, because that would change the emitted markup of a finished page. No gallery image is `priority`. Because the query does not read prompts, a public image's alt text says only what the application knows and claims no subject.

### 2.7 Footer

`--ink-raised` plate, `--container-wide`. Wordmark plus `Managed by Artificial Intelligence` and a social icon row on the left; two link columns (`ETHER`, `GET CONNECTED`) on the right under `--text-3` uppercase headings.

### 2.8 Application shell

The authenticated shell uses a compact 64px header over `--container`, with the
wordmark left and `Generate`, `Account`, and the Clerk user control right. It
has no marketing footer.

`/generate` is a single form-led column. The title and promoted prompt field
establish the action, followed by a result region and a three-column history
grid that collapses to two columns and then one. Generated-image cards use
`--r-card`; the result panel uses `--r-panel`. The gallery remains the only
`--r-none` surface.

The prompt field on this route carries one unchecked publication checkbox below
the input pill, and the landing page's copy of the same component carries none.
It is a native control with a real label, so it inherits the global lime focus
ring; lime appears only as the checked accent, which is consistent with lime
marking the thing you act on. It adds no motion, no card, and no new token.

**The control row** sits between the input pill and the publication checkbox,
in the same opt-in slot: `PromptField` renders nothing at all when the slot is
empty, so the landing page's markup is unchanged and was verified byte for byte
against a pre-change build. It is three native `<select>` elements, each with a
real `<label>`, for model, size, and image count, followed by one line of plain
text describing the selected model.

**A generation preserves the selection.** React resets the form natively once a
Server Action settles, which would otherwise leave the selects showing defaults
while the page still acted on the previous choice. The controls write their
values back after that reset, so what is displayed is always what will be sent,
and the model and size survive a generation instead of snapping back.

Its values are the existing ones: `--surface-2` ground, `--r-pill`, 13px labels
at the `--text-3` role, 13px control text at the `--text` role, and 16px above
the row on the 4px spacing scale. Being native controls, they inherit the global
lime `:focus-visible` ring and the page's `color-scheme: dark`, so the option
popups need no styling of their own. **No new token, no new radius, no new
colour, and no row added to §3** — the change introduces no motion.

**The result region reserves its slots before the response exists.** It renders
one slot per requested image at the exact aspect ratio the chosen size implies,
computed from the size's width and height, so the image arrives into a box that
was already the right shape. One image fills the column; two or four lay out in
two columns above `sm` and one below. Once images exist, each slot takes its own
stored dimensions rather than the control's. The pending overlay covers the
whole region, as before. This replaces the fixed square reservation, which could
only ever have been right for one of the four sizes.

The status line is unchanged in mechanism and honest about a partial result: it
reports how many images were generated, how many failed, and whether they were
published, through the same `role="status"` node that still takes focus.

### 2.9 Marketing information routes

`/learn`, `/build`, `/product`, and `/community` extend the marketing shell as
four static Server Component routes. They use `--container`, the established
type roles, the 4px spacing scale, and the existing radius tokens. Each route
has a separate reading family: an offset field guide, a horizontal prompt
assembly bench, a sparse capability ledger, and a one-screen editorial
threshold page.

`/community` is the bridge to the landing gallery rather than a second gallery.
Its layout family, artboard photograph, tokens, and spacing are unchanged; its
copy states the actual boundary, which is that a generation is private until
its owner opts one image into the public strip, and its single action links to
`/#gallery-title`. It queries nothing, shows no prompt, and claims no
moderation, curation, profile, or permanence. The real community showcase is
build step 8.

All route photography is reused from `public/assets/ui/img/` as an artboard
visual reference. It is not described as an Ether generation, a product
screenshot, or community work. Images reserve their intrinsic ratio through
`next/image`, set responsive `sizes`, and do not use priority. The pages read no
request state, provider, secret, or user data and add no motion beyond the
existing link hover and button active feedback.

### 2.10 Footer destination routes

`/grants`, `/generator`, `/careers`, `/disclaimer`, `/services`, `/blog`, and
`/newsletter` complete the marketing footer as seven public static Server
Component routes. Their distinct reading families are an asymmetric
availability threshold, a vertical prompt-to-result path, an empty vacancy
board, a narrow document column, a scope boundary rail, an empty editorial
index, and a compact dispatch notice.

The routes state only what the committed product supports. Empty programs,
roles, publications, and subscriptions remain factual empty states with no
invented forms, dates, counts, promises, or external destinations. The public
`/generator` route explains the workflow and links to the protected `/generate`
tool without duplicating it.

Only `/generator` uses an existing artboard photograph, labelled as a reference
and rendered through `next/image` without priority. The other routes rely on
type, spacing, borders, and the established surface token. They read no request
state, provider, secret, or user data and add no motion. Footer destinations use
real internal links; unverified social accounts remain non-interactive visual
lockups until verified URLs exist.

### 2.11 The single artefact record

`/g/[id]` is the permalink for one generation, and it is its own layout family:
the image leads, and everything else is the record beneath it. It is
deliberately not `/generate`'s form-led column, not a grid, and not another
image-plus-text split (§6.5).

The column is capped at 880px inside `--container`. A small `Back to your
images` link sits above a heading at the `clamp(28px,5vw,40px)` role the
history section already uses, so this page's type is one step quieter than
`/generate`'s. **The image panel takes the row's own stored width and height as
its `aspectRatio`**, so the box is the correct shape before the image loads,
exactly as the result slots on `/generate` do. It uses `--r-panel`, matching
that result region, and it is not `priority`.

Beneath it, a two-column definition list on a `120px` label column: prompt,
model, size, created, visibility. Labels take the `--text-3` role at 13px,
values `--text` at 15px on 26px leading. **One hairline above the list rather
than one under every row** - the list is five items, and a rule per row would
read as a spec table. Sizes and dates are real query results; the model line
falls back to the stored id when the registry does not list it.

A second hairline separates the action row: `Download` and `Delete`, both the
existing ghost pill. **The destructive control does not become a new colour.**
Two accents stay locked, so the words carry the weight, and delete is a
two-step confirm in markup rather than a browser dialog: the first press
reveals a plain sentence, a `Delete permanently` and a `Cancel`, moves focus to
the confirm, and returns focus to the opener on cancel. The result is announced
through a `role="status"` node and reads without colour.

`/generate`'s history cards gain a link wrapper to this route. The card keeps
its `--r-card` image box and its two-line caption; the only visible change is
the caption taking the established `--text-2` to `--text` hover transition.

**No new token, radius, colour or z-index level, and no row in §3** - nothing
on this route animates beyond the existing link hover and the button's
`active:scale`.

---

## 3. Motion

Restrained and motivated. Every animation below has a stated reason; anything without one does not ship.

| Moment | Behaviour | Reason |
|---|---|---|
| Hero load | Wordmark → H1 lines → paragraph → tiles, 60ms stagger, 24px rise | Establishes reading order |
| Tile hover | `scale(1.02)`, 200ms | Confirms the tile is a target |
| Stat scroll-in | Count-up + fade, once | The numbers *are* the section's argument |
| Ambient arc | 40s rotation, `opacity ≤ 0.5` | Signals a live/generative system |
| Gallery | Slow horizontal drift, pauses on hover. The two stacked columns also counter-scroll vertically, 22s up and 26s down | Communicates breadth without demanding attention. The second axis gives that breadth depth, and the still full-height photos beside it are what make the movement read |
| Logo wall | Continuous right-to-left marquee, ~60px/s, full-bleed, never pauses | The row's argument is breadth of adoption, and a row that keeps producing new names argues it better than a row of seven that fits on one line |
| Hero brand block | The four marks run as four rigid bodies on a ticker: they travel the tile, bounce off the walls and off each other, and are thrown in proportion to their mass, so the dot is flung and the bolt barely yields. Body contact keeps its permissive radius, while each shape gets a separate rotation-safe visual extent from its runtime bounds. A final containment pass after collision resolution keeps that full extent inside the scaled frame through the complete 1.2° group swing. Each contact squashes both along the impact normal and springs back | The block is the page's one purely decorative tile and the only place the brand mark exists at size, so it is where a brand flourish belongs and the only place it costs nothing to read |
| Hero photo | Rests at `scale(1.08)` and pans its own slack diagonally, 22s yoyo, against a slower 1.08 → 1.11 breath so the two never sync. On hover it magnifies to 1.18 and tracks the pointer, the frame travelling into whatever the cursor is over; the drift pauses and resumes from where it stopped | It is the page's anchor visual and its largest cell, and it was the one still thing left in a hero where everything around it moves. The magnify is what the photograph is for: the eye and the water beads only exist at that size |
| Hero photo beads | A drawn svg layer in the image's own pixel space, cropped by `xMidYMid slice` so it tracks the `object-cover` beneath it, marks twenty-three of the real water beads. Each is three parts: a faint halo, a hard specular core placed where the photograph's own highlight sits, and a thin crescent on the far side, the refracted rim light. Four cycles run per bead, none sharing a period: the core wanders 1 to 2 source units on a 4s to 9s lap, flickers on a 2.6s to 5s cycle, the crescent breathes on 3.7s and the halo on 5.6s. Four of the larger beads creep 2 to 5 units downward over 16s to 25s and are returned while dimmed. Every 1.6s to 2.2s a bead necks, snaps back, and releases a teardrop that accelerates 90 to 160 source units down, stretches, drags a wet streak, flattens as it lands and fades. The layer carries the same `data-photo` transform as the picture, so every mark magnifies and drifts locked to its bead | The beads are baked into the photograph and were the one thing in the hero that reads as wet but could not move. The first attempt at this was invisible: a wide soft glow on `screen` adds nothing over a lit leaf, which is where most of these beads are. Small and bright beats large and faint, so nearly all the brightness now sits in a pinpoint two or three source units across. Four unsynced cycles per bead are what make two dozen marks read as water rather than as animation, and the drip is the event the tile is watched for: one to two drops in flight at any moment, never more than three, none reaching the frame edge or the caption |
| Button `:active` | `scale(0.98)` | Tactile feedback |
| Generation pending | The existing `--grad-arc` turns inside the reserved result slot at `opacity: 0.5` | Makes a multi-second model call legible without shifting the page or inventing a spinner |

The repaired hero brand containment was verified for 63.758 seconds at both
1440 x 1200 and 390 x 844. The browser sampled 3,982 desktop frames and 3,981
mobile frames with zero visible overflow. Every body produced more than 3,600
distinct rendered positions, collision flourishes remained active, and DOM
order changed repeatedly. Under reduced motion, the group, bodies, and flourish
wrappers gained no inline transform before or after the observation window.

Easing: `cubic-bezier(0.16, 1, 0.3, 1)`. Springs only on hover physics.

**Two marquee regions, both ambient** - the gallery on both its axes, and the logo wall on one. `prefers-reduced-motion: reduce` disables the arc rotation, the generation pending rotation, the gallery drift, the logo wall marquee, the brand block simulation, the hero photo drift and its hover magnify, the bead glint wander, flicker, crescent and halo cycles, the bead creep and the drips, and all scroll reveals; the count-up snaps to its final value. What remains on the macaw is the static bloom, held at its resting values, because the shine is a look rather than a motion, and a still bead should still look wet.

---

## 4. Assets

The reference embeds every raster it uses. Extract from the PDF rather than substituting stock:

```
pdfimages -all -j "public/assets/ui/ref/AI Generator.pdf" public/assets/ui/img/ether
```

Needed: the macaw hero image (2310², the page's anchor visual), six gallery photographs, three community avatars, and the partner logos. Partner marks (Brave, Circle, Discord, Google, Jump, Lollapalooza, Magic Eden) should come from Simple Icons as SVG in a single white tint, not from the raster crops - logo wall only, no category labels beneath.

The `Ether` wordmark and the abstract brand mark ship as inline SVG extracted from `AI Generator.svg`.

---

## 5. Skill constraints in force

From `.agents/skills`. Where the brief and a skill default disagree, the brief wins and the deviation is named here. Everything else is binding.

### 5.1 Deviations the brief earns

| Skill default | What we do | Why |
|---|---|---|
| `design-taste-frontend` §4.2, the LILA rule: violet is discouraged | Violet is the primary accent | The reference names it. §4.2's own override clause applies: execute with intent, one locked palette. |
| §9.A: no neon or outer glows | The ambient arc ships | It is a drawn element of the reference, not decoration added to make the page "feel designed". Capped at `opacity: 0.5`. |
| §9.A: no neon or outer glows | The hero photo's water beads gain a specular shine, and one drips every couple of seconds | The **second** earned exception to §9.A, and the count stops there. The user asked for it explicitly, pointing at the photograph's beads. It is light drawn onto beads already in the reference image rather than decoration invented to make the page feel designed, and it is neutral white on `mix-blend-mode: screen`, so the two-accent lock is untouched and no bead is tinted. The cap has moved: the halo rests at `opacity: 0.18` and the specular core is near-opaque white, because a faint wide wash was simply invisible against a bright photograph. What holds this to a shine rather than a glow is now the **size** of the bright mark, two or three source units across, not its opacity. |
| §8: never ship dark-only | The page is dark-locked | The reference has no light mode. Recorded in §6 of this document as a deliberate lock, not an omission. |
| §9.F: no labels overlaid on images | The `AI Generator` caption sits on the macaw tile | It is in the reference artboard. It is the only image overlay on the page. |
| §5.2 / §3, one marquee per page | The logo wall becomes a second marquee region | The user asked for it explicitly, pointing at the partner row and at the target behaviour in the reference screencast. Per `AGENTS.md` §1 an explicit user request overrides the rule, so the rule is not silently bent: it is retired and rewritten as **two marquee regions, both ambient**. |
| §3, restrained motion: decorative loops do not ship | The hero's brand block simulates its four marks as colliding bodies that traverse the tile and bounce off one another | The user asked for it explicitly, pointing at the block and at the shapes bumping like a bouncy castle. It is **not** a third marquee region: no strip of repeating content translates, so §5.2's *two marquee regions* rule stands unchanged rather than being quietly bent. The §3 row disables it under reduced motion, matching the arc, the drift, the marquee and the reveals. |
| §3, tile hover is `scale(1.02)` | The hero photo tile magnifies to `scale(1.18)` and tracks the pointer | The user asked for a magnify on the hero image specifically, and the photograph is the one element on the page with detail worth magnifying into. The tile itself still does not scale: only the picture inside its fixed frame moves, so the hero grid never shifts and no neighbouring cell is displaced. Every other tile keeps the table's 1.02. |
| §5.2 / §3, one marquee per page | The gallery's stacked columns gain a second axis | It is the *same* marquee, in the same section, in the same slot: one region, two axes, and the section gains no other motion. |

### 5.2 Binding, no exceptions

- **Zero em-dashes** (§9.G). No `-` or `-` in any visible string: headlines, labels, buttons, alt text, captions, metadata. Use a period, a comma, or a hyphen.
- **No pure black or pure white as surfaces** (§9.A). Ground is `#0A0A0A`, not `#000000`.
- **No hand-rolled icon SVG** (§9.E). Phosphor only, one weight throughout. The wordmark and brand mark are brand assets extracted from the reference, which is a different thing from drawing an icon.
- **No div-based fake product UI** (§9.E). The prompt field is a real `<input>`, not a mocked-up screenshot.
- **No `window.addEventListener('scroll')`, no `useState` for continuous values** (§5.D, §3.B). Motion values and `whileInView` only.
- **Animate `transform` and `opacity` only** (§6.A). Never `width`, `height`, `top`, `left`.
- **Two marquee regions, both ambient** (§5). The gallery on both of its axes, and the logo wall on one; see the §5.1 rows. No third region opens.
- **Eyebrow budget** (§4.7): at most one per three sections. Seven sections allow three; we spend one.
- **No three equal feature cards** (§9.C). The feature row is two asymmetric panels, and the hero grid is five unequal cells.
- **Documented z-index scale** (§6.F) in `lib/z.ts`. No arbitrary `z-50`.
- **No invented numbers** (§4.9). Only `10.2M+`, `300+`, `1000+`, `48,000`, all from the reference.
- **Reduced motion collapses everything** (§6.B). Arc, drift, logo wall marquee, reveals, count-up.

### 5.3 Performance rules that bite here

From `vercel-react-best-practices`:

- `bundle-barrel-imports` - import Phosphor icons from `@phosphor-icons/react/dist/ssr/<Icon>`, never the package root. The barrel pulls in the whole set.
- `rendering-hoist-jsx` - static tile and link arrays live at module scope, outside the component.
- `rerender-no-inline-components` - no component definitions inside components.
- `server-hoist-static-io` - fonts and logo data resolve once at module level.
- `rendering-svg-precision` - extracted brand SVGs get their coordinates rounded before shipping.
- LCP target under 2.5s: the macaw is the only `priority` image on the page.

---

## 6. Non-negotiables

1. **One theme.** Dark, start to finish. No light section anywhere.
2. **Two accents.** Violet identifies, lime acts. Nothing else gets introduced.
3. **One radius scale.** §1.5, with the gallery as the single documented exception.
4. **Eyebrow budget.** Uppercase micro-labels at most once per three sections - the `POWERING TOOLS AND INTEGRATIONS…` strip spends one. Section headlines stand alone.
5. **Layout families do not repeat.** Each of the hero, logo wall, feature pair, stat split, gallery strip, and footer is a distinct family. Maximum two consecutive image-plus-text splits.
6. **Contrast is checked, not assumed.** Lime never carries white text. Every label clears 4.5:1 against its actual background.
7. **Loose display leading stays loose.** 1.45-1.5 on H1/H2 is the system, not an oversight.
8. **Focus is always visible.** Keyboard traversal of the whole page shows a lime ring at every stop.

---

## 7. Backend

Clerk owns identity, Neon stores generation records, Vercel Blob stores the
generated images, and Cloudflare Workers AI runs the image model, which
replaced the Vercel AI Gateway on 2026-08-13. Ether does not duplicate Clerk
users in Postgres.

Generation ships with an indexed per-owner count over the preceding hour,
capped at 20 calls. This is a spending floor rather than a distributed limiter;
Upstash is the documented upgrade path in build step 9. The full schema,
migration, action flow, model record, and environment contract live in
`docs/backend.md`.
