# 030 — The cross-owner data boundary, as a committed test

## Scope, and why it is next

**Every step in `AGENTS.md` §5.2's build sequence, 1 through 12, is committed.**
Resolved from the repository and `git log`, not from `prompts/`: steps 1–4 at
`a367b09`, `4c5b9f7`, `2389ddf`, `2b612af`; steps 5–8 at `8ed5482`, `813c477`,
`ed8e75b`, `fa4747e`; steps 9–11 at `2e1441e`, `02c4afa`, `2fb7ea4`; step 12
across `668cbc7`, `1965829`, `988e041`, `43607b9`, `0a1dd57`. Steps 13 and 14
are phase three and **may not be started without the user's explicit approval**
(§5.2), so neither is available as a scope.

What is left on the floor is `docs/backend.md`'s own open list, and only one item
on it is neither a commercial decision nor blocked on a human:

| open item | status |
| --- | --- |
| the per-refund proportional floor | **decided** by the user on 2026-08-14 to stay as it is. Not a bug |
| the dispute-won rule | **decided** the same way |
| live mode, Production, a Dashboard endpoint, `STRIPE_WEBHOOK_SECRET` in the Vercel project | blocked on a deployment and a business decision |
| **the two-account boundary** | **open, and unblocked at the layer that decides it** |

`AGENTS.md` §8.3 rule 4 — "**Two accounts must not see each other's
generations**, and that is verified against the database, not by clicking
around" — is a standing rule, and this project has never satisfied it as a
repeatable check:

- `docs/backend.md` line 883, prompt 016: the cross-owner check "could not be
  run", because the database held exactly one owner and there was no second id.
- `docs/backend.md` line 1928, prompt 027 M11: "**not run**", because a second
  Clerk identity is a prohibited action for the implementing agent. It records
  that the boundary "**is** covered at the layer that decides it" — but only for
  **billing**, by `tests/billing-db.integration.ts`.
- `docs/automation.md` §"Exercise an owner boundary without logging user data"
  captures the procedure, and it is a **throwaway module in `/tmp`**, worked out
  for the library and repeated for sharing. Nothing in the repository runs it.

So the generation, library, permalink, sharing, moderation, export and account
paths have their owner boundary asserted by *review of the query text*, and by
two hand runs that left no artefact. This prompt turns that into a committed
integration test that runs on demand, in the same shape and with the same
discipline as `tests/billing-db.integration.ts`. It is the last unblocked item,
it closes a rule the file calls standing and permanent, and it costs no
commercial decision.

**The browser half stays open and is stated as open.** Two real sign-ins are
still prohibited for the implementing agent (M11). This prompt closes the
database half completely and does not pretend to close the other.

## Reference material read for this prompt

| path | what was read |
| --- | --- |
| `AGENTS.md` | §5.2 build sequence, §6.2 boundaries, §8.3 rules 3–5, §9 rules 1–2, §12 rules 3–5 |
| `docs/backend.md` lines 883–906, 1928, 2003–2086, 2238–2461 | the three places the two-account gap is recorded, and the open lists after 027, 028 and 029 |
| `docs/automation.md` lines 208–242 | the owner-boundary procedure, and its no-logging and cleanup rules |
| `lib/db/queries.ts` (whole file) | every owner-filtered read and mutation, and the two anonymous projections |
| `lib/db/account.ts` lines 75–260 | `listAllImageUrlsForOwner`, `ownerHasPublicGeneration`, `purgeOwnerData`, `readAccountExport` |
| `lib/db/moderation.ts` lines 1–60 | `claimReport`, and its `user_id <> reporter_user_id` condition |
| `lib/db/quotas.ts` lines 92–195 | `reserveGenerationQuota` (takes the **global** lock) and `readOwnerUsageSummary` (owner-only) |
| `tests/billing-db.integration.ts` | the harness shape this test must copy: `node:test`, synthetic ids suffixed with `crypto.randomUUID()`, cleanup in `finally` |
| `package.json` | the existing `test`, `test:db` and `test:billing-db` scripts, and their `dotenv -e .env.local --` discipline |

## What the implementation builds

**One new file, `tests/owner-boundary.integration.ts`**, and **one new script**,
`test:owner-db`, written exactly like its two siblings:

```
"test:owner-db": "dotenv -e .env.local -- node --conditions=react-server --import tsx tests/owner-boundary.integration.ts"
```

