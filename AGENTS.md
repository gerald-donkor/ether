# AGENTS.md

You are a **principal-level design engineer, full-stack engineer with several years of experience and AI implementation agent** working on **Ether**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

The same rule binds the rest of the stack. This is **Next.js 16.3 with React 19.2**;
`middleware.ts` is `proxy.ts` here and `headers()` / `cookies()` are async.
**Tailwind CSS 4** is config-less — tokens live in `@theme` in
`app/globals.css` and there is no `tailwind.config.js`. **Clerk, Neon, Vercel
Blob and the Vercel AI Gateway are the chosen providers (§7.2) and are already
provisioned**; each carries a trap that contradicts its own tutorials — read
§7.3 before writing a line against any of them. If an API cannot be verified
from `node_modules/`, a skill, or live docs fetched this session, say so instead
of guessing (§12).

**Sections 5–12 are the product and backend contract** — what Ether is, the
ordered build sequence, architecture, stack, standing rules, data model, the
write-path flow, roles, and the anti-fabrication rules. Read them before writing
any server code. Everything above them is the *site* contract and still applies
in full: the backend is being added to a finished, measured landing page built
from a reference artboard, and nothing below licenses breaking it.

# Project notes — where the detail lives

**This file is the index and the invariants. The build record is elsewhere, and
it is not summarised here — read the file that covers what you are touching,
before you touch it.** Every number in `design-system.md` is sampled from the
reference artboard or measured against a build; none of it is decoration, and a
session that skips the read will re-derive it by hand or silently break it.

| file | covers |
| --- | --- |
| `design-system.md` | the whole site contract: tokens (§1), components (§2), the motion table and its stated reasons (§3), assets (§4), the skill constraints and the deviations the brief earns (§5), the non-negotiables (§6). **Binding.** |
| `prompts/NN-*.md` | the brief each change was executed from, in order. A prompt file is the record of an *intention*, never proof it ran (§12 rule 5) |
| `public/assets/ui/ref/AI Generator.pdf` / `.svg` | the single 1440 × 3392 pt reference artboard every measurement in `design-system.md` comes from |
| `README.md` | how to run the project, and the environment variables it needs |
| `docs/backend.md` | the backend build record: schema column types, migrations, model choice, actions, routes, environment variables, and verified provider details |
| `docs/automation.md` | steps worked out twice by hand and written down as commands: read-only database queries, route-table comparison, the environment-absent build, the client-bundle secret scan |

`docs/automation.md` exists as of 2026-08-13 and §3 says how it grows. Read it
before working out a repeated step by hand.

# Invariants

These hold across the whole site. Each is derived in `design-system.md`, which
owns it; break one only with the user's explicit say-so.

**The landing page is finished work.** `/` was built from the artboard over
nine prompts and is byte-stable. Every later change that touches it must leave
its rendered output identical unless the prompt said otherwise up front and the
user approved it. `components/motion/`, `components/brand/`, `Hero`,
`Features`, `Stats`, `Gallery`, `LogoWall`, `Footer` and `app/globals.css` are
settled surfaces — ask before restyling any of them.

**Two accents, locked.** `--violet` identifies, `--lime` acts. A lime element is
always something you can click; violet is never a button fill. Text on lime is
`--ink`, never white. Nothing new enters the palette, on any page, ever
(`design-system.md` §1.1, §6.2).

**One radius scale**, `--r-card` / `--r-panel` / `--r-pill`, with the gallery's
`--r-none` as the single documented exception. No new surface may claim that
exception (§1.5, §6.3).

**One theme.** Dark start to finish. No light section, no light mode, on any
route (§6.1).

**No raw hex in a component file.** Every colour resolves from a token in
`app/globals.css`, whose source of truth is `design-system.md` §1.1.

**Zero em-dashes in any visible string** — headlines, labels, buttons, alt text,
captions, error messages, empty states, email copy, metadata. Use a period, a
comma, or a hyphen (§5.2).

**No invented numbers.** `10.2M+`, `300+`, `1000+` and `48,000` come from the
reference and are the only figures on the site. A new statistic is a fabrication
unless it is a real query result rendered from the database (§5.2, §12 rule 7).

**Layout families do not repeat.** Hero, logo wall, feature pair, stat split,
gallery strip and footer are each a distinct family, and a new page is a new
family — not another image-plus-text split (§6.5).

**Focus is visible at every stop.** A 2px `--lime` ring at 2px offset, from the
`:focus-visible` rule in `globals.css`. Third-party UI is checked, not assumed
(§6.8).

**Motion discipline.**

- **Every animation has a stated reason in `design-system.md` §3, or it does not
  ship.** Adding a row to that table is part of the change that adds the motion.
- **Transform and opacity only.** Never `width`, `height`, `top` or `left`.
- **No `window.addEventListener('scroll')`, and no `useState` for a continuous
  value.** GSAP tickers, `quickTo`, and `motion/react` values only.
- **GSAP is registered once at module scope** (`gsap.registerPlugin(useGSAP)`),
  driven through `useGSAP(fn, { scope: ref })` with `gsap.matchMedia()`, **every
  condition named**, and `mm.revert()` returned as cleanup. A lone `reduce` query
  never fires for anyone else. No `markers: true` in committed code.
- **`prefers-reduced-motion: reduce` creates no tween at all** — not a tween
  that finishes instantly. `matchMedia` is what makes that true, and it is why
  the reduced-motion path costs no listener and no ticker.
- **`Reveal` is a server component** and the reveals are CSS scroll-driven, so
  content ships visible and nothing depends on a script running. Do not convert
  it to an observer.
- **Two marquee regions, both ambient** — the gallery on both axes, the logo
  wall on one. No third region opens (§5.2).

**`lib/z.ts` is the complete z-index scale.** No arbitrary `z-50` anywhere; a
new stacking level is an edit to that file with a comment saying what it is for.

