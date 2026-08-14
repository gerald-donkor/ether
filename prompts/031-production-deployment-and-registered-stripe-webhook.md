# 031 — The production deployment, and a registered Stripe webhook

## Scope, and why it is next

**Every step in `AGENTS.md` §5.2's build sequence, 1 through 12, is committed,
and prompt 030 closed the last unblocked item on `docs/backend.md`'s own open
list.** Resolved from the repository and `git log`, not from `prompts/`: steps
1–4 at `a367b09`, `4c5b9f7`, `2389ddf`, `2b612af`; steps 5–8 at `8ed5482`,
`813c477`, `ed8e75b`, `fa4747e`; steps 9–11 at `2e1441e`, `02c4afa`, `2fb7ea4`;
step 12 across `668cbc7`, `1965829`, `988e041`, `43607b9`, `0a1dd57`; the
cross-owner boundary test at `8cc7f75`. No `href="#"` survives anywhere in
`app/` or `components/`. Steps 13 and 14 are phase three and were not chosen.

What is left on the floor after 030 is four items, and **three of them are
gated on this one**:

| open item after 030 | gated on |
| --- | --- |
| `STRIPE_WEBHOOK_SECRET` in the Vercel project, and a Dashboard endpoint | **a deployment of this commit** — `docs/backend.md` says so in those words |
| a foreign Checkout Session retried for three days | **a registered endpoint**, which is the only thing a retry policy applies to |
| the two-account boundary through the browser | a reachable deployment plus two real sign-ins |
| the per-refund floor, and the dispute-won rule | neither. **Decided** by the user on 2026-08-14 to stay as they are |

The user chose the deployment path on 2026-08-14. This prompt takes the current
`main` to the production alias that already exists, puts the environment
variables the deployed code actually reads into Production, and turns
`stripe listen` into a **registered test-mode event destination**, which is the
thing every one of those three items was waiting for.

**It stays in test mode.** Live mode is a business decision (§5.2 phase three
reasoning, and `AGENTS.md` §7.4 rule 4), and nothing here creates a live-mode
key, a live-mode endpoint, or a charge against a real card.

## What was verified today, and how

Every number and name below was read back from the provider on **2026-08-14**,
not recalled (§12 rules 5 and 6).

| fact | command, and what it returned |
| --- | --- |
| the linked project | `.vercel/project.json` — `ether`, `prj_WuHQTQwVWyda8rmWcKygCx48It2l`, team `team_zE3mp7nrEZ6a7cxRavwUMYC4` |
| **a production deployment already exists** | `vercel ls` — two Production deployments, both `Ready`, both 2 days old. The newest is `dpl_6bx874BB3A49iBwfEX3hFSyn3qqn` |
| **the production alias** | `vercel project inspect` / project API — `ether-bay.vercel.app`, plus `ether-dgsloxx417s-projects.vercel.app` and `ether-git-main-dgsloxx417s-projects.vercel.app` |
| **the alias is publicly reachable** | `curl -o /dev/null -w '%{http_code}' https://ether-bay.vercel.app/` → **200** |
| **the deployed build predates the webhook route** | `curl … https://ether-bay.vercel.app/api/stripe/webhook` → **404**. That route landed in prompt 025; the deployment is older |
| **the per-deployment URLs are SSO-protected, the alias is not** | deployment protection reads `ssoProtection: { enabled: true, deploymentType: "all_except_custom_domains" }`, and `curl` on `ether-irhvkp370-…vercel.app` returns **302** while `ether-bay.vercel.app` returns **200**. This is why the endpoint must be registered against **the alias**, never a deployment-specific URL |
| **no custom domain exists** | `vercel domains ls` — `0 Domains found under dgsloxx417s-projects` |
| **the Stripe variables are missing from Production** | `vercel env ls` — `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_MCP_KEY` are all **Development, Preview** only |
| **`STRIPE_WEBHOOK_SECRET` is on no Vercel environment at all** | `vercel env ls` — absent. It exists only in the gitignored `.env.local`, from `stripe listen --print-secret` |
| Cloudflare, Clerk, Blob and Neon **are** in Production | `vercel env ls` — `CLOUDFLARE_*` (sensitive, Production + Preview), all four Clerk names, `BLOB_READ_WRITE_TOKEN`, and the whole Neon set, all on Production, Preview, Development |
| **no publishable Stripe key is read by application code** | `grep -rn "STRIPE_PUBLISHABLE_KEY\|STRIPE_MCP_KEY" app components lib` → no matches. This confirms `AGENTS.md` §8.4's claim, and it is why they are **not** added to Production below |
| **Checkout needs no base-URL variable** | `app/(app)/account/billing/actions.ts` lines 15–23: `origin()` builds the base from `x-forwarded-host` / `host` and requires https for any non-localhost host. It accepts `ether-bay.vercel.app` as written. No `NEXT_PUBLIC_APP_URL` exists or is needed |
| the nine event types the route handles | `lib/validation/billing.ts` lines 11–21, `BILLING_EVENT_TYPES` |
| **the GitHub remote is 18 commits behind** | `git log origin/main --oneline` → `82f22b8`; `git rev-list --count origin/main..HEAD` → **18** |
| a registered endpoint must be a public HTTPS URL, is created in Workbench or via the API, and Stripe **resends undelivered events for up to three days** | `search_stripe_documentation`, live, 2026-08-14: `https://docs.stripe.com/webhooks` §"Register your endpoint" |

