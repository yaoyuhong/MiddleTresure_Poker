# Middle Treasure Poker

Mobile-first operations and zero-sum settlement for one invite-only poker club.
The application records offline games and does not process payments.

## Stack

- Next.js and TypeScript
- Supabase PostgreSQL, Auth, Realtime, and Row Level Security
- Vercel deployment
- Vitest, Playwright, and pgTAP

## Local web development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The public landing page runs without Supabase values. Authentication and club
routes require a configured Supabase project.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test
```

Run local database migrations and policy tests on a Docker-capable machine:

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase test db
```

See [`docs/deployment.md`](docs/deployment.md) for hosted setup, secrets,
authentication URLs, release checks, backups, and production promotion.
