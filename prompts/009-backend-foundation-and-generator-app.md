# 009 — The backend, and the product the landing page is selling

Everything through `008` is one route. `app/page.tsx` renders seven sections, every nav link is `href="#"`, every footer link is `href="#"`, and `components/ui/PromptField.tsx` carries a comment that says it plainly: *there is no generation backend in this build, so the form does not submit.*

This prompt builds the backend and the one page that uses it. A signed-in user types a prompt, gets a real generated image back, and finds it again on their next visit. That is the whole of `009`.

It is the first of four prompts that finish the site. `010` takes the four marketing routes (`Learn`, `Build`, `Product`, `Community`), `011` takes the seven footer routes, `012` backs the gallery strip with real generations. `009` comes first because all three of those need the app shell, the auth state in the nav, and the route group layout that this prompt creates. Nothing downstream is unblocked by building a `Careers` page first.

## What is already provisioned

Do not install providers. This was done before the prompt was written, against the linked Vercel project `dgsloxx417s-projects/ether`, and the env vars are already in `.env.local`:

| Capability | Provider | Env |
|---|---|---|
| Postgres | Neon, via Marketplace | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| File storage | Vercel Blob, store `ether-images`, **public** access | `BLOB_READ_WRITE_TOKEN` |
| Image model | Vercel AI Gateway | `VERCEL_OIDC_TOKEN` |
| Auth | Clerk, via Marketplace, resource `clerk-byzantine-curtain` | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |

All four are live and connected to the project across production, preview and development. Clerk needed two steps the others did not: the user accepted the marketplace terms in a browser, and the resource then had to be attached with `vercel integration resource connect clerk-byzantine-curtain --yes`, because `integration add` provisioned it at team scope without connecting it. Worth knowing if a second environment ever needs setting up.

Re-run `vercel env pull .env.local --yes` at the start of execution. `.env.local` is gitignored and stays that way.

## This is Next.js 16, and two conventions have moved

Read `node_modules/next/dist/docs/01-app/01-getting-started/` before writing anything. Two things bite here:

1. **`middleware.ts` is deprecated and renamed to `proxy.ts`.** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md` says so outright. Clerk's own documentation still says `middleware.ts`. **We follow the framework, not the SDK docs:** the file is `proxy.ts` at the repo root, default-exporting `clerkMiddleware()`. If that turns out not to work, say so and fall back to `middleware.ts` with a comment naming the conflict. Do not create both.
2. **`auth()` is async in Clerk Core 3.** `const { userId } = await auth()`. Never the synchronous form. `auth.protect()` is called directly, not off the return value.

Cache Components is not enabled in `next.config.ts` and this prompt does not enable it. Generation pages are per-user and dynamic; there is nothing here worth caching, and turning it on would put `<ClerkProvider>` placement into scope for no gain.

## Data layer

Drizzle over Neon's HTTP driver:

```bash
npm i @neondatabase/serverless drizzle-orm @vercel/blob @clerk/nextjs ai
npm i -D drizzle-kit dotenv-cli
```

`lib/db/index.ts` — **lazy `getDb()`, and no `Proxy` wrapper.** The `vercel-storage` skill is explicit about both: a top-level `neon(process.env.DATABASE_URL!)` throws during `next build` before env vars resolve, and a `Proxy` around the client breaks any library that inspects the adapter. A plain module-level `let` behind a function.

`lib/db/schema.ts` — one table, `generations`:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` primary key, `defaultRandom()` | |
| `userId` | `text not null` | The Clerk user id. Indexed. |
| `prompt` | `text not null` | Exactly what the user typed. |
| `imageUrl` | `text not null` | The Blob public URL. |
| `model` | `text not null` | The gateway model id that produced it. Recorded so a later model change stays legible in the data. |
| `width`, `height` | `integer not null` | |
| `createdAt` | `timestamp with time zone not null default now()` | Indexed with `userId`, descending, because the only read is "this user's, newest first". |