## Reference material read for this prompt

| path | what was read |
| --- | --- |
| `AGENTS.md` | §1 workflow and the resume rules, §2 commands, §5.2 build sequence, §7.2 providers, §7.3 the Neon and Clerk traps, §8.1 the landing page, §8.4 secrets and the variable table, §12 rules 2–8 |
| `docs/backend.md` §"Still not closed" (l. 2075) and §"Still open, after 030" (l. 2552) | the four open items, and the exact wording "Do this when a deployment of this commit exists" |
| `docs/backend.md` l. 2040–2065 | the M10 reasoning about retries, which becomes observable for the first time under this prompt |
| `app/api/stripe/webhook/route.ts` | `runtime = "nodejs"`, `dynamic = "force-dynamic"`, and the nine handled event types |
| `lib/billing/stripe.ts` | `getStripe()` and `getStripeWebhookSecret()`, both lazy, both throwing a named error when the variable is absent |
| `app/(app)/account/billing/actions.ts` l. 1–90 | `origin()`, `success_url`, `cancel_url`, `return_url` |
| `proxy.ts` | the matcher, and that `/api/stripe/webhook` is outside it, so no Clerk gate stands in front of the endpoint |
| `lib/validation/billing.ts` | `BILLING_EVENT_TYPES`, `checkoutSessionMarkerSchema` |
| `docs/automation.md` §"Stripe" (l. 255–300) | the existing `stripe listen` procedure this prompt supersedes for the deployed case |
| live: `https://docs.stripe.com/webhooks` | register-your-endpoint, retry window, Workbench vs API |
| live: Vercel deployments skill | `vercel deploy --prod`, `vercel promote`, `vercel inspect`, `vercel logs` |

## SKILLS USED

| skill | what it is for |
| --- | --- |
| `vercel:deployments-cicd` | `vercel deploy --prod`, `promote`, `inspect`, `logs`, and the deploy-result reporting format. Loaded while writing this prompt |
| `vercel:env-vars` | `vercel env add` / `ls` / `pull` per environment, and which environments a variable must target |
| `vercel:vercel-cli` | the CLI surface generally, and `--yes` in non-interactive use |
| `stripe-docs` | the registered-endpoint surface: creating an event destination, its signing secret, the retry window. **Live docs, not memory** (§1 step 2b) |
| `vercel:nextjs` | confirming that a Route Handler with `runtime = "nodejs"` and `force-dynamic` deploys as a Function and is not prerendered |
| `neon-postgres` | confirming what a single Neon branch shared across Production and Development means before recommending anything about it |
| `drizzle-docs` | only if the deployed database turns out to be missing a migration; the read-only check below is what decides that |