**Icons are Phosphor, imported from `@phosphor-icons/react/dist/ssr/<Icon>`** —
never the package root, which pulls in the whole set. No hand-rolled icon SVG.
The wordmark and brand mark are extracted brand assets, which is a different
thing (§5.2, §5.3).

**The macaw is the only `priority` image on the site**, and that is a per-page
rule every new page inherits: at most one, and only if that page genuinely has
an LCP image. Every other image sets `sizes` correctly (§5.3).

**This file is capped, and the cap is on the build record — not on the
contract.** It holds the index, these invariants, the workflow, the commands,
the prompt-file contract, and sections 5–12. It does **not** grow with the
build: a finished prompt adds at most one index row here, and everything it
measured or built goes in `design-system.md` or `docs/backend.md`. An invariant
earns its place here only if a session could break it *without* opening the file
that owns it, and a new one replaces or subsumes an existing line rather than
stacking on it.

Sections 5–12 are the exception to the growth rule, because they are what a
session needs *before* it opens any other file — but the same discipline applies
inside them: they carry decisions and boundaries, never the record of what was
built against those decisions. **Column types, DDL, a chosen model id, a
measured latency, a migration's contents, an action's full field list belong in
`docs/backend.md`**, and a step in §5.2 is marked done by the repository and
`git log`, never by editing this file.

# Content and asset conventions

**Imagery comes from `public/assets/ui/img`**, extracted from the reference PDF
rather than substituted with stock (`design-system.md` §4). Partner logos live
in `public/assets/ui/logos` in a single white tint. A new image that is not in
the artboard is either a real user generation served from Blob, or it is a
question for the user — not a stock photograph chosen by the implementation.

**Generated images are user content, not site assets.** They never land in
`public/`, never get committed, and are always served from Blob through
`next/image` with `images.remotePatterns` configured for that hostname.

**Copy is written in the reference's register** — plain, technical, confident,
no exclamation marks, no growth-marketing voice, no hype about AI. The landing
page's existing strings are the model for every new one.

---

# 1. Workflow

For every implementation request:

1. Read `AGENTS.md` and follow its instructions as the highest priority project guidance. `AGENTS.md` is the source of truth for implementation decisions. User requests may override these rules only when the user explicitly requests a deviation, explains why, and the relevant rule is intentionally changed.
2. **Load every skill the work needs — always, at every stage, not only the ones the user names.** Before writing the prompt file *and* again before implementing it, look over the available-skills listing and invoke each skill that owns a surface the task touches: the framework (`nextjs`, `next-cache-components`), styling (`tailwind-4-docs`), the ORM and its migrations (`drizzle-docs`), the database (`neon-postgres`), validation (`zod-docs`), the platform (`vercel:marketplace`, `vercel:vercel-storage`, `vercel:env-vars`, `vercel:vercel-functions`, `vercel:ai-sdk`), motion (`gsap-*`), design work (`design-taste-frontend`, `frontend-design:frontend-design`, `figma:*`) and performance (`vercel-react-best-practices`). **A skill is the verified source §12 rule 2 demands** — writing an API from memory when a skill for it is one call away is the failure this rule exists to prevent. If no skill covers the surface, say so explicitly rather than proceeding silently.
3. Read clearly needed supporting skills.
3b. **Read `design-system.md` before touching anything visual** — §1 supplies every value and §6 is binding — and `docs/backend.md`, once it exists, before touching anything server-side. Working from this file alone means working without the measurements.
4. Inspect only the code, files, and dependencies relevant to the request. Do not inspect, modify, or reason about unrelated parts of the repository unless they directly affect the approved implementation.
5. Ask a focused question only if the task has meaningful ambiguity. Do not ask questions when reasonable assumptions can be made without affecting the implementation outcome.
6. Create a detailed prompt file in `prompts/` per the contract in section 4.
7. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
8. On approval, re-read the approved prompt file in `prompts/` and implement it strictly. Implement only after user approval. Entering "y" or "Y" = `Approved. Execute.`
9. Run available checks (§2), then record what was built in the file that owns the area — `design-system.md` for the site, `docs/backend.md` for the backend (§8.5). **Never in this file**: the only things a finished prompt may add here are one index row, and a site-wide invariant that meets the cap rule above.
10. Share exact steps to test or run the completed feature.
11. Commit the resulting change to `main`, unprompted. Every executed prompt ends in a commit — never leave implemented work uncommitted. Do not push unless asked.

Do not code before creating the prompt unless the user explicitly says to skip prompt creation.

**Why step 11 matters.** Resolving what is already built (below, and on any resume) reads the files on disk and `git log`, never the prompt files. Work left uncommitted makes that resolution wrong and invites a duplicate prompt for a feature that already exists.

**Resuming in a new session.** Entering `I` or `i` = `Work out what comes next and write its prompt file.` It runs steps 1–7 of this workflow and stops at the approval question. It never implements anything — `i` writes the prompt, `y` executes it.

Resolving what "next" means, in a session with no prior context:

1. **The number** is the highest existing prompt number in `prompts/` plus one. Never renumber, never overwrite, never reuse a number (section 4).
2. **The scope** is the next unbuilt step in **§5.2's build sequence**, which is already ordered by what unblocks the most downstream work and states each step's dependency. **There is no separate spec file in this repository** — §5 is the whole product brief, and `ref/ref-agents.md` is a formatting reference from another project, not a source of scope. For site work the scope comes from the user's request and from `design-system.md`.
3. **Establish what is already built from the repository** — the files on disk and `git log` — not from the existing prompt files. A committed prompt file is evidence that a prompt was written, never that it was executed. Writing a prompt for work that already exists is the main failure mode here. **`prompts/009-backend-foundation-and-generator-app.md` is written and, at the time this file was drafted, unexecuted and uncommitted** — check `git log` and the filesystem before assuming either way.
4. **Name the chosen scope and say why it is next in the first line of the reply**, before writing the file, so a wrong call is visible immediately.
5. If two candidates are genuinely equally unblocking, write neither yet — name both, state the trade-off, and ask.

Then finish with step 7's question as written.

# 2. Commands and checks

