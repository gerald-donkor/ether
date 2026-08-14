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

When comparing different commits through the documented `--webpack` fallback,
the flight payload can also contain build-specific module ids and chunk lists.
Do not keep widening a regex until that diff disappears. First inspect the raw
diff for an actual page-data change, then compare the server-rendered document
with scripts removed:

```bash
perl -0pe 's#<script\b.*?</script>##gs; s#<link rel="preload" as="script"[^>]*>##g; s#<link rel="stylesheet" href="[^"]+"#<link rel="stylesheet" href="STYLE"#g; s#__variable_[A-Za-z0-9_]+#FONT#g' \
  /tmp/index-before.html > /tmp/visible-before.html
perl -0pe 's#<script\b.*?</script>##gs; s#<link rel="preload" as="script"[^>]*>##g; s#<link rel="stylesheet" href="[^"]+"#<link rel="stylesheet" href="STYLE"#g; s#__variable_[A-Za-z0-9_]+#FONT#g' \
  /tmp/index-after.html > /tmp/visible-after.html
diff /tmp/visible-before.html /tmp/visible-after.html && echo IDENTICAL
```

This fallback compares the complete server-rendered document and removes only
executable build wiring. It is not a substitute for the raw-diff inspection.

A visual pass is still worth doing for motion, which markup identity says
nothing about. `resize_window` in the browser tools did **not** reflow this
page's viewport when it was tried on 2026-08-13. Capture a fresh page at each
breakpoint instead of resizing one browser page and assuming it changed.

### When the diff is supposed to be non-empty

A change that deliberately alters `/` cannot use `IDENTICAL` as its result. It
still has to prove the change is confined to the elements it claimed. The
normalisation above will not help, because the byte counts legitimately differ,
and a whole-document `diff` on a minified single-line HTML file reports one
enormous line. **Split the document on tag boundaries first**, then diff:

```bash
for f in before after; do
  perl -0pe 's#<script\b.*?</script>##gs;
             s#<link rel="preload" as="script"[^>]*>##g;
             s#<link rel="stylesheet" href="[^"]+"#<link rel="stylesheet" href="STYLE"#g;
             s#__variable_[A-Za-z0-9_]+#FONT#g' /tmp/index-$f.html \
  | perl -0pe 's#(<)#\n$1#g' > /tmp/visible-$f.txt
done
diff /tmp/visible-before.txt /tmp/visible-after.txt
```

The result is a per-element diff you can read. **Do not use `tr '>' '>\n'` for
the split** - it breaks inside attribute values and produces a 200KB diff of
noise. Split on `<`, the tag opener, which no attribute value on this page
contains.

The pass condition is that every hunk is an element the prompt named. Used on
2026-08-13 to show that turning the two feature media pills into lockups changed
exactly four lines of `/` and nothing else.

### Confirm a tab stop was removed without walking the whole page

Markup identity says a stop was not lost; it does not say the intended one went
away. Run this in the page rather than pressing Tab thirty times:

```js
const f=[...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')];
JSON.stringify({count:f.length, hits:f.filter(e=>/<label>/.test(e.textContent)).length})
```

The count is compared against the before count, and the delta must equal the
number of stops the change intended to remove. Then Shift+Tab from the stop that
followed the removed one and read `document.activeElement` to confirm focus now
skips straight past it. Check `getComputedStyle(document.activeElement).outlineColor`
is `rgb(210, 255, 58)` while you are there - that is `--lime`, and it is the
§6.8 ring.

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

## Exercise an owner boundary without logging user data

**For the generation paths this is now a committed suite, not a procedure.**
`npm run test:owner-db` (`tests/owner-boundary.integration.ts`, prompt 030)
covers the recent list and count, the permalink read, the library page and its
search, the four owner mutations, the removed-row read, the three anonymous
projections, reporting in both directions, the takedown, the owner usage
summary, the export and the purge. Run it rather than rebuilding any of that by
hand, and extend it rather than writing a new `/tmp` module for anything it
already reaches.

The procedure below stays for a path the suite does not cover — a new table, a
new projection, or **any check that asserts a Blob object is gone**, which the
committed suite deliberately does not do. It was worked out for the library and
repeated for sharing. Use it for a query or mutation whose decisive property is
that one owner cannot read or change another owner's row.

1. Create a temporary TypeScript module in `/tmp`, never in the repository.
2. Load `.env.local` with the committed `dotenv` wrapper and import only the
   query-layer functions under test.
3. Insert synthetic rows for two synthetic owner ids. Use a temporary Blob only
   if the projection or cleanup path needs a real URL.
4. Exercise the owner read or mutation with both ids. For sharing, cover every
   visibility plus a removed row, prove the anonymous projection omits prompt
   and owner, and prove only live public rows reach Community.
5. Print booleans and aggregate counts only. Never print owner ids, prompts,
   row ids, Blob URLs, or search values.