`AGENTS.md` §2 says a script is added by the step that needs it and the file is
corrected in the same change; §2's script list gains this one row, which is the
one edit to `AGENTS.md` this prompt makes.

### The two owners

Two synthetic ids per test, `owner-a-${crypto.randomUUID()}` and
`owner-b-${…}`, never a real Clerk id. Rows are inserted through
`createGeneration` so the schema defaults are the real ones. `imageUrl` is a
synthetic string, not a Blob object: **no test here asserts an object is gone**,
so the §"Exercise an owner boundary" Blob-polling clause does not apply and no
Blob is written.

### The assertions, and which function each one drives

Every one of these is a real call into `lib/db/`, never hand-written SQL.

**A. The owner reads.** With A owning a live row and B owning none:

| assertion | function |
| --- | --- |
| B's list does not contain A's row, and B's count is 0 | `listGenerationsForUser`, `countGenerationsForUser` |
| A's row fetched as B returns `undefined`; as A it returns the row | `getGenerationForOwner` |
| B's library page, both the live and the `removed: true` view, excludes A's row | `listLibraryPage` |
| a search term drawn from A's prompt returns nothing for B | `listLibraryPage` with `search` |
| B's export contains none of A's generations, usage events or ledger rows | `readAccountExport` |
| B's image-url list is empty while A's has one | `listAllImageUrlsForOwner` |

**B. The owner mutations, each of which must match nothing for the wrong id.**
After each wrong-owner attempt the row is re-read as A and asserted unchanged:

| assertion | function |
| --- | --- |
| B cannot publish A's private row | `setGenerationVisibilityForOwner` returns `undefined` |
| B cannot soft-delete A's row | `softDeleteGenerationForOwner` returns `undefined` |
| B cannot restore A's removed row | `restoreGenerationForOwner` returns `undefined` |
| B cannot permanently delete A's row | `deleteGenerationForOwner` returns `undefined` |
| B cannot read A's removed row | `getGenerationForOwnerIncludingRemoved` returns `undefined` |
| each of the four, run **as A**, does what it says | the same four |

**C. The anonymous projections**, which are the boundary in the other direction:

| assertion | function |
| --- | --- |
| a `private` row is not shareable; `unlisted` and `public` are | `getShareableGeneration` |
| the shareable projection carries **no** `userId` and **no** `prompt` — asserted on the object's own keys, so a later column addition fails the test | `getShareableGeneration` |
| only `public` rows reach Community, and a soft-deleted or taken-down public row does not | `listCommunityGenerations` |
| the same for the landing strip, whose projection also carries no owner or prompt | `listPublicGenerations` |

`listPublicGenerations` and `listCommunityGenerations` are the **uncached**
functions and are what the test calls. `getPublicGalleryImages` and
`getCommunityGenerations` wrap them in `unstable_cache`, which is a Next.js
request-scoped primitive and not a thing to exercise from `node:test`; say so in
a comment rather than working around it.

**D. Moderation, both directions.**

| assertion | function |
| --- | --- |
| B cannot report a **private** row of A's | `claimReport` → `not_found` |
| A cannot report **their own** public row — the `user_id <> reporter_user_id` condition | `claimReport` → `not_found` |
| B reporting A's public row once succeeds, twice is a `duplicate` | `claimReport` |
| a taken-down row disappears from A's own reads and from every anonymous projection | `completeReportWithTakedown`, then the reads in A and C |
| A's export lists the report **A filed**, and never one filed against A, and no reporter id appears anywhere in the payload | `readAccountExport` |

**E. Quotas, read-only.** `readOwnerUsageSummary` for B is unaffected by usage
events written for A. **`reserveGenerationQuota` is not called.** It takes the
shared provider-daily lock and would spend real global allocation for a test;
the usage rows are inserted directly through the schema instead, and the reason
is written as a comment so a later session does not "fix" it.

**F. The purge.** `purgeOwnerData(A)` removes A's rows and **B's row count,
export and balance are identical before and after**, asserted by value rather
than by eye. `ownerHasPublicGeneration` is read for both owners before the purge.

### The rules this test itself must obey

1. **Nothing is printed.** Not an owner id, not a prompt, not a row id, not a
   url. `node:test` reports pass and fail, and an assertion message names the
   *property* that failed, never a value. This is `docs/automation.md` step 5
   applied to a committed file.
2. **Cleanup in `finally`, in every test**, deleting by the synthetic owner ids,
   and a final aggregate assertion that zero rows remain for either id. A failed
   cleanup fails the test.