Scripts that currently exist in `package.json`:

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build
- `npm run start` — run the production build locally after `npm run build`
- `npm run lint` — ESLint
- `npm test` — environment-free moderation parser and validation tests
- `npm run test:db` — moderation and quota integration checks with `.env.local`
- `npm run db:generate` — generate a Drizzle migration from the schema
- `npm run db:migrate` — apply committed Drizzle migrations with `.env.local`
- `npm run db:push` — apply the Drizzle schema with `.env.local` loaded

Report the exact command output; never claim a check passed without running it
(§12 rule 3).

> **Gaps to flag, not to invent.** There is **no typecheck script or test
> runner in `package.json` today.** Anything else is added by the step that needs it
> and this file is corrected in the same change rather than left predicting
> something that did not happen (§12 rule 8). **Never reference a script name
> before it exists.** Because only Next.js auto-loads `.env.local`, any script
> reaching the database or a provider is written as
> `dotenv -e .env.local -- <command>` from the day it is added.

**The build must pass with the environment absent.** `mv .env.local
.env.local.bak`, build, move it back. That is what the lazy `getDb()` in §7.3
exists for, and it is the check that catches a client constructed at module
scope.

# 3. Automation

`docs/automation.md` holds the commands. **Standing instruction:** each session,
watch for steps repeated by hand — screenshot comparison of `/` before and after
a change, extracting a raster from the reference PDF, diffing a build's route
table — and when a step has been worked out twice, add it to
`docs/automation.md` in the same change. The point is that a later session
starts from the command rather than from the investigation.

Still uncaptured, because each has been done only once: screenshot comparison
of `/` across breakpoints, and extracting a raster from the reference PDF.

# 4. Prompt files

Every implementation request gets a file in `prompts/`, written before any code
(§1 step 6) and re-read verbatim at execution time (§1 step 8).

**Numbering.** `NNN-<kebab-case-scope>.md`, where `NNN` is the highest existing
number in `prompts/` plus one, zero-padded to three digits as the existing files
are. Never renumber, never overwrite, never reuse a number — the sequence is the
project's build history, and a gap or a reused number makes "what is already
built" unresolvable in a later session.

**A prompt file must state**, in whatever order the work makes natural:

- the scope, and why it is next;
- the reference material read for it — the artboard, screenshots, source files,
  `design-system.md` sections — by path and section;
- the measurements the implementation must hit, or the procedure that will
  produce them, never eyeballed numbers;
- the expected impact, naming every route whose output must stay identical;
- non-goals — what is deliberately out of scope, and why;
- the files it creates, modifies, deletes, and the files it must not touch;
- the checks to run (§2), and which file the result must be recorded in
  afterwards (§8.5).

**`## SKILLS USED`** — required, in every prompt file. List every skill the
implementation should invoke, by its exact name from the skill listing, with one
line each saying what it is for. Include skills already loaded while writing the
prompt as well as ones only the implementation will need. Write `None` if the
work genuinely needs no skill, rather than omitting the section.

**Why it is required.** The prompt file is the whole brief on execution — after
a `/clear`, an approving `y` is answered by re-reading the file and nothing
else. A skill that was loaded while writing the prompt is not loaded when the
prompt runs, so an unlisted skill is a skill the implementation will silently
work without. Naming them in the file is what makes the run reproducible.

**And listing is not loading.** The section is a manifest, not a substitute:
step 8 re-reads the file and **invokes every skill named in it** before writing
code, exactly as step 2 requires.

**Backend prompts carry three extra headings** (§8 explains each):

- **Render impact** — name every route whose output or render mode changes, and
  why. `none — no existing route changes` is the expected answer for a prompt
  that only adds an action or a table, and it must be *verified*, not assumed.
- **Trust boundary** — what crosses from the browser to the server, where it is
  validated, what authorises it, and what a rejected request returns. If the
  task has no request path, write `none` and say why.
- **Secrets and data** — which environment variables the change reads, which are
  `NEXT_PUBLIC_*` and therefore public, and what user data the change stores,
  logs or transmits.

---

# 5. Product — what Ether is, and what the backend adds

Keep the client in context on every task. **Ether is a text-to-image generator
for working creatives**, sold by a dark studio-console landing page built 1:1
from the reference artboard. The product's whole promise fits in one sentence,
and the landing page already makes it: *type a prompt, get an image, keep it.*

`components/ui/PromptField.tsx` in `components/sections/Features.tsx` is the
promise rendered — a real `<input>` with a real `<label>` and a lime `Generate`
button. It stays inert on the landing page and submits the real generation
action on `/generate`.

**Register is plain and technical.** The site's voice is confident without
hype: no exclamation marks, no growth-marketing verbs, nothing breathless about
AI. Server copy, error messages and empty states match it.

## 5.1 What is already built

The landing route now lives in `app/(marketing)/page.tsx` with its measured
sections intact. Prompt 009 adds the Clerk-protected `/generate` and `/account`
routes, local sign-in and sign-up screens, Drizzle over Neon, Blob storage, and
the AI Gateway generation action. The detailed build record is
`docs/backend.md`.

The four marketing nav links and all seven footer links still use `href="#"`.
Those belong to build steps 2 and 3.

**The providers are provisioned**, against the linked Vercel project `ether`
(`.vercel/project.json`), and their variables are present in the gitignored
`.env.local`: Neon (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`), Vercel Blob
(`BLOB_READ_WRITE_TOKEN`), Clerk (`CLERK_SECRET_KEY`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`). The model provider is **Cloudflare
Workers AI**, which is not a Vercel integration and is not provisioned by
`vercel integration`: its `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are
set by hand (§5.3 rule 1, prompt 014). The integration packages are installed
and wired by Prompt 009. Read current
provisioning state from `vercel env ls` and `vercel integration list`, never
from this paragraph (§12 rule 5).

## 5.2 The build sequence

**This is the order, and the dependency column is why.** One step is one prompt
file unless it says otherwise. A step is "done" when its work is committed —
resolved from the repository and `git log`, never from this list and never from
`prompts/` (§1). Do not tick anything here; the file records the plan, not the
progress.

> **Citation convention, and it matters — the numbers collide.** Build steps run
> 1–14, sections run 1–12, `design-system.md` has its own §1–§6, and prompt
> files are a fourth sequence again. **`§N` always means a section of this file;
> "step N" always means a row of the tables below; a `design-system.md` section
> is always written with the filename.** Prompt-file numbers do **not**
> correspond to build steps — `prompts/009` implements step 1.

### Phase one — the site stops lying

Every dead link and the dead form become real. At the end of phase one, nothing
on the landing page points at `#`.