6. Clean up every synthetic row and temporary Blob in `finally`, then run an
   aggregate query proving no synthetic rows remain.

**When the check asserts a Blob object is gone, poll rather than fetch once.**
A `del()` that has returned can still be served as `200` for several seconds,
and a single immediate fetch reports a false failure. Measured on 2026-08-13:
`200` at +0ms, +1s, +2s and +4s, then `404` at +8s, while an isolated delete of
the same kind answered `404` immediately. The delay is variable, so back off
across roughly 15 seconds and break on the first `404`.

Run the module with the existing environment discipline:

```bash
node_modules/.bin/dotenv -e .env.local -- node_modules/.bin/tsx /tmp/<check>.ts
```

The test is not complete merely because its assertions passed. Cleanup is part
of the check, and a failed cleanup is reported as a failure.

## Run the Stripe sandbox matrix against the local dev server

Worked out at prompt 025 as a plan and executed at prompt 027, which is the
second time, so it is captured here (§3). This needs no Dashboard endpoint and
no deployment: `stripe listen` is its own destination.

```bash
npm install -g @stripe/cli   # user-owned prefix, no sudo. postinstall is
                             # blocked by npm policy and the binary still works
```

**Never `stripe login`.** An interactive login could select a different account
than the application uses. Every command carries the key the app reads, so the
CLI and the app are provably the same sandbox:

```bash
set -a && . ./.env.local && set +a
stripe <command> --api-key "$STRIPE_SECRET_KEY"
```

Prove that before trusting it, by reading a catalog Price back and checking
`livemode: false`, `active: true` and the expected lookup key against the
catalog table in `docs/backend.md`.

The signing secret is stable across restarts, so it is written once. Extract it
without ever printing it, because the version-check banner goes to the same
stream:

```bash
S=$(stripe listen --api-key "$STRIPE_SECRET_KEY" --print-secret 2>/dev/null \
    | grep -oE 'whsec_[A-Za-z0-9]+' | head -1)
printf 'STRIPE_WEBHOOK_SECRET="%s"\n' "$S" >> .env.local
```

Then run the dev server and the forwarder, both backgrounded with their output
captured, and redact the secret out of anything you quote from the log:

```bash
npm run dev > dev.log 2>&1 &
stripe listen --api-key "$STRIPE_SECRET_KEY" \
  --forward-to http://localhost:3000/api/stripe/webhook > listen.log 2>&1 &
sed -E 's/whsec_[A-Za-z0-9]+/whsec_<redacted>/g' listen.log
```

The forwarder's paired `-->` and `<-- [status]` lines are the delivery evidence,
and the gap between them is the handler's real latency.

### The assertion snapshot

Use the read-only script pattern above, selecting **never** `prompt` and
**never** `image_url`, and hash the Clerk owner id to a short tag before
printing. Take a snapshot before the matrix and after every step, then `diff`
consecutive snapshots so each assertion is about what changed. `diff` returning
nothing is the whole proof for a replay test.

The column names are not guessable from the table names. As of prompt 027 they
are `credit_ledger.delta` (not `credits_delta`), `billing_webhook_events.type`
(not `event_type`) with `event_created_at`, and
`billing_subscriptions.provider_event_created_at`.

### What a trigger can and cannot do

- **`stripe trigger` objects belong to customers this database has never seen**,
  so `ownerFor` throws for them. Triggers are negative tests only. Every
  positive test goes through the application's own Checkout so the Customer,
  the PaymentIntent and the ledger row belong to a real signed-in owner.
- **`stripe trigger` cannot produce `refund.created` or
  `charge.dispute.closed`.** Act on real objects instead:
  `stripe refunds create --payment-intent <pi> --amount <minor>` and
  `stripe disputes close <du>`.
- **`stripe events resend <id>` cannot test an ordering guard.** The id is
  already in `billing_webhook_events`, so the handler short-circuits at the
  claim and never reaches the provider event time comparison. That resend tests
  the *replay* path, which is a different thing. To reach the guard, re-deliver
  the real payload under a fresh event id, signed with the SDK:

```ts
const payload = JSON.stringify({ ...source, id: `evt_test_${Date.now()}` });
const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
await fetch(endpoint, { method: "POST", body: payload,
  headers: { "content-type": "application/json", "stripe-signature": header } });
```

Only the `id` is synthetic. Say so when recording the result.

### Rejection tests need no CLI

```bash
curl -s -o /dev/stderr -w "status=%{http_code}\n" -X POST \
  http://localhost:3000/api/stripe/webhook -H 'content-type: application/json' \
  -d '{"id":"evt_forged","type":"invoice.paid","created":1,"livemode":false,"data":{"object":{}}}'
```

