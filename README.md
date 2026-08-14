# Ether

Ether is a text-to-image generator for working creatives. The public landing
page is matched to the reference artboard, while the authenticated application
lets a user generate an image and return to their recent history.

## Local setup

Install dependencies and pull the linked Vercel project's development
environment:

```bash
npm install
vercel env pull .env.local --yes
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page is public.
`/generate` and `/account` require a Clerk session.

## Environment

The application reads these variables:

- `DATABASE_URL`: pooled Neon connection used by the application.
- `DATABASE_URL_UNPOOLED`: direct Neon connection used by Drizzle Kit.
- `BLOB_READ_WRITE_TOKEN`: server-side Vercel Blob access.
- `CLERK_SECRET_KEY`: server-side Clerk access.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: public Clerk instance identifier.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/sign-in`.
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: `/sign-up`.
- `CLOUDFLARE_ACCOUNT_ID`: server-side Workers AI account identifier.
- `CLOUDFLARE_API_TOKEN`: server-side Workers AI authentication.
- `STRIPE_SECRET_KEY`: server-side Stripe sandbox API credential.
- `STRIPE_WEBHOOK_SECRET`: server-side signing secret for `/api/stripe/webhook`.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: public Stripe sandbox identifier provisioned by Vercel.

`.env.local` is ignored by Git. Do not commit provider credentials.

Workers AI prompt, image, and moderation requests share the account's provider
capacity. The application reserves that capacity before making a model call.

## Commands

- `npm run dev`: start the development server.
- `npm run build`: create a production build.
- `npm run start`: run a completed production build.
- `npm run lint`: run ESLint.
- `npm test`: run environment-free moderation parser and validation tests.
- `npm run test:db`: run moderation and quota integration checks with `.env.local`.
- `npm run test:billing-db`: run credit-ledger integration checks with `.env.local`.
- `npm run db:generate`: generate a migration from the Drizzle schema.
- `npm run db:migrate`: apply committed migrations with `.env.local` loaded.
- `npm run db:push`: apply the Drizzle schema with `.env.local` loaded.

The backend build record is in [`docs/backend.md`](docs/backend.md). The visual
contract is in [`design-system.md`](design-system.md).