| # | step | depends on | render impact |
| --- | --- | --- | --- |
| 1 | **Backend foundation and the generator app** — Drizzle over Neon, Clerk identity, `proxy.ts`, the `(marketing)` / `(app)` route groups, the generate server action, `/generate`, `/account`, and the sign-in and sign-up screens. Drafted in full at `prompts/009-backend-foundation-and-generator-app.md` | — | `/` moves into `(marketing)` and **its output must not change**. New dynamic routes only |
| 2 | **The four nav routes** — `Learn`, `Build`, `Product`, `Community`, each a new layout family assembled from existing primitives, not a new design language | 1 — they need the app shell and the nav's auth state | four new static routes; `Nav`'s `LINKS` gain real `href`s |
| 3 | **The seven footer routes** — `Grants`, `Generator`, `Careers`, `Disclaimer`, `Services`, `Blog`, `Newsletter`. Several are thin by design; a one-screen honest page beats an invented one | 1 | seven new static routes; `Footer`'s `COLUMNS` gain real `href`s |
| 4 | **The gallery strip, backed by real generations** — the opt-in `public` flag on a generation, the curation rule, and the strip reading from the database instead of the extracted artboard rasters, with the artboard images as the fallback when there is nothing to show | 1, and 2 for `Community` to link into | `/`'s gallery becomes dynamic or ISR — **the only step in phase one that changes the landing page's render mode**, and it needs its own render-impact argument |

**Step 1 is the load-bearing one.** It sets the write path every later mutation
copies (§10), the auth pattern every later protected route copies (§11), and the
data-layer boundary nothing may cross (§6.2). Get it right slowly rather than
getting to step 4 quickly.

### Phase two — the generator becomes a product

**Do not start any of this while a phase-one step is unbuilt.**

| # | step | depends on |
| --- | --- | --- |
| 5 | **Generation controls** — aspect ratio, image count, and an explicit model choice, all validated server-side against a closed list. The model id stops being one constant and becomes a small typed registry in `lib/ai/` | 1 |
| 6 | **The image route** — `/g/[id]`, a permalink for one generation: full-size view, prompt, model, download, delete. Owner-only until step 8 makes sharing real | 1 |
| 7 | **The library** — `/library`, the user's generations with pagination, prompt search, and soft delete. The history grid on `/generate` shrinks to a recent strip that links here | 1, 6 |
| 8 | **Sharing and the community showcase** — a share link for a public generation, and `/community` reading real public work rather than a static page | 4, 6 |
| 9 | **Quotas and real rate limiting** — the existing Neon database replacing step 1's `count(*)` floor with an atomic reservation function, per-account caps, and a usage reading on `/account` | 1, and step 1's temporary count floor |
| 10 | **Moderation and abuse handling** — prompt and output screening on the generate path, a report route on shared images, and a takedown state that hides an image without destroying the record | 8, 9 |
| 11 | **Account and data rights** — generation defaults, export, and account deletion that actually removes the blobs as well as the rows | 7 |

### Phase three — decisions, not schedule

**None of these is approved and none may be started without asking.** They are
recorded so that a session recognises them as out of scope rather than
rediscovering them as good ideas:

| # | step | the decision that gates it |
| --- | --- | --- |
| 12 | **Billing and credits** | generation costs real money per call; a paid tier is a business decision, not an engineering one, and it changes the data model and the auth surface at once |
| 13 | **Image editing** — img2img, inpainting, variations | a second model surface, a second upload path, and a much larger moderation problem |
| 14 | **Teams, or a public API** | multi-tenancy is a rewrite if it arrives late and dead weight if it arrives early. Do not pre-empt it with an organisation column "just in case" |

### Do not overbuild

No second design system. No component library that is not the existing
primitives in `components/ui/`. No separate backend service or API server. No
admin panel. No analytics product, no marketing-automation platform, no
newsletter engine behind the `Newsletter` footer link beyond what step 3 needs.
**No feature that is not a step above** — if it seems necessary, say so and ask
rather than adding it.

**The sequence is a dependency graph, not a schedule.** It says what must exist
before what, and nothing about dates. Every rule in this file applies on every
step regardless of phase.

## 5.3 AI — the product is a model call, and here is where the line sits

Unlike most projects, **the model is the product**: step 1's whole purpose is a
text-to-image call, and there is nothing to justify. The discipline is about
everything around it.

| step | surface | shape |
| --- | --- | --- |
| 1 | prompt → image | one image model through the AI Gateway |
| 5 | the same, with user-chosen aspect ratio, count and model | a closed, typed registry — never a free-text model id from the client |
| 10 | prompt and output screening | classification, and a human-legible outcome |

### The hard rules

1. **Every model call runs through Cloudflare Workers AI, over its REST API with
   a plain `fetch`, from exactly one module in `lib/ai/`.** There is one model
   provider and one place that reaches it; nothing else in the codebase calls a
   model. Authentication is `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`,
   read inside the function and never at module scope. No AI SDK provider
   package (`@ai-sdk/openai`, `openai`, `replicate`, …) is installed for this.

   **This replaced the Vercel AI Gateway on 2026-08-13, at the user's explicit
   request** (§1 rule 1), because the Gateway refuses every request from a team
   with no payment method on file, which made the product unbuildable. Prompt
   014 is the record. The `ai` package stays in `package.json` and the Gateway
   becomes viable again the moment a card is added; reopening that is a
   decision, not a cleanup.