Every one of these is invoked at execution time, before any command is run
(§4, "listing is not loading").

## Render impact

**No route's source changes, and no route's render mode changes.** This prompt
adds no file to `app/`, `components/` or `lib/`. The local `npm run build`
route table must come out identical to the 22-route table `docs/backend.md`
records for `8cc7f75`, and the prerendered `/` must still be **125,912 bytes**,
per the comparison in `docs/automation.md`.

What changes is **where the existing routes run**: the production alias starts
serving this commit instead of a two-day-old one. That is a deployment, not a
render change, and it is verified by diffing the deployed route table against
the local one rather than asserted.

## Trust boundary

The one boundary this prompt actually changes:

**`POST https://ether-bay.vercel.app/api/stripe/webhook` becomes reachable from
the public internet.** It was 404 before because the deployed build predates it.

- **What crosses.** A Stripe event body plus a `stripe-signature` header.
- **Where it is validated.** `getStripeWebhookSecret()` then
  `stripe.webhooks.constructEvent`, in the route, before anything is read off
  the body. An unsigned or wrongly-signed request is rejected there.
- **What authorises it.** The signing secret alone. This is the whole reason
  `STRIPE_WEBHOOK_SECRET` must be the **registered endpoint's** secret and not
  the `stripe listen` secret already in `.env.local`: they are different
  secrets, and pasting the local one would make every real delivery fail
  signature verification.
- **What a rejected request returns.** Whatever the route already returns; this
  prompt changes no branch of it.
- **Not in the matcher.** `proxy.ts` matches only `/generate`, `/account`,
  `/library` and `/g`, so Clerk never stands in front of the endpoint. Verified
  by reading `proxy.ts`, and re-verified after deployment by the 200 below.

**The second boundary, stated because it is easy to miss:** the rest of the app
becomes publicly reachable on this commit too, including `/generate`, which
spends the account-wide Cloudflare neuron allocation (§7.3). The per-user cap
from step 9 applies to every signed-in user; the account-wide ceiling is not
modelled by it. Clerk's own sign-up gate is what stands between the internet and
that endpoint, and it is unchanged by this prompt.

## Secrets and data

**Read by this change:** none. No application code is edited, so no new
`process.env` read is introduced.

**Written to the Vercel project:**

| variable | environment | why |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | **add Production** | `getStripe()` throws without it, so every billing action and the whole webhook route fail on the deployed build. Currently Development + Preview only. **Test-mode key, unchanged value** |
| `STRIPE_WEBHOOK_SECRET` | **add Production** | new. The value is the **registered endpoint's** signing secret, obtained in step D, and it is **not** the value in `.env.local` |

**Deliberately not added:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_PUBLISHABLE_KEY`, `STRIPE_MCP_KEY`. The `grep` above proves no code
reads any of them; adding them to Production would put an unread key into a
deployed environment for no reason. `AGENTS.md` §8.4 already says this and the
grep confirms it rather than trusting it.

**`.env.local` is not modified.** Its `STRIPE_WEBHOOK_SECRET` stays the
`stripe listen` secret, because that is what local development uses. The two
secrets coexist and must not be confused — a line in `docs/backend.md` says so
explicitly when this is done.

**No secret value is ever echoed** (§8.4). `vercel env ls` shows names, and that
is the only listing quoted. The new signing secret is piped from the creating
command into `vercel env add` without being printed, and the transcript shows
the variable name only.

**User data:** none is stored, logged or transmitted by this change. No prompt,
no email address, no image. The verification below reads counts and statuses out
of the database and prints no row content, exactly as `tests/owner-db` does.

## The work, in order

Each step names what proves it, and no step is reported as done without its
output (§12 rule 3).

### A. Confirm the tree and the local build first

`git status --porcelain` clean, then `npm run build`. Diff its route table
against the `8cc7f75` baseline per `docs/automation.md`; it must print
`ROUTES IDENTICAL`. Compare the prerendered `/`; it must print
`LANDING IDENTICAL` at 125,912 bytes. **A deployment of a build that has not
been checked locally is the thing this step exists to prevent.**

### B. Put `STRIPE_SECRET_KEY` into Production

`vercel env add STRIPE_SECRET_KEY production`, value taken from `.env.local`
without being displayed. Re-run `vercel env ls` and confirm the name now shows
Production. **Do this before deploying**, so the first production build already
has it.

### C. Deploy this commit to production

First **establish whether the project is Git-connected**, which this prompt
could not settle: the project's domain list contains
`ether-git-main-dgsloxx417s-projects.vercel.app`, which is evidence of a Git
connection, but `vercel project inspect` printed no Git section and the API call
that would have answered it was denied. Check it, record the answer, and then:

- **If it is Git-connected:** push `main` to `origin` (18 commits) and let the
  Git integration build. Record the deployment URL from `vercel ls`.
- **If it is not:** `vercel deploy --prod` from the working tree, and push
  `main` to `origin` separately so the remote stops being 18 commits behind a
  running production build.

**Pushing to GitHub is an outward-facing action and it is part of what this
prompt asks approval for.** `AGENTS.md` §1 step 11 says do not push unless
asked; approving this file is the asking.

Then verify: `curl` the alias root for 200, and
`curl -X POST https://ether-bay.vercel.app/api/stripe/webhook` for **anything
other than 404** — an unsigned POST should be rejected by signature
verification, and the exact status is recorded as observed rather than
predicted here.