No `users` table. Clerk owns identity; duplicating it here creates two sources of truth and a sync problem we do not need.

Migrations via `drizzle-kit`. Add to `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:push": "dotenv -e .env.local -- drizzle-kit push"
```

`drizzle-kit` does not read `.env.local` on its own, which is why `dotenv-cli` is a dependency. Use `DATABASE_URL_UNPOOLED` for migrations and the pooled `DATABASE_URL` at runtime. Commit the generated SQL in `drizzle/`.

## Generation

A server action in `app/generate/actions.ts`, `"use server"`, called from the client form. Not a route handler: there is no external caller, and a server action gets the Clerk session and the `revalidatePath` for free. Read `01-getting-started/07-mutating-data.md` first.

The action, in order:

1. `const { userId } = await auth()`. No `userId`, return an error result. **Never trust a `userId` passed from the client** — the whole point of reading it server-side.
2. Validate the prompt: non-empty after trim, at most 500 characters. Return a typed error result rather than throwing, so the form can render it.
3. Rate limit. See below.
4. `experimental_generateImage` from `ai`, against the AI Gateway with a plain `"provider/model"` string. **Verify the model id against the gateway's live model list before hardcoding it** — do not take a model name from memory. Prefer a fast, inexpensive text-to-image model; record whichever you land on in `lib/ai/model.ts` as a single exported constant with a comment saying why, so changing it later is one edit.
5. `put()` the returned bytes into Blob at `generations/${userId}/${crypto.randomUUID()}.png`, `access: 'public'`, `addRandomSuffix: false`. Public because these are rendered in an `<img>` on a page the user is already authenticated for, and the storage skill is blunt that private access for publicly served files means slow delivery and high egress.
6. Insert the row.
7. `revalidatePath('/generate')`.
8. Return `{ ok: true, generation }` or `{ ok: false, error }`. A discriminated union, so the client cannot read `generation` off a failure.

**Errors are handled, not thrown into a 500.** A refused prompt, a gateway timeout, a blob failure: each returns an `ok: false` with a message the user can act on. The one thing never returned to the client is a raw provider error string.

### Rate limiting

Generation costs real money per call and the action is reachable by anyone with an account. Cap it. Upstash Redis is the provisioned-path answer and the `vercel-storage` skill documents `@upstash/ratelimit` for exactly this, but it is **not currently provisioned** and pulling in a fifth provider widens this prompt.

Do the cheap correct thing instead: a `count(*)` against `generations` for this `userId` over the last hour, capped at **20**, checked before the model call. It is one indexed query, it uses infrastructure that already exists, and it is honest about being a floor rather than a distributed limiter. Leave a comment saying that, and name Upstash as the upgrade path.

## Routes

```
app/
  (marketing)/
    layout.tsx        Nav + Footer, moved off app/page.tsx
    page.tsx          the existing landing page, unchanged in output
  (app)/
    layout.tsx        AppShell: compact nav, no marketing footer
    generate/
      page.tsx        server component, reads history
      actions.ts
    account/
      page.tsx
  sign-in/[[...sign-in]]/page.tsx
  sign-up/[[...sign-up]]/page.tsx
  layout.tsx          root, gains <ClerkProvider>
proxy.ts
```

Route groups, so the marketing chrome and the app chrome are genuinely different layouts rather than one layout branching on `pathname`. **`app/(marketing)/page.tsx` must render byte-identical output to today's `app/page.tsx`.** Move the `Nav`, `Footer` and skip link into the group layout; the page keeps only the sections. If a screenshot of `/` differs after this move, the move is wrong.

`proxy.ts` protects `/generate(.*)` and `/account(.*)` with `createRouteMatcher` and `await auth.protect()`. Everything else stays public — the landing page must not require a session.

## The generator page