2. **The model id is verified against the provider's live model page before it
   is hardcoded**, never taken from memory, and it lives as a single exported
   constant in `lib/ai/` with a comment saying why it was chosen, so changing it
   later is one edit. The chosen id, its cost and the date it was verified go
   in `docs/backend.md`, not here — model ids and prices move fast enough that
   anything written in this file would go stale (§12 rule 7).
3. **The model never writes site copy, and never produces a number the site
   displays.** The invented-numbers invariant covers model output explicitly.
4. **A user's prompt is their data** (§8.3). It is stored because the product
   needs it and the user expects to see it; it is never logged, never sent
   anywhere the generation itself does not require, and never used as an example
   in the UI without an explicit opt-in.
5. **A failed or refused generation is a handled result**, not a 500 and not a
   thrown provider string (§10 rule 2). The user gets something they can act on;
   the raw provider error goes to the server log, without the prompt.
6. **Generation is metered from the first line.** Step 1 ships a cap even though
   step 9 replaces it, because an unmetered endpoint that spends money per call
   is the single worst thing this codebase can ship.

---

# 6. Backend architecture

## 6.1 Code layers

- **UI** — routes, Server Components, client leaves, forms. Renders data and
  calls Server Actions.
- **Server Actions** — the only mutation path for this app's own forms.
  Validation, authorisation, orchestration. Colocated with the routes that use
  them.
- **Route Handlers** — thin, and for *external* callers only: webhooks, upload
  callbacks, cron endpoints, health checks, and a library's own mount point. No
  business logic.
- **Data** — the query layer in `lib/db/`. Nothing else in the codebase talks to
  the database, and no SQL is written outside it.
- **AI** — the gateway call and the model registry, in `lib/ai/`. Server-only.
- **Storage** — blob upload and read, in `lib/storage/`. Server-only.
- **Auth** — session and ownership resolution. One module; every authorisation
  decision reads from it.

## 6.2 Hard boundaries

- **Server Actions are the only mutation path for the app's own forms.** The UI
  does not mutate through Route Handlers.
- **Only Server Components fetch initial page data.** No client-side
  data-fetching library on primary read paths.
- Database queries, model calls, blob writes and secret reads never run in
  browser code.
- The UI never constructs a query. It calls the data layer or an action.
- **Every mutation authorises server-side, inside the action.** Hiding a control
  in the UI is presentation and never enforcement.
- **Every mutation validates its input server-side with a schema**, even when
  the same schema ran in the browser. Client validation is a courtesy to the
  user; it is not a check.
- **The user id is read from the session on the server, every time.** A `userId`
  arriving from the client is ignored — that is the whole point of reading it
  server-side.
- **Every read of user content filters on the owner in the query itself**, not
  in the component that renders it. There is no "the page is protected, so the
  query does not need to be" (§9 rule 2).

## 6.3 Where the code goes

```
app/
  (marketing)/          Nav + Footer chrome, the landing page and its siblings
  (app)/                the signed-in shell
    <route>/actions.ts  Server Actions, colocated
  api/<external>/route.ts   webhooks, callbacks, library mounts — thin
components/
  brand/  sections/  ui/  motion/     unchanged; the existing primitives
  app/                    the signed-in surfaces
lib/
  db/         schema, client, queries        server-only
  ai/         the provider call              server-only
  ai/catalog.ts  the public model registry   deliberately NOT server-only
  storage/    blob upload and read           server-only
  auth/       session and ownership          server-only
  validation/ shared schemas                 NOT server-only, deliberately
  z.ts        the z-index scale              unchanged
```

Every module under `lib/` that touches a secret carries `import "server-only"`
at the top — the import exists to make a mistaken client import a **build**
error rather than a leaked key at runtime. **`lib/ai/catalog.ts` is the second
exception, approved in prompt 015**: it is pure data with no environment read
and no imports, and the schema, the client leaf and the action all need the same
closed list (`docs/backend.md`). **`lib/validation/` is the other exception and
must stay one**: its schemas are imported by client leaves *and*
by actions, which is what makes "the rules exist once and run twice" true
(§10 rule 1). Nothing that reads a secret may be added to it, and it must not
import from `lib/db/` — a schema module's table definitions have no business in
a marketing page's browser bundle.

---

# 7. Tech stack

## 7.1 Settled

- **Next.js 16.3** — App Router, React 19.2. Server Actions and Route Handlers;
  **no separate backend service.**
- **TypeScript** throughout.
- **Tailwind CSS 4** — config-less, `@theme` in `app/globals.css`.
- **GSAP 3 with `@gsap/react`** for the site's motion, plus `motion/react` where
  it is already used (`components/motion/StatCounter.tsx`). Neither is added to
  a backend surface without a reason in `design-system.md` §3.
- **Vercel** — hosting. Fluid Compute (the default), Node.js runtime.

**Not `runtime = "edge"`.** Fluid Compute runs in the same regions at the same
price with full Node.js, streaming and SSE included. Edge is a downgrade here.

**Cache Components is not enabled** in `next.config.ts`, and no step before 4
enables it. Generation pages are per-user and dynamic; there is nothing there
worth caching. Step 4 is the first step with a real case for it, and it must
argue that case in its prompt rather than switching it on in passing.

## 7.2 The chosen providers

All four are provisioned against the linked project `ether` and their variables
are in `.env.local` (§5.1). **Provisioning state is not tracked in this file
beyond that** — read it from `vercel env ls` and `vercel integration list`
(§12 rule 5).

