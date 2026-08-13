# Automation

Steps that have been worked out by hand more than once, written down so a later
session starts from the command rather than from the investigation
(`AGENTS.md` §3). Add to this file the second time you solve something, not the
first.

## Read the database read-only from a script

Needed whenever a claim is about what is actually stored: verifying a
migration applied, confirming a row was written with real values, or measuring
something off a generation rather than assuming it.

There is **no `psql` on this machine**, and no query script in `package.json`.
The working incantation has three parts, and each one fails differently if you
leave it out:

```bash
NODE_PATH=/home/gdk26/Documents/nextjs/ether/node_modules \
  npx dotenv -e .env.local -- npx tsx <path-to-script>.ts
```

| Part | Why | Failure without it |
| --- | --- | --- |
| `dotenv -e .env.local --` | only Next.js auto-loads `.env.local` (§7.3) | `DATABASE_URL_UNPOOLED` is undefined |
| `NODE_PATH=<repo>/node_modules` | a script in the scratchpad resolves modules from its own directory | `Cannot find module '@neondatabase/serverless'` |
| an `async main()` wrapper | tsx transforms to CJS here | `Top-level await is currently not supported with the "cjs" output format` |
| `NODE_OPTIONS="--conditions=react-server"` | **only when the script imports a module that imports `server-only`**, such as `lib/ai/generate.ts`. Outside a bundler, node resolves that package to its client entry, which throws by design | `Error: This module cannot be imported from a Client Component module.` |

Use `DATABASE_URL_UNPOOLED`, the direct connection, for scripts. The pooled URL
is the application's.

Script shape:

```ts
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);

async function main() {
  const rows = await sql`select width, height, model from generations
                         order by created_at desc limit 5`;
  console.log(rows);
}

main();
```

**Two columns must never be selected into a log or a transcript.** `prompt` is
the user's data (§8.3 rule 2). `image_url` carries the owner's Clerk id in its
pathname, which is the known gap recorded in `docs/backend.md`. When you need
something from the URL, project just that piece: `right(image_url, 4)` gives
the file extension without the path.

Keep these scripts in the session scratchpad, never in the repository.

## Compare a build's route table across a change

Proves a backend change altered no route's render mode, which every backend
prompt's **Render impact** heading has to verify rather than assume (§4).

```bash
npm run build 2>&1 | sed -n '/^Route (app)/,/Dynamic/p' > /tmp/routes-after.txt
git stash push -- <only the source files you changed>
npm run build 2>&1 | sed -n '/^Route (app)/,/Dynamic/p' > /tmp/routes-before.txt
git stash pop
diff /tmp/routes-before.txt /tmp/routes-after.txt && echo IDENTICAL
```

Stash the source files by path rather than everything, so an untracked prompt
file or an edited `docs/` page does not move and confuse the comparison.

## Prove an environment read is lazy

`AGENTS.md` §2 requires the build to pass with the environment absent. Chain
the restore with `;` rather than `&&`, so a failing build still puts the file
back:

```bash
mv .env.local .env.local.bak && (npm run build 2>&1 | tail -35); mv .env.local.bak .env.local
```

Confirm `.env.local` is present afterwards before doing anything else.

## Prove the landing page's output did not change

`AGENTS.md` §8.1 requires every later change to leave `/`'s rendered output
identical. **Compare the prerendered HTML, not screenshots.** It is exact,
scriptable, and it catches a markup change a screenshot at three widths would
miss.

`/` is statically prerendered, so the build writes it to
`.next/server/app/index.html`.

```bash
npm run build > /dev/null 2>&1 && cp .next/server/app/index.html /tmp/index-after.html
git stash push -u -- <only the source files you changed>
npm run build > /dev/null 2>&1 && cp .next/server/app/index.html /tmp/index-before.html
git stash pop

norm() { sed -E -e 's#/_next/static/chunks/[A-Za-z0-9_-]+\.(js|css)#CHUNK#g' \
                -e 's#\\"b\\":\\"[A-Za-z0-9_-]+\\"#BUILDID#g' "$1"; }
diff <(norm /tmp/index-before.html) <(norm /tmp/index-after.html) && echo IDENTICAL
```

**The normalisation is required and is not a way of hiding a difference.** Two
builds of unchanged source still differ in two places: content-hashed chunk
filenames, and the build id in the flight payload (`\"b\":\"…\"`). Both change
on every build. If the byte counts match and only those two patterns differ, the
markup is identical. Check the byte counts with `wc -c` first: an unchanged
length is a good early signal, and a changed one means look at the raw diff
before normalising anything.

A visual pass is still worth doing for motion, which markup identity says
nothing about. Note that `resize_window` in the browser tools did **not** reflow
this page's viewport when it was tried on 2026-08-13, so a per-breakpoint
screenshot comparison is not currently a solved step and should not be claimed
as one.

## Check a secret never reached the browser

Run after any change that adds a server-only variable (§8.4).

```bash
npm run build > /dev/null 2>&1
for v in <VARIABLE_NAMES>; do
  echo "$v: $(grep -rl "$v" .next/static/ 2>/dev/null | wc -l) client files"
done
```

Zero is the only acceptable answer. **Read the context of any hit before
reporting it**: searching for `CLOUDFLARE` matches Clerk's runtime sniffing,
`fy("Cloudflare-Workers")?"CLOUDFLARE":…`, which is unrelated to this
project's variables. Search for the exact variable name, not a fragment.

**`CLERK_SECRET_KEY` is a known, permanent single hit** and it is a name, not a
value: Clerk's SDK enumerates `process.env` keys in a client chunk
(`i.default.env.CLERK_SECRET_KEY, i.default.env.CLERK_MACHINE_SECRET_KEY, …`).
The test that settles any hit like this is to search for the **value** rather
than the name, which must return zero:

```bash
val=$(grep '^CLERK_SECRET_KEY=' .env.local | cut -d= -f2- | tr -d '"'"'"'')
grep -rl "$val" .next/static/ 2>/dev/null | wc -l
```
