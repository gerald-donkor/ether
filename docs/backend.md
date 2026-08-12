# Ether backend

This is the build record for Prompt 009. The product uses Next.js Server
Actions for its own mutations and Server Components for initial reads. There is
no separate API server and no app-owned Route Handler in this step.

## Stack and package versions

| Surface | Package | Installed version |
| --- | --- | --- |
| Identity | `@clerk/nextjs` | 7.7.4 |
| Postgres transport | `@neondatabase/serverless` | 1.1.0 |
| ORM | `drizzle-orm` | 0.45.2 |
| Migrations | `drizzle-kit` | 0.31.10 |
| Blob storage | `@vercel/blob` | 2.8.0 |
| AI Gateway | `ai` | 7.0.64 |
| Validation | `zod` | 4.4.3 |
| Script environment loading | `dotenv-cli` | 11.0.0 |

Clerk owns identity. Ether does not duplicate users in Postgres.

## Data model

Drizzle owns the schema in `lib/db/schema.ts`. The committed migration is
`drizzle/0000_mean_random.sql`.

### `generations`

| Column | PostgreSQL type | Constraint or purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key, defaults to `gen_random_uuid()` |
| `user_id` | `text` | Not null, Clerk user id |
| `prompt` | `text` | Not null, the user's trimmed prompt |
| `image_url` | `text` | Not null, public Vercel Blob URL |
| `model` | `text` | Not null, AI Gateway model id |
| `width` | `integer` | Not null, decoded from the returned image |
| `height` | `integer` | Not null, decoded from the returned image |
| `created_at` | `timestamp with time zone` | Not null, defaults to `now()` |

Indexes:

- `generations_pkey` on `id`.
- `generations_user_id_idx` on `user_id`.
- `generations_user_created_at_idx` on `user_id, created_at desc`.

The migration was applied on 2026-08-12. A read-only query against
`pg_indexes` confirmed the table and all three indexes.

## Database boundary

`lib/db/index.ts` constructs the Drizzle client lazily through `getDb()`. The
runtime uses pooled `DATABASE_URL`; Drizzle Kit uses direct
`DATABASE_URL_UNPOOLED`. Only modules in `lib/db/` query Postgres. Every user
content read includes the Clerk owner id in the query.

Available queries:

- list the newest 24 generations for one owner;
- count all generations for one owner;
- count one owner's generations since a supplied timestamp;
- insert one generation and return the stored row.

## Generation action

`app/(app)/generate/actions.ts` exports `generateGeneration`. Its browser input
is one `FormData` field named `prompt`. The action:

1. reads the Clerk session and rejects an anonymous request;
2. validates and trims the prompt through the shared Zod schema;
3. checks the owner's indexed one-hour generation count;
4. calls the AI Gateway;
5. writes the returned bytes to public Blob storage;
6. writes the generation row;
7. revalidates `/generate`;
8. returns a discriminated success or failure result.

The prompt must contain content after trimming and may contain at most 500
characters. The temporary spending floor allows fewer than 20 generations in
the preceding hour. It is not a distributed rate limiter. Step 9 replaces it
with Upstash and product-level quotas.

Provider, Blob, and database failures become actionable client messages. Server
logs remove the user's prompt before recording error details. If the Blob write
succeeds but the database insert fails, the action attempts to delete the Blob.

## AI model

`lib/ai/model.ts` exports one model id:
`google/imagen-4.0-fast-generate-001`.

It was verified against the live Vercel AI Gateway catalog on 2026-08-12. The
catalog described it as the speed-optimized Imagen 4 tier and listed a price of
$0.02 per image. That speed and cost profile fits an interactive prompt loop.
AI SDK 7 exposes the stable `generateImage` export, even though the current
Vercel model page still shows the older `experimental_generateImage` alias.

The action requests a 1:1 aspect ratio. Width and height are read from the
returned PNG or JPEG bytes rather than assumed.

### Live verification status

A direct Gateway request reached Vercel with the provisioned OIDC credentials
on 2026-08-12, but Vercel returned HTTP 403 with
`customer_verification_required`. The linked Vercel team must add a valid
credit card before Gateway image requests can complete. Until then, Ether
returns the action's handled generation-failure message and does not write a
Blob or database row.

## Storage

Generated images are written to
`generations/<clerk-user-id>/<random-uuid>.<extension>` with public access and
without an added random suffix. The UUID makes each pathname unique. Generated
images remain user data in Blob and never enter `public/` or Git.

## Auth and routes

`proxy.ts` optimistically protects `/generate` and `/account`. The app layout,
each protected page, and the generation action independently read the server
session. Proxy is not the authorization boundary.

| Route | Render and data behavior |
| --- | --- |
| `/` | Public marketing route. Existing sections remain in the marketing route group |
| `/sign-in` | Public Clerk sign-in screen |
| `/sign-up` | Public Clerk sign-up screen |
| `/generate` | Dynamic, owner-scoped history read and Server Action mutation |
| `/account` | Dynamic Clerk identity read and owner-scoped generation count |

Clerk 7 uses `Show when="signed-in"` and `Show when="signed-out"` for auth-state
rendering. These replace the `SignedIn` and `SignedOut` names in the older
prompt. Clerk appearance variables are set once in the root provider, including
the lime focus ring.

## Environment variables

The linked Vercel project exposes the following variables needed by this step
across production, preview, and development:

| Variable | Browser-visible | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | No | Pooled runtime database connection |
| `DATABASE_URL_UNPOOLED` | No | Direct migration connection |
| `BLOB_READ_WRITE_TOKEN` | No | Blob writes and cleanup |
| `CLERK_SECRET_KEY` | No | Clerk server access |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser initialization |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | Local sign-in route |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | Local sign-up route |
| `VERCEL_OIDC_TOKEN` | No | AI Gateway authentication, managed by Vercel |

The Neon marketplace also provisions compatibility variables. Ether does not
read those aliases. Real values stay in the ignored `.env.local` file and the
Vercel environment.

## User data

Ether stores the Clerk owner id, prompt, generated image URL, model id, decoded
dimensions, and creation time. It reads the user's email and join date from
Clerk for `/account` but does not store them locally. Prompts, emails, request
bodies, provider credentials, and Blob tokens are not logged.