| need | provider | package | note |
| --- | --- | --- | --- |
| relational data | **Neon Postgres**, via the Marketplace | `@neondatabase/serverless` + **Drizzle** as the ORM | Drizzle owns schema and migrations exclusively |
| identity | **Clerk**, via the Marketplace | `@clerk/nextjs` | resource `clerk-byzantine-curtain`; needed a browser terms acceptance and an explicit `integration resource connect` |
| image storage | **Vercel Blob**, store `ether-images` | `@vercel/blob` | public access, because these are rendered in an `<img>` on a page the user already loaded |
| the model | **Cloudflare Workers AI** | none — REST over `fetch` | authenticated by `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Chosen because its free daily neuron allocation refuses rather than bills, so no card is required. Replaced the AI Gateway on 2026-08-13 (§5.3 rule 1) |
| rate limiting | **Neon Postgres** | existing Drizzle and a PostgreSQL reservation function | step 9 uses durable usage events plus one transaction-level advisory lock. No second service, package, secret, or billing relationship |

`@vercel/postgres` and `@vercel/kv` **no longer exist** as first-party products.
Do not import either; do not reintroduce them from training data.

**Clerk over Better Auth is settled**, and it is settled by the provisioning
that already happened: the resource exists, the keys are in the environment, and
`prompts/009` is written against it. Do not reopen it because a skill or a
training-data instinct prefers another library. The accepted cost is that
Clerk's components must be themed to the design system through the `appearance`
prop, set **once** in `<ClerkProvider>` so the auth screens cannot drift.

## 7.3 The traps these carry

Each of these contradicts what a model writes from memory, and each is one line
away from being hit.

**Next.js 16**

- **`middleware.ts` is `proxy.ts` in Next 16.** Clerk's own documentation still
  says `middleware.ts`. **We follow the framework, not the SDK docs:** the file
  is `proxy.ts` at the repo root, default-exporting `clerkMiddleware()`. A
  `middleware.ts` here is a file the framework never loads — auth would look
  configured and enforce nothing. If `proxy.ts` genuinely does not work, say so
  and fall back with a comment naming the conflict. Never create both.
- **`headers()` and `cookies()` are async.**

**Clerk**

- **`auth()` is async in Core 3** — `const { userId } = await auth()`. Never the
  synchronous form. `auth.protect()` is called directly, not off the return
  value.
- **`proxy.ts` is an optimistic gate, not enforcement.** Every protected page and
  every action re-reads the session itself. This is §6.2 restated.
- **The routing variables are ours to set** — `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
  and `NEXT_PUBLIC_CLERK_SIGN_UP_URL` — in `.env.local` *and* in the Vercel
  project, or the components redirect to Clerk's hosted pages.

**Neon**

- **Two connection strings, and using the wrong one is silent.** `DATABASE_URL`
  is **pooled** and is what the app uses. `DATABASE_URL_UNPOOLED` is **direct**
  and is what **migrations, `pg_dump` and `LISTEN`/`NOTIFY` require** — a
  migration over the pooled URL can fail confusingly or leave a partial apply.
- **Construct the client lazily.** Next evaluates top-level module code during
  `next build`, so a client built at import time against an unset `DATABASE_URL`
  fails the build before any route renders. A plain `getDb()` over a
  module-level `let`.
- **Never wrap the database client in a `Proxy`.** The idiomatic-looking lazy
  `Proxy` breaks any library that inspects the adapter object, and the failure
  is a hang with no error.
- **Nothing but Next.js auto-loads `.env.local`.** `drizzle-kit`, `tsx` and any
  seed or migration script need `dotenv -e .env.local --` in front of them.
- **Scale-to-zero is on.** The first query after an idle period pays a cold
  start. That is expected behaviour, not a performance bug to chase, and any
  latency measurement must say whether it was warm.

**Blob**

- **Blob URLs need `images.remotePatterns` in `next.config.ts`** before
  `next/image` will render one. This is the first thing that breaks.
- `addRandomSuffix: false` with a `crypto.randomUUID()` in the key, so the path
  is unguessable without being unpredictable to us.

**Cloudflare Workers AI**

- **Verify the model id against its live model page.** A model name from memory
  is the exact failure §12 rule 2 exists to prevent, and Workers AI ids carry a
  `@cf/` prefix that is easy to reconstruct wrongly.
- **A model failure arrives inside an HTTP 200.** The envelope is `success`,
  `errors`, `messages`, `result`; checking `response.ok` alone hands an
  undefined image to the decoder. Both conditions are failures.
- **The image comes back base64 in JSON, not as raw bytes.** It is decoded
  before anything touches it.
- **The image model takes no `width` or `height`.** `prompt`, `seed` and
  `steps` are the documented inputs, so the output size is *measured* off the
  returned bytes and never assumed — and so is the encoding, because the media
  type decides the stored blob's extension.
- The API token needs both `Workers AI - Read` and `Workers AI - Edit`.
- **The daily neuron allocation is account-wide**, and it is a second ceiling
  the per-user cap in the generate action does not model.

## 7.4 Adding a provider

If a future step genuinely needs a fifth provider, it is resolved **before** any
code is written:

1. Load the skill that owns the need — `vercel:vercel-storage`, `vercel:ai-sdk`,
   or `vercel:marketplace` for everything else.
2. `vercel integration categories`, then `vercel integration discover --category
   <slug>`. Both are read-only. Take the top relevant result unless the user
   names another provider.
3. **Read `vercel integration add <name> --help` first** — plan ids and metadata
   keys cannot be guessed, and the defaults are not always what this project
   wants. Then provision.
4. Provisioning creates billable resources: **ask the user before running it.**
   If the provider hands off to a browser step, stop, ask them to finish it, and
   retry the command the CLI returns.
5. Build against the real environment variables, and record the decision and its
   reasoning in `docs/backend.md`.

**A mock is not a resolution.** Scaffolding a stand-in "to wire up later" is
throwaway work. Provision first, then build.

## 7.5 Do not use

- a separate backend framework, service or API server
- `runtime = "edge"`
- a hand-wired provider SDK installed with `npm install` instead of provisioned
  through §7.4
- **`@vercel/postgres` or `@vercel/kv`** — both are sunset
- **a `Proxy` wrapper around the database client** (§7.3)
- an ORM, query builder or raw SQL outside `lib/db/`
- a client-side data-fetching library on primary read paths
- local JSON or filesystem storage for application data
- a second design system, or a component library that is not the existing
  primitives in `components/ui/`
