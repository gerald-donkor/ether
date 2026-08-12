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
npm run db:push
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
- `VERCEL_OIDC_TOKEN`: Vercel-managed AI Gateway authentication. Vercel injects
  this during deployments and `vercel env pull` provides it locally.

`.env.local` is ignored by Git. Do not commit provider credentials.

The linked Vercel team must also have a valid credit card on file before AI
Gateway image requests can run. Without it, Vercel returns
`customer_verification_required` and the app shows a handled generation error.

## Commands

- `npm run dev`: start the development server.
- `npm run build`: create a production build.
- `npm run start`: run a completed production build.
- `npm run lint`: run ESLint.
- `npm run db:generate`: generate a migration from the Drizzle schema.
- `npm run db:push`: apply the Drizzle schema with `.env.local` loaded.

The backend build record is in [`docs/backend.md`](docs/backend.md). The visual
contract is in [`design-system.md`](design-system.md).
