---
name: drizzle-docs
description: >-
  Use when reading, searching or writing anything against Drizzle ORM or
  drizzle-kit: schema definition in lib/db/schema.ts, column types, indexes and
  constraints, relations, queries and filters, insert/update/delete, prepared
  statements, drizzle-zod validators, the Neon serverless driver, and generating
  or applying migrations. Prefer this over recalling the Drizzle API from
  memory, and over a bare WebFetch of orm.drizzle.team.
license: MIT
metadata:
  short-description: Official Drizzle live docs, plus vetted PostgreSQL patterns
  installed-versions: drizzle-orm 0.45.2, drizzle-kit 0.31.10
  upstream: https://github.com/honra-io/drizzle-best-practices
  upstream-commit: c1bc07273a843190f5f9ce6e12b957864d93ee8f (2026-05-24)
  installed: 2026-08-14
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebFetch
  - Bash(curl -sL https://orm.drizzle.team/*)
---

# Drizzle

**Your training data about Drizzle is probably wrong about the thing you are
about to write.** Drizzle is mid-transition to v1 and the relations and
relational-query APIs differ between the lines. Resolve the API from the three
sources below, in this order, before writing code.

## 1. The installed version wins

This project runs **drizzle-orm 0.45.2** and **drizzle-kit 0.31.10**, so the
**0.45.x** API applies, not the v1 RC. Confirm rather than trust this line:

```bash
node -p "require('./node_modules/drizzle-orm/package.json').version"
node -p "require('./node_modules/drizzle-kit/package.json').version"
```

When live docs and the installed `.d.ts` disagree, **the installed types win**
(`AGENTS.md` §1 step 2b, §12 rule 2). The types are under
`node_modules/drizzle-orm/` — `pg-core/` for the PostgreSQL builders this
project uses.

## 2. Official live documentation

Drizzle publishes a first-party, machine-readable docs index. Use it instead of
guessing a URL:

```bash
# The index: every docs page, deep-linked. ~37KB, read this first.
curl -sL https://orm.drizzle.team/llms.txt

# The whole corpus inlined. ~3.6MB, so grep it rather than reading it.
curl -sL https://orm.drizzle.team/llms-full.txt | grep -n -A20 "prepared statement"
```

Individual pages are markdown-addressable, for example
`https://orm.drizzle.team/docs/column-types/pg`.

Both endpoints were verified live on 2026-08-14.

## 3. The bundled patterns

`references/` holds vetted Drizzle-with-PostgreSQL guidance: correct versus
incorrect examples with the rationale for each. `references/_sections.md` is its
table of contents. The files that matter most on this project:

| file | when |
| --- | --- |
| `schema-table-definitions.md`, `schema-column-types.md`, `schema-indexes-constraints.md` | anything touching `lib/db/schema.ts` |
| `migrations-workflow.md`, `migrations-config.md` | `npm run db:generate` / `db:migrate` |
| `driver-serverless.md`, `driver-postgres.md` | the Neon serverless driver and the pooled/direct split |
| `query-select-patterns.md`, `query-filters-operators.md`, `query-mutations.md` | anything in `lib/db/` |
| `query-error-handling.md` | typed failures on the write path |
| `perf-prepared-statements.md`, `perf-batch-operations.md` | `db.batch(...)` and hot reads |
| `types-inference.md`, `types-validators.md` | `drizzle-zod`, inferred row types |
| `relations-defining.md`, `relations-querying.md` | **read the version note first** — this is the v1-versus-0.45.x split |
| `engine-postgres.md`, `advanced-sql-operator.md` | JSONB, arrays, enums, identity columns, raw `sql` |

`UPSTREAM-SKILL.md` is the upstream entry point, kept verbatim for provenance.

## This project's own rules still bind

`references/` is general Drizzle advice and does not know about this codebase.
Where it conflicts with `AGENTS.md`, `AGENTS.md` wins. In particular:

- **No SQL, ORM or query builder outside `lib/db/`** (§6.1, §7.5).
- **Drizzle owns schema and migrations exclusively.** Never hand-write or
  hand-number a migration; `npm run db:generate` produces it (§7.2).
- **Migrations run over `DATABASE_URL_UNPOOLED`**, the direct connection. The
  app uses pooled `DATABASE_URL`. Using the wrong one fails silently (§7.3).
- **Construct the client lazily** via `getDb()`, never at module scope, and
  **never wrap it in a `Proxy`** (§7.3).
- **Nothing but Next.js auto-loads `.env.local`** — drizzle-kit needs
  `dotenv -e .env.local --` in front of it (§7.3).
- Every module here carries `import "server-only"`.

## Provenance

`references/` and `UPSTREAM-SKILL.md` are from
[honra-io/drizzle-best-practices](https://github.com/honra-io/drizzle-best-practices)
by Marc A. Maceira Zayas, MIT licensed, at commit `c1bc072` (2026-05-24),
retained in `LICENSE`. It is **not** an official Drizzle project. There is no
first-party Drizzle agent skill as of 2026-08-14; the official material is the
live documentation in section 2, which is why that section outranks this one.

Because the bundled content predates the installed release, **treat section 2 as
authoritative whenever the two disagree**, and say so rather than silently
picking one (§12 rule 8).