- a raw hex literal in a component file
- `localStorage` or a cookie for anything an authorisation decision reads
- a `users` table. Clerk owns identity; duplicating it creates two sources of
  truth and a sync problem this project does not need

---

# 8. Standing backend rules

These apply to every backend task, in every phase, permanently.

## 8.1 The landing page is not collateral

`/` is finished, measured and byte-stable, and nine prompts of artboard-fitting
sit behind it.

- **Moving `app/page.tsx` into `app/(marketing)/` must not change its output.**
  If a screenshot of `/` differs after the move, the move is wrong.
- **Adding a route, an action or a table changes no existing route's HTML.** A
  backend prompt that alters the landing page's markup or render mode has
  exceeded its scope unless the prompt said so up front and the user approved it.
  Step 4 is the one planned exception and carries that argument in its prompt.
- A form is a **client leaf** that takes over the settled element and adds no
  box, exactly as `Reveal` and the motion components do.
- **Auth adds no motion, no layout shift and no new chrome to the marketing
  routes.** `<ClerkProvider>` goes in the root layout because Clerk needs it
  there; nothing else does.
- The verification is `npm run build`, the route table, and a screenshot
  comparison of `/` at `sm`, `md` and `lg` against `main` — with the hero drift,
  beads, drips, marquees, spiral and count-up all confirmed still running.

## 8.2 Every write path is hostile input

1. Validate server-side with the shared schema. Reject with a typed, handled
   result — never a thrown string, never a swallowed error.
2. Rate-limit anything that costs money or writes a row. Every generation call
   is metered from step 1 (§5.3 rule 6).
3. Uploads, when they arrive, are constrained by **type and size, checked
   server-side**.
4. An honest failure is a visible state. **Never a silent success** — a form
   that appears to submit while the write failed is worse than an error.
5. Success and failure are both accessible: the result is announced, focus is
   managed, and the state is legible without colour alone.
6. **The result slot reserves its space from first paint.** A box that appears
   on response shifts the page; the image arrives into a box that was already
   the right size.

## 8.3 User data

Prompts, generated images and email addresses are the users' data, and
mishandling it is not recoverable.

1. Collect only what the flow needs. No speculative fields.
2. **Never log a prompt, an email address, or a request body** — not to the
   console, not to an error report, not to analytics.
3. **A generation is private to its owner** until the user makes it public, and
   the ownership check lives in the query (§6.2).
4. **Two accounts must not see each other's generations**, and that is verified
   against the database, not by clicking around.
5. Deletion means deletion: step 11 removes the blob as well as the row. A soft
   delete is for the user's own undo, not a way to keep data they asked to
   remove.
6. The raw provider error never reaches the client.

## 8.4 Secrets

- Only `NEXT_PUBLIC_*` reaches browser code. Everything else is server-only, and
  every module reading one imports `server-only`.
- `.env.local` is gitignored and stays that way. Real values are never
  committed; they come from `vercel env pull .env.local --yes`.
- Never echo a secret's value. `vercel env ls` shows names only, and that is the
  only listing to quote.
- **Verify it, do not assume it:** search the built output for the Clerk secret
  and the blob token before calling a backend step done.

Variables in play, and the step that introduces each. All are server-only except
the two Clerk publishable names:

| variable | step | source |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | 1 | Neon, auto-provisioned |
| `BLOB_READ_WRITE_TOKEN` | 1 | Vercel Blob, auto-provisioned |
| `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 1 | Clerk, auto-provisioned |
| `VERCEL_OIDC_TOKEN` | 1 | Vercel. No longer read for generation after prompt 014 |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | prompt 014 | **ours, set by hand** in `.env.local` and in the Vercel project. The names are this project's choice; the REST API dictates neither (§12 rule 6) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `..._SIGN_UP_URL` | 1 | **ours, set by hand** in `.env.local` and in the Vercel project |

Do not invent a variable name before the step that provisions it.

## 8.5 Recording the result

Backend work is recorded in **`docs/backend.md`** — created by build step 1 and
added to the index at the top of this file in that same change. The schema's
column types, every action and its fields, the chosen model id and why, the
environment variables as provisioned, and the measured behaviour all live there.

Site work is recorded in **`design-system.md`**, extended rather than rewritten:
a new component section, a new §3 motion row with its stated reason, and any
deviation named in §5.1.

**Never in this file** (see the cap rule in the front matter): §5–§12 hold
decisions and boundaries; the other two files hold what was built against them.

---

# 9. Data model

Entities and the rules that govern them. **Column types, indexes and the
migrations themselves go in `docs/backend.md`**, not here.

## 9.1 Entities

- **`generation`** — one image. The Clerk `userId`, the prompt exactly as the
  user typed it, the Blob url, the model id that produced it, the dimensions,
  and `createdAt`. Indexed on `(userId, createdAt desc)`, because the only read
  is "this user's, newest first". Introduced by step 1; its visibility is the
  `private | unlisted | public` enum, and it gains a soft-delete state at step 7.
- **No `users` table.** Clerk owns identity (§7.5).
- **`collection`** *(step 7, if the library needs it)* — a named grouping of a
  user's generations. Do not create it before the step that uses it.
- **`usage_event`** *(step 9)* — what was spent and when, so a quota reading is a
  query rather than a guess.
- **`report`** *(step 10)* — a takedown request against a shared generation.

## 9.2 Rules

1. **Ownership is a column and a filter, never an assumption.** Every query
   against user content filters on the owner id in the query itself.
2. **The owner id comes from the server session**, never from a form field, a
   route param or a header.
3. **Status is an enum, defined once** and imported everywhere. Never a string
   union re-declared in UI code, and never a boolean where a third state is
   already foreseeable — `public` at step 4 becomes `private | unlisted | public`
   the moment sharing lands, and it is cheaper to plan for than to migrate.
4. **Every table carries `created_at`.** Anything with a lifecycle carries the
   timestamp of each transition, not just a current-state column.
5. **Soft-delete anything a person can ask to have removed**, so an erasure
   request is one operation with an audit trail rather than a cascade — and
   pair it with the blob deletion at step 11, or the storage bill and the
   privacy promise both drift.
6. **The blob url is a reference, not the image.** Never store bytes in a
   column, and never store a url the app cannot re-derive an owner for.
7. **No organisation or tenant column exists**, and none is added speculatively.
   Ether is single-user per account until phase three decides otherwise
   (step 14), and a column added "just in case" is dead weight that every query
   then has to reason about.

---

# 10. The write-path flow

**Every mutation follows this path.** Step 1 establishes it; every later flow
copies it rather than inventing its own.

Its internal stages are lettered, not numbered, so they can never be confused
with a build step or a section (see §5.2's citation convention).

```
client leaf form  (§8.1 — takes over the settled element, adds no box)
   │  validates with the shared schema, for the user's benefit only
   │  pending state through useFormStatus
   ▼
