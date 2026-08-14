---
name: zod-docs
description: >-
  Use when writing or changing any Zod schema: request and form validation in
  lib/validation/, parsing provider payloads such as Stripe metadata, env var
  parsing, enums and discriminated unions, refinements, transforms, codecs,
  branded types, error shaping, and v3 to v4 migration. Triggers on z.object,
  z.enum, z.infer, safeParse, strictObject, or any mention of schema
  validation. Prefer this over recalling the Zod API from memory.
license: MIT
metadata:
  short-description: Official Zod live docs, plus vetted v4 rules
  installed-version: zod 4.4.3
  upstream: https://github.com/anivar/zod-skill
  upstream-commit: bb0620d90ed0b6f693f24f6941ade54c9bc7d330 (2026-08-08)
  installed: 2026-08-14
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebFetch
  - Bash(curl -sL https://zod.dev/*)
---

# Zod

**Zod 4 broke the APIs your training data remembers.** String formats, enums,
error handling and recursive types all changed, and v3 patterns still typecheck
in places while behaving differently. Resolve the API from the three sources
below, in this order, before writing a schema.

## 1. The installed version wins

This project runs **zod 4.4.3** (`package.json` declares `^4.3.6`). Confirm
rather than trust this line:

```bash
node -p "require('./node_modules/zod/package.json').version"
```

When live docs and the installed `.d.ts` disagree, **the installed types win**
(`AGENTS.md` §1 step 2b, §12 rule 2).

## 2. Official live documentation

Zod publishes a first-party, machine-readable docs index with deep anchors. Use
it instead of guessing:

```bash
# The index: every API section, deep-linked. ~21KB, read this first.
curl -sL https://zod.dev/llms.txt

# The whole corpus inlined. ~267KB, so grep it rather than reading it.
curl -sL https://zod.dev/llms-full.txt | grep -n -B5 -A25 "discriminatedUnion"
```

Anchors from the index resolve directly, for example
`https://zod.dev/api?id=strings`.

Both endpoints were verified live on 2026-08-14.

## 3. The bundled rules

`rules/` holds one focused rule per file; `references/` holds the longer
treatments. Read the rule, then the reference only if you need the rationale.

| prefix | covers |
| --- | --- |
| `parse-` | `safeParse` over `parse`, async parsing, inferring types |
| `schema-` | object unknowns, coercion pitfalls, recursive types, discriminated unions |
| `refine-` | cross-field checks, refine versus transform, never throwing |
| `error-` | custom messages, formatting, not leaking input |
| `perf-` | reusing and extending schemas, zod-mini |
| `migrate-` | v3 to v4: string formats, native enums, the error API |
| `pattern-` | branded types, codecs, `.pipe()` |
| `arch-` | where parsing belongs, schema organisation and versioning |

`references/anti-patterns.md` and `references/testing-anti-patterns.md` are the
highest-value files to read before adding a schema.
`UPSTREAM-SKILL.md` is the upstream entry point, kept verbatim for provenance.

## This project's own rules still bind

Where the bundled content conflicts with `AGENTS.md`, `AGENTS.md` wins:

- **`lib/validation/` is deliberately not `server-only`.** Its schemas are
  imported by client leaves *and* by Server Actions, which is what makes "the
  rules exist once and run twice" true (§6.3, §10 rule 1). Nothing that reads a
  secret may be added to it, and it must not import from `lib/db/`.
- **Validation runs twice and the schema exists once.** The client copy is a
  courtesy; the server copy is the check (§6.2).
- **An action returns a discriminated union and never throws to the client**
  (§10 rule 2). A `safeParse` failure becomes typed field errors, not an
  exception.
- **A provider payload is hostile input.** `z.strictObject` is the default for
  a shape we own; a shape the provider may extend, such as Checkout Session
  metadata, uses a non-strict object deliberately and says why in a comment.
- **Never log a parse failure that contains the input** — no prompts, no email
  addresses, no request bodies (§8.3 rule 2).

## Provenance

`rules/`, `references/` and `UPSTREAM-SKILL.md` are from
[anivar/zod-skill](https://github.com/anivar/zod-skill) by Anivar Aravind, MIT
licensed, at commit `bb0620d` (2026-08-08), retained in `LICENSE`. Its stated
baseline is `zod ^4.3.0`, tracking 4.4.x and audited against zod.dev in August
2026, which matches the installed 4.4.3.

It is **not** an official Zod project. There is no first-party Zod agent skill
as of 2026-08-14; the official material is the live documentation in section 2,
which is why that section outranks this one.