Expect `400 {"error":"Missing signature"}`, and `400
{"error":"Invalid signature"}` when a made-up `stripe-signature` is added. Then
assert **zero** `billing_webhook_events` rows for those ids: a rejected request
must not claim an event.

### Driving the forms in this app from the browser

`form_input` sets the DOM value without React's `onChange`, so a controlled
input stays empty and the action receives nothing. Synthetic `Tab` keypresses
also did not move focus on 2026-08-14. Drive a controlled input through the
native setter instead, and verify focus rings by calling `.focus()` and reading
the computed style rather than by pressing Tab:

```js
const el = document.querySelector('input[name="prompt"]');
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  .set.call(el, 'the text');
el.dispatchEvent(new Event('input', { bubbles: true }));
```

`outlineWidth` comes back as the **used** value, so browser zoom scales it:
`1.33333px` at a 0.75 `devicePixelRatio` is the 2px rule in `app/globals.css`,
not a different one. Compare the colour, `rgb(210, 255, 58)`, and check
`outlineOffset` scales with it by the same factor.

### Replay an event the handler already processed

Worked out at prompt 028 and used four times in that one session, so it is
captured (§3). `stripe events resend` alone does **not** re-run the handler for
an event already in `billing_webhook_events` as `processed`: `claimBillingWebhook`
short-circuits at the claim and answers 200 having done nothing. That is correct
behaviour and it is exactly what makes a replay test look like a pass.

Put the one row back to `failed` first, which is the state `claimBillingWebhook`
already reclaims immediately, then resend:

```ts
await sql`update billing_webhook_events set status = 'failed',
          error_category = 'replay' where stripe_event_id = ${EVENT}`;
```

```bash
stripe events resend "$EVENT" --api-key "$STRIPE_SECRET_KEY" > /dev/null
```

**Say in the record that you did this.** It is a write to application state made
to enable a test, and a run that hides it is claiming a replay it did not do.

Replaying a `charge.dispute.created` reopens the hold, so a dispute that was
genuinely closed needs its `charge.dispute.closed` replayed after it or the
account is left held by the test rather than by Stripe.

### Trigger a foreign event that still looks like ours

To exercise the "carries our marker but the app cannot resolve it" branch
without a browser Checkout, add the marker to a fixture:

```bash
stripe trigger checkout.session.completed --api-key "$STRIPE_SECRET_KEY" \
  --add "checkout_session:metadata[ether_offer_key]=top_up_100"
```

`--add` takes `resource:field=value` and nested metadata in bracket form. Read
the event back with `stripe events retrieve` and confirm the metadata actually
landed **before** asserting anything about the status code, or the test proves
only that an unmarked fixture behaves like an unmarked fixture.

### Drive a subscription renewal with a test clock

Worked out at prompt 029, and captured because the naive version of it fails
silently: the renewal invoice stays in `draft` and the run reports no renewal
rather than reporting an error.

```ts
const clock = await stripe.testHelpers.testClocks.create({
  frozen_time: Math.floor(Date.now() / 1000),   // the real now or later, so the
});                                             // periods land in the real future
const customer = await stripe.customers.create({ test_clock: clock.id });
const method = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
await stripe.customers.update(customer.id, {
  invoice_settings: { default_payment_method: method.id },   // not "pm_card_visa"
});
```

Four things the docs do not make obvious, each of which cost a run:

1. **`pm_card_visa` is not the attached id.** `attach` returns a real `pm_…`;
   setting the default to the literal token fails with "the payment method must
   be attached to the customer".
2. **Insert a `billing_customers` row for a throwaway owner** before creating
   the subscription, or `ownerFor` throws `Unknown Stripe customer` and every
   event fails. Delete it, and its ledger rows, when the run finishes.
3. **Use the catalog price**, resolved by lookup key. `syncSubscription` rejects
   an unapproved price, so an ad-hoc one tests nothing.
4. **"Advance the time by one hour" is not enough.** After advancing past
   `current_period_end`, read the draft invoice's **`automatically_finalizes_at`**
   and advance past *that*:

```ts
const [draft] = (await stripe.invoices.list({ customer: customer.id, status: "draft" })).data;
await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: draft.automatically_finalizes_at + 3900 });
```

Poll the clock's `status` until `ready` after every advance, and then poll the
invoice list until two invoices read `paid` — "Stripe collects payments after
the test clock advances", so `ready` is not the end of it.

Clean up by deleting the clock, which deletes the customer and the subscription
with it. **Delete the clock first and wait for the event burst to drain**, then
remove the `billing_customers` row: the other order makes the handler answer 500
for `customer.subscription.deleted` on an owner the database no longer knows.

**A test clock cannot verify credit expiry.** It moves Stripe's clock;
`reconcile_credit_balance` keys on PostgreSQL's `now()`. Expiry is verified in
`tests/billing-db.integration.ts` by moving a grant's `expires_at` into the real
past. See `docs/backend.md`, prompt 029.