3. **No production row is touched.** Every `where` names a synthetic owner id or
   an id returned by an insert this test made.
4. The file carries `--conditions=react-server` through the script, because
   `lib/db/` modules import `server-only`.

## Render impact

**none — no existing route changes.** This prompt adds a test file and a
`package.json` script. It imports from `lib/` and modifies nothing under `app/`
or `components/`. To be *verified*, not assumed: the build route table is
diffed against a baseline and the prerendered `/` compared, per §2 and
`docs/automation.md`.

## Trust boundary

**none.** There is no request path here. The test runs locally with
`.env.local`, against the same Neon database the app uses, as `test:db` and
`test:billing-db` already do. It writes and then removes synthetic rows under
owner ids no Clerk identity can hold.

## Secrets and data

Reads `DATABASE_URL` only, through the existing `getDb()`, loaded by
`dotenv -e .env.local --`. No new environment variable, so the `AGENTS.md` §8.4
table is unchanged. **No real user data is read, written or printed** — every
row the test touches is one it created under a synthetic owner id, and rule 1
above forbids printing any of it.

## Non-goals

- **The browser two-account check.** Still blocked, still prohibited, still
  recorded as open (M11). This prompt closes the database half and says so.
- **Any change to `lib/db/`.** If an assertion fails, that is a finding to
  report and fix in a scoped follow-up, not a reason to widen this prompt.
  Report it rather than routing around it (§12 rule 9).
- **Steps 13 and 14.** Phase three, unapproved.
- **The two carried-forward commercial rules** — the per-refund floor and the
  dispute-won rule. Both decided.
- **Deployment, live mode, a Dashboard webhook endpoint.**
- **A typecheck script.** `AGENTS.md` §2 names the gap; adding one is unrelated
  to this scope and would be a separate change.
- Any change to `/` or to any marketing route.

## Files

**Creates**
- `tests/owner-boundary.integration.ts`

**Modifies**
- `package.json` — one script, `test:owner-db`
- `AGENTS.md` §2 — one row for that script, and nothing else
- `docs/backend.md` — the verification record for this prompt
- `docs/automation.md` — the "Exercise an owner boundary" section gains a line
  saying the committed test has replaced the `/tmp` module for the paths it
  covers, and keeps the procedure for a path it does not

**Must not touch**
- `app/**`, `components/**`, `app/globals.css`, `design-system.md`
- `lib/**` — see the non-goal above
- `drizzle/**` — this prompt generates no migration

## Checks to run, and where the result is recorded

Run every one and quote its actual output (§12 rule 3):

- `npm run test:owner-db` — the new suite, with its test count
- `npm test` — must be unchanged at 12 pass; no pure function changes here
- `npm run test:db` and `npm run test:billing-db` — must be unchanged at 1 and 7
- `npm run lint`
- `npm run build`, and its route table diffed against a stashed baseline of
  `0a1dd57` per `docs/automation.md` §"Compare a build's route table"
- the prerendered `/` comparison per `docs/automation.md` §"Prove the landing
  page's output did not change" — expected `IDENTICAL` at **125,912 bytes**,
  the figure prompts 026 through 029 all recorded
- the environment-absent build per `AGENTS.md` §2

**Recorded in `docs/backend.md`** (§8.5), as a new section
`## The cross-owner data boundary, prompt 030`, stating what each test asserts,
what the run returned, and — explicitly — that the browser half of §8.3 rule 4
remains open and why. Nothing is recorded in `AGENTS.md` beyond the one script
row.

## SKILLS USED

- **`drizzle-docs`** — the query and `db.batch` APIs the test drives, and the
  `.returning()` shapes the wrong-owner assertions read
- **`zod-docs`** — only if an assertion needs a schema; the validation modules
  are imported, not rewritten
- **`neon-postgres`** — pooled vs direct connection, and the scale-to-zero cold
  start that makes the first assertion in a run slower than the rest
- **`vercel:nextjs`** — why `unstable_cache` wrappers are out of scope for a
  `node:test` run, per the note in section C
- **`vercel:env-vars`** — the `dotenv -e .env.local --` discipline the new
  script must copy
- **`claude-api`** — not applicable; no model call is made or changed here.
  Named so the omission is deliberate rather than silent

No skill covers `node:test` itself; that surface is written against the
installed Node's own documentation and the two existing integration files in
`tests/`, which are the working reference.