### D. Register the endpoint, test mode

Create a test-mode event destination pointing at
**`https://ether-bay.vercel.app/api/stripe/webhook`**, subscribed to exactly the
nine types in `BILLING_EVENT_TYPES`:

```
checkout.session.completed
checkout.session.async_payment_succeeded
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
refund.created
charge.dispute.created
charge.dispute.closed
```

**Verify the creation surface against the live API reference before running it**
(§12 rule 2). Stripe's docs name both Workbench and the API, and the v1
`webhook_endpoints` and v2 `event_destinations` surfaces are different shapes
with different field names. Do not reconstruct either from memory, and do not
assume where the signing secret appears in the response — read it off the
reference, and if the secret is only returned once at creation, capture it in
the same command that creates the endpoint.

Then `vercel env add STRIPE_WEBHOOK_SECRET production` with that value, and
**redeploy or promote**, because a Vercel environment variable does not reach a
build that already ran.

### E. Prove a real delivery, without a card and without a browser

`stripe trigger checkout.session.completed` against the sandbox. The event is a
**foreign** session — it carries no `ether_offer_key` marker — so prompt 028's
fix is the expected path: the route answers **200** and ignores it.

That is a weak assertion about billing and a strong one about everything this
prompt changes, which is the point. A 200 here proves, over the network and for
the first time in this project's history:

- the endpoint is registered and Stripe can reach it;
- **signature verification passes with the registered secret**, which no local
  run has ever exercised;
- the deployed Function has `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`;
- the deployed build can reach Neon, because `claimBillingWebhook` writes before
  the handler returns.

Confirm from **both** sides: the delivery status on the Stripe event, and a
read-only count of `billing_webhook` rows for that event id via
`docs/automation.md`'s query procedure. **Print the status and the count, never
the row.**

Then check `vercel logs` on the deployment for errors, and confirm no prompt,
email address or request body appears in them (§8.3 rule 2). If any does, that
is a finding and it is fixed before this prompt is called done.

### F. Record it

`docs/backend.md` gets a new section for prompt 031: what was deployed, the
alias, the endpoint id, which variables now exist on which environments, the
observed statuses, and the **corrected open list**. `AGENTS.md` §8.4's table
gets `STRIPE_WEBHOOK_SECRET`'s source line corrected, because it currently says
"Not set in the Vercel project, because no deployment of the webhook exists
yet" and that stops being true here (§12 rule 8).

`docs/automation.md` gets the deployed-webhook verification as a command, per
§3: it is now the second time a Stripe delivery has been verified by hand.

## The two things this prompt does not close, and says so