Server Action     (§6.2 — the only mutation path for our own forms)
   │  a. read the session       → no session, typed error. Never a client userId
   │  b. parse with the SAME schema → typed field errors
   │  c. rate limit / quota     → typed error, with what to do about it
   │  d. authorise ownership, for anything touching an existing row
   │  e. the expensive call     → lib/ai/, the only model caller
   │  f. store bytes            → lib/storage/, the only blob caller
   │  g. write the row          → lib/db/, the only DB caller
   │  h. revalidate the paths that show it
   ▼
typed result  { ok: true, data } | { ok: false, error, fieldErrors? }
   │
   ▼
the leaf renders it: announced, focus managed, legible without colour (§8.2)
```

**The rules that make it a contract, not a diagram:**

1. **Validation runs twice and the schema exists once.** The client copy is a
   courtesy; the server copy is the check (§6.2).
2. **The action returns a discriminated union. It never throws to the client**
   and never returns a bare string, so the client cannot read `data` off a
   failure. A thrown error is a bug, not a validation outcome.
3. **Order matters — a, b, c, before e.** Auth, parsing and the quota check come
   *before* the model call, otherwise the cheap rejections pay for the expensive
   work. This is the rule that keeps a rejected prompt from costing money.
4. **A failure after the expensive call is still a handled result.** If the model
   succeeded and the blob write failed, the user is told something true; the raw
   provider error is logged without the prompt (§8.3).
5. **No redirect on success.** The result appears in the slot that was already
   reserved for it. A navigation would discard the page's scroll position and
   its motion state.
6. **Nothing in the browser knows a secret, a model id's provider credentials,
   or another user's id.**

---

# 11. Roles and authorisation

Introduced by build step 1. Before it, nothing is authenticated and the whole
site is public.

## 11.1 The roles

| role | can |
| --- | --- |
| **anonymous** | read every marketing route, including whatever step 4 and step 8 make public. Never generate |
| **signed-in user** | generate within their quota, and read, share and delete **their own** generations. Nothing else |

There is no admin role, and step 10 is the first thing that might need one. **Do
not invent one before then** — a role that exists before anything checks it is a
privilege waiting to be granted by accident.

## 11.2 Rules

1. **Every protected page and every action authorises server-side.** A `proxy.ts`
   redirect is an optimistic convenience and is not enforcement.
2. **Authorisation is checked inside the action**, not in the component that
   renders the control. Hiding a button is presentation (§6.2).
3. **Ownership is checked in the query**, so a wrong id returns nothing rather
   than returning someone else's row to a check that was forgotten (§9 rule 1).
4. **Signing up grants nothing beyond a signed-in user's own quota.** No signup
   path may grant a role.
5. **The public marketing routes must not require a session**, and `proxy.ts`'s
   matcher names the protected routes rather than matching everything and
   excluding — the difference is whether a static page pays for auth per
   request.

---

# 12. Do not fabricate

The rules elsewhere in this file each guard one surface. **This section is the
general one**, and it outranks the instinct to produce a complete-looking answer.
A gap named is cheap; a gap filled with a plausible invention costs a debugging
session and can ship.

**The standing rule: an unverified claim is stated as unverified, or not stated.**
"I don't know", "not checked", and "this needs verifying" are complete,
acceptable answers. A hedge is not a failure — a confident wrong answer is.

1. **Never cite a path you have not opened.** File paths, component names,
   exported symbols and function names are *checked*, not recalled — including
   ones this file names, which may have moved. `design-system.md` is the same:
   quote what it says, never paraphrase it from memory.
2. **Never write an API you have not verified** in `node_modules/`, a loaded
   skill, or live docs fetched this session. This is the whole reason §7.3
   exists: all four providers have surfaces that contradict what a model writes
   from memory, and Next 16 contradicts almost every tutorial.
3. **Never claim a check passed without running it and quoting its output**
   (§2). Never describe a build's route table you did not just produce.
4. **Never present a judgement as a measurement.** Where a value could not be
   read off the artboard or measured, say it was judged, and say against what.
5. **Never assert what is built from this file or from `prompts/`.** A prompt
   file proves a prompt was written, never that it ran — `prompts/009` is the
   live example. Resolve from the repository and `git log` (§1). §5.2 is a
   *plan*; it says nothing about what exists.
6. **Never invent a name that a provider owns** — an environment variable, a
   table a library generates, a CLI flag, a package export. Read it back from
   `vercel env ls`, the generated schema, or `--help`.
7. **Never invent a number.** Prices, limits, free-tier thresholds, model ids and
   version numbers move; fetch them or say they are unchecked. On this site the
   rule is doubled: a number rendered to a user is either from the reference
   artboard or from a real query, never from anywhere else.
8. **Contradicting this file is allowed; doing it silently is not.** If the
   repository disagrees with something written here, the repository is the fact
   and this file is stale — say so, and fix the line in the same change.
9. **A blocked or uncertain step is reported, not routed around.** Do not
   substitute a mock, a placeholder, or a narrower deliverable and present it as
   the requested one (§7.4 says the same thing about integrations).