This is new UI and the first page in the system that is not in the reference artboard. It has no artboard to copy, so it is **assembled from the existing system**, not designed fresh. Read `design-system.md` in full first; §6 is binding and §1 supplies every value.

Layout: a `--container` column. The prompt form at the top, the result below it, the user's history under that.

**The form is `components/ui/PromptField.tsx`, promoted.** It already is a real `<input>` with a real `<label>` and the correct lime `Generate` button. It currently swallows its own submit. Give it an optional `action` prop:

- No `action` (the landing page, `components/sections/Features.tsx`) — unchanged behaviour, still `preventDefault`. `Features` is not modified by this prompt.
- With `action` — a real submitting form. Pending state through `useFormStatus`, per `07-mutating-data.md` §"Showing a pending state". The button reads `Generating…` and is `disabled` while pending.

Rewrite that component's header comment. "There is no generation backend in this build" stops being true with this prompt and must not survive it.

**The result slot has a fixed aspect ratio from first paint.** An empty box that becomes an image on response shifts the entire page; reserve the space with `aspect-[1/1]` and a `--surface` fill. The image arrives into a box that was already the right size.

**The waiting state.** Generation takes seconds and a dead page reads as a broken page. Reuse what the site already has rather than inventing a spinner: the `--grad-arc` conic ring from §1.2, at `opacity ≤ 0.5`, rotating. It is already the site's signal for "a generative system is working", it is already in the design system, and §9.A's glow exception was already spent on it. Under `prefers-reduced-motion: reduce` it does not rotate — a static ring plus the pending button label carries the state.

**History.** A grid of the user's past generations, newest first, each a `next/image` with the prompt as a caption below it. `--r-card`. Not `--r-none` — the gallery strip is the *one* square-cornered surface on the page and §1.5 says so.

Empty state: one line of copy and nothing else. No fake sample images, no placeholder grid.

**None of these images get `priority`.** §5.3 pins the LCP budget on the macaw being the only priority image, and that is a per-page rule this page inherits. Set `sizes` correctly on every one, and cap the history at the 24 most recent — an unbounded grid of full-size generations will wreck this page by the fiftieth image. Paginate later if it matters.

## Auth pages and nav state

`<SignIn />` and `<SignUp />` from `@clerk/nextjs`, on `--ink`, centred. Clerk's components are themed through its `appearance` prop — set it **once**, in `<ClerkProvider>` in the root layout, from the design tokens: `--ink` background, `--surface` card, `--lime` primary button with `--ink` text, `--r-pill` on buttons and inputs, `--r-panel` on the card, Outfit as the font. Not per-page, or the two pages will drift.

Add the routing vars to `.env.local` and to the Vercel project:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

`components/sections/Nav.tsx` gains auth state, and this is the only change to it in this prompt: `<SignedOut>` shows a `Sign in` nav link and the lime `Try Free ↗` CTA now points at `/sign-up`; `<SignedIn>` shows a `Generate` link to `/generate` and Clerk's `<UserButton />`. The four `LINKS` stay `href="#"` — they are `010`'s job and this prompt does not touch them. Both states must work in the mobile panel, and the panel's existing focus handling and `Escape` behaviour must survive.

**The `Try Free ↗` button gets a real destination on the landing page.** It is the page's primary CTA and it has pointed at nothing since `001`.

`/account`: the user's email, join date, a total generation count read from the database, and Clerk's `<UserButton />` for sign-out. No invented figures — the count is a real `count(*)`, which is the only new number allowed anywhere in this prompt (§5.2, "no invented numbers", forbids marketing figures, not query results).

## Files

New: `lib/db/index.ts`, `lib/db/schema.ts`, `lib/ai/model.ts`, `drizzle.config.ts`, `drizzle/`, `proxy.ts`, `app/(marketing)/layout.tsx`, `app/(marketing)/page.tsx`, `app/(app)/layout.tsx`, `app/(app)/generate/page.tsx`, `app/(app)/generate/actions.ts`, `app/(app)/account/page.tsx`, `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`, and whatever generator-page components fall out (`components/app/…`).