**1. Clerk is running on a development instance.** The publishable key in
`.env.local` and in the Vercel project starts `pk_test_`, which is a Clerk
**development** instance, and it is the same key on Production, Preview and
Development. Clerk's development instances carry limits that production traffic
would hit, and a Clerk production instance requires a **custom domain with DNS
records** — and `vercel domains ls` returns zero domains for this team.

The execution **verifies the exact limits against Clerk's live docs rather than
asserting them here**, and records what it finds. What is already certain is
that this is a real ceiling and that lifting it costs a domain purchase, which
is a billable decision for the user (§7.4 rule 4). **The deployment is honest
about being a test-mode deployment on a development Clerk instance, and no copy
anywhere claims otherwise.**

**2. Production and local share one Neon branch.** `vercel env ls` shows a
single `DATABASE_URL` across Production, Preview and Development, so the
deployed app writes into the same database `npm run test:db`,
`test:billing-db` and `test:owner-db` write into. That is worth knowing before
anyone treats the deployed site as real, and a separate Neon branch for
Production is the obvious answer — but **it is a change to provisioning, not
part of this prompt**, and §7.4 says to ask before provisioning. It is named
here, recorded in `docs/backend.md`, and left for the user.

## Non-goals

- **Live mode.** No live key, no live endpoint, no real charge. A business
  decision, unchanged.
- **A custom domain.** Billable, and the user's call.
- **A Clerk production instance.** Gated on the domain.
- **Turning off Vercel Authentication.** It is not in the way: the alias already
  answers 200. Leave `ssoProtection` exactly as it is.
- **Any change to `app/`, `components/`, `lib/`, `proxy.ts` or
  `next.config.ts`.** If the deployment reveals a code defect, that is a finding
  reported at the end, and its fix is a separate prompt unless it is what stops
  this one from being verifiable at all.
- **A CI workflow file.** The deployments skill offers GitHub Actions templates;
  this project has no CI and does not need one to answer the open items.
- **The two-account browser boundary.** Still needs two real sign-ins, still
  prohibited for the implementing agent. This prompt makes it *possible* for the
  user to do; it does not claim to have done it.
- **Migrating the deployed database.** The read-only check tells us whether it
  is already current; it is, unless that check says otherwise.

## Files

**Creates:** nothing in the application.

**Modifies:**

- `docs/backend.md` — the prompt 031 section, and the corrected open list
- `docs/automation.md` — the deployed-webhook verification command
- `AGENTS.md` — **one line only**, the `STRIPE_WEBHOOK_SECRET` row of §8.4's
  table, per §12 rule 8. No new invariant; this prompt earns none

**Must not touch:** `app/`, `components/`, `lib/`, `proxy.ts`,
`next.config.ts`, `package.json`, `drizzle/`, `tests/`, `design-system.md`,
`.env.local`, and every existing file in `prompts/`.

## Checks, and where each result is recorded

All output quoted exactly, in `docs/backend.md` (§8.5).

| check | expected |
| --- | --- |
| `git status --porcelain` | empty before deploying |
| `npm run build` | compiles; route table `ROUTES IDENTICAL` against `8cc7f75`; `/` `LANDING IDENTICAL` at 125,912 bytes |
| `npm run lint` | no diagnostics |
| `npm test` | 12 pass |
| `npm run test:db` / `test:billing-db` / `test:owner-db` | 1, 7 and 6 pass. Unchanged, since no code changes |
| the environment-absent build | passes, same route table, `.env.local` restored and confirmed present |
| `vercel env ls` | `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` both show Production. **Names only** |
| `curl` the alias root | 200 |
| `curl -X POST` the webhook path | no longer 404; the status is recorded as observed |
| `stripe trigger checkout.session.completed` | delivered to the registered endpoint, **200**, one `billing_webhook` row, no row content printed |
| `vercel logs` | no prompt, email address or request body present |

A client-bundle secret scan is warranted here even though no code changed,
because a **deployed** bundle is being served for the first time on this commit:
search the deployed client chunks for the Clerk secret and the blob token, and
record the result (§8.4, "verify it, do not assume it").

---

I prepared the implementation prompt at
`prompts/031-production-deployment-and-registered-stripe-webhook.md`.
Is this good to execute?