Modified: `app/layout.tsx` (`<ClerkProvider>` + `appearance`), `components/sections/Nav.tsx` (auth state), `components/ui/PromptField.tsx` (optional `action`), `package.json`, `next.config.ts` (`images.remotePatterns` for the Blob hostname).

Deleted: `app/page.tsx`, which moves into the marketing group.

**Untouched:** every file under `components/motion/`, `components/brand/`, `Hero`, `Features`, `Stats`, `Gallery`, `LogoWall`, `Footer`, `app/globals.css`. `008` is finished work and this prompt has no business in it.

## Constraints

- **`AGENTS.md` §1.4.** Do not refactor anything this prompt does not need.
- **Two accents.** Lime acts, violet identifies. Nothing new enters the palette. The generator page introduces no colour that is not in §1.1.
- **One radius scale.** §1.5. Gallery keeps its documented `--r-none` exception; nothing on the new pages claims it.
- **Zero em-dashes** in any visible string, including every new error message and empty state (§5.2).
- **No invented numbers** (§5.2). The new pages carry no statistics. `10.2M+`, `300+`, `1000+`, `48,000` stay where they are.
- **Focus visible everywhere** (§6.8), including inside Clerk's components — check them, do not assume the `appearance` prop preserved the ring.
- **Layout families do not repeat** (§6.5). The generator page is a new family: single column, form-led. It must not be another image-plus-text split.
- **Dark only.** No light section (§6.1).
- Secrets stay server-side. No key reaches a client component, and `.env.local` is never committed.
- Every Phosphor icon imported from `@phosphor-icons/react/dist/ssr/<Icon>` (§5.3, `bundle-barrel-imports`).
- No `useState` for continuous values, transforms and opacity only for the ring (§5.2).

## Documentation

`design-system.md` currently describes a one-page site. Extend it, do not rewrite it:

- A new **§2.8 Application shell** covering the compact nav, the generator layout, the result slot's reserved aspect ratio, and the history grid.
- A **§3 motion row** for the generation pending ring: the behaviour, and the reason, in the same voice as its neighbours. Add it to the reduced-motion sentence at the end of §3.
- A note in **§1.4** that the app routes use `--container`, not `--container-wide`.
- A short **§7 Backend** section: Clerk for identity, Neon for generation records, Blob for the images, AI Gateway for the model, and the fact that no user table is duplicated locally. Record the hourly cap and that Upstash is the upgrade path.

Update the `README.md`, which is still the untouched `create-next-app` boilerplate: what Ether is, the env vars required, `npm run db:push`, and how to run it.

## Verify

- `npm run lint` and `npm run build`. The build must pass **with env vars absent** — that is what the lazy `getDb()` is for. Test it: `mv .env.local .env.local.bak`, build, move it back.
- `npm run db:push`, then confirm the table and both indexes exist.
- `/` is pixel-identical to before at `sm`, `md`, `lg`. Hero drift, beads, drips, marquees, spiral, count-up all still run. Compare screenshots against `main` before the change.
- Signed out, `/generate` redirects to `/sign-in` and comes back to `/generate` after signing in.
- Sign up, generate a real image. It appears in the result slot, survives a reload, and shows in the history grid.
- The result slot does not shift the page between empty, pending and filled. Watch the layout, not the image.
- Two accounts do not see each other's generations. Check this directly against the database, not by clicking around.
- An empty prompt, a 501-character prompt, and a 21st generation in an hour each produce a readable message and no crash.
- `prefers-reduced-motion: reduce`: the ring is static, the pending state is still legible.
- Keyboard-only: tab through `/generate`, `/sign-in` and `/account`. A lime ring at every stop, Clerk's components included.
- No secret in the client bundle: search the built output for the Clerk secret and the blob token.
