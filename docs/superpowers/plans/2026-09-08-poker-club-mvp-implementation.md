# Invite-Only Poker Club MVP Implementation Plan

> Design source:
> `docs/superpowers/specs/2026-09-08-poker-club-mvp-design.md`

## Objective

Deliver a mobile-first Next.js application backed by Supabase that supports
invite-only membership, administrator-controlled live games, exact zero-sum
settlement, and cumulative-profit season rankings. Deploy the web application
through Vercel without operating a self-managed server.

## Engineering Rules

- Use TypeScript in strict mode.
- Use the Next.js App Router.
- Use integer values for all chip/money arithmetic.
- Keep domain calculations independent from React and Supabase.
- Write a failing test before each behavioral implementation.
- Keep database changes in ordered Supabase migrations.
- Enforce authorization in PostgreSQL RLS and functions, not only in UI code.
- Never expose the Supabase service-role key to client bundles.
- Commit and push each logical task after its focused verification passes.

## Task 1: Scaffold the Web Application

**Create**

- `package.json`
- `pnpm-lock.yaml`
- `next.config.ts`
- `tsconfig.json`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `vitest.config.ts`
- `playwright.config.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/test/setup.ts`
- `tests/e2e/smoke.spec.ts`
- `.env.example`

**Steps**

1. Scaffold the latest stable Next.js application with TypeScript, App Router,
   Tailwind CSS, ESLint, and pnpm.
2. Add Vitest, Testing Library, jsdom, and Playwright.
3. Write an end-to-end smoke test that expects the product name on the landing
   page; confirm it fails before the page exists.
4. Add a minimal mobile-first landing page and global design tokens.
5. Run:

   ```bash
   pnpm lint
   pnpm test
   pnpm build
   pnpm exec playwright test tests/e2e/smoke.spec.ts
   ```

6. Commit as `chore: scaffold poker club web app`.

## Task 2: Implement Core Financial Domain Logic

**Create**

- `src/domain/money.ts`
- `src/domain/game.ts`
- `src/domain/settlement.ts`
- `src/domain/ranking.ts`
- `src/domain/__tests__/money.test.ts`
- `src/domain/__tests__/game.test.ts`
- `src/domain/__tests__/settlement.test.ts`
- `src/domain/__tests__/ranking.test.ts`

**Steps**

1. Write failing tests for integer validation, addition, subtraction, and
   overflow-safe totals.
2. Implement branded integer-unit helpers that reject negative, fractional,
   unsafe, or malformed values at boundaries.
3. Write failing tests for per-player net result and game zero-sum difference.
4. Implement pure game-total functions.
5. Write failing tests proving settlement:
   - preserves every player balance;
   - uses no zero-value transfer;
   - is deterministic;
   - finds fewer transfers than a known greedy counterexample;
   - returns the exact minimum for exhaustive small fixtures;
   - rejects more than 16 participants.
6. Implement deterministic branch-and-bound settlement with memoization and
   membership-ID tie-breaking.
7. Write failing tests for cumulative profit, equal-rank behavior, and stable
   display ordering.
8. Implement pure ranking functions.
9. Run `pnpm test -- src/domain`.
10. Commit as `feat: add zero-sum settlement domain`.

## Task 3: Add Supabase Local Development and Schema

**Create**

- `supabase/config.toml`
- `supabase/migrations/0001_extensions_and_types.sql`
- `supabase/migrations/0002_core_schema.sql`
- `supabase/migrations/0003_constraints_and_indexes.sql`
- `supabase/seed.sql`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/database.types.ts`
- `src/lib/env.ts`
- `src/lib/__tests__/env.test.ts`

**Steps**

1. Initialize Supabase local configuration.
2. Write failing environment-validation tests for missing and malformed public
   and server-only configuration.
3. Add validated browser/server environment accessors.
4. Create enums for membership, season, game, participant, and transaction
   lifecycle states.
5. Create the approved tables, foreign keys, integer checks, uniqueness
   constraints, request-ID idempotency constraints, and indexes.
6. Make append-oriented financial event and audit tables reject direct update
   and delete operations.
7. Seed one development club, administrator membership, season, and sample
   members without real email addresses or secrets.
8. Reset the local database and generate TypeScript database types.
9. Run:

   ```bash
   supabase db reset
   pnpm test -- src/lib
   pnpm typecheck
   ```

10. Commit as `feat: define poker club database schema`.

## Task 4: Enforce Authentication and Row-Level Security

**Create**

- `supabase/migrations/0004_auth_helpers.sql`
- `supabase/migrations/0005_row_level_security.sql`
- `supabase/tests/rls_membership.test.sql`
- `supabase/tests/rls_financial_writes.test.sql`
- `src/middleware.ts`
- `src/app/auth/callback/route.ts`
- `src/app/login/page.tsx`
- `src/components/auth/magic-link-form.tsx`
- `src/components/auth/__tests__/magic-link-form.test.tsx`

**Steps**

1. Write failing pgTAP tests for:
   - unauthenticated and uninvited users seeing no club data;
   - active members reading club data;
   - members being unable to write financial data;
   - administrators receiving only explicitly allowed write access;
   - inactive memberships losing access.
2. Add small SQL authorization helpers and enable RLS on every exposed table.
3. Add policies that satisfy the tests.
4. Write a failing component test for valid and invalid magic-link requests.
5. Implement login, callback, safe redirect validation, session refresh, and
   protected-route middleware.
6. Run:

   ```bash
   supabase test db
   pnpm test -- src/components/auth
   pnpm lint
   ```

7. Commit as `feat: secure club access with magic links`.

## Task 5: Build Invite-Only Member Management

**Create**

- `src/app/(app)/admin/members/page.tsx`
- `src/app/api/admin/invitations/route.ts`
- `src/application/invitations.ts`
- `src/application/__tests__/invitations.test.ts`
- `src/components/members/member-list.tsx`
- `src/components/members/invite-member-form.tsx`
- `src/components/members/__tests__/invite-member-form.test.tsx`
- `supabase/migrations/0006_invitation_audit.sql`

**Steps**

1. Write failing service tests for administrator authorization, normalized
   email handling, duplicate invitation behavior, inactive-member recovery,
   and audit creation.
2. Implement the server-only invitation service using the Supabase admin client.
3. Add a protected route handler with schema validation, request correlation,
   rate limiting, and safe error responses.
4. Write failing UI tests for invitation submission, pending state, success,
   duplicate invitation, and failure recovery.
5. Implement the mobile member list and invitation form.
6. Add invitation and membership-change audit records.
7. Run focused tests, lint, and type checking.
8. Commit as `feat: add invite-only member management`.

## Task 6: Implement Seasons and Rankings

**Create**

- `supabase/migrations/0007_season_functions.sql`
- `supabase/tests/season_lifecycle.test.sql`
- `src/app/(app)/ranking/page.tsx`
- `src/app/(app)/admin/seasons/page.tsx`
- `src/application/seasons.ts`
- `src/application/__tests__/seasons.test.ts`
- `src/components/ranking/ranking-table.tsx`
- `src/components/ranking/__tests__/ranking-table.test.tsx`

**Steps**

1. Write failing database tests for one open season, lifecycle transitions, and
   administrator-only changes.
2. Implement transactional season lifecycle functions.
3. Write failing service and component tests for cumulative finalized profit,
   shared competition ranks, deterministic ties, empty seasons, and mobile
   rendering.
4. Implement season administration and the read-only ranking screen.
5. Run focused database and frontend tests.
6. Commit as `feat: add season profit rankings`.

## Task 7: Implement Transactional Live Game Writes

**Create**

- `supabase/migrations/0008_game_write_functions.sql`
- `supabase/tests/game_writes.test.sql`
- `src/application/games.ts`
- `src/application/__tests__/games.test.ts`
- `src/app/api/admin/games/route.ts`
- `src/app/api/admin/games/[gameId]/transactions/route.ts`

**Steps**

1. Write failing database tests for create, start, initial buy-in, add-on,
   mid-game join, exit, and cash-out.
2. Include failing cases for non-administrators, invalid lifecycle transitions,
   negative/fractional amounts, a seventeenth participant, duplicate request
   IDs, stale versions, and changes after finalization.
3. Implement security-definer database functions with explicit search paths,
   row locking, version checks, request idempotency, aggregate recomputation,
   and immutable audit writes.
4. Write failing application tests for input validation and database-error
   mapping.
5. Implement protected administrator API routes.
6. Run focused database and application tests.
7. Commit as `feat: add transactional live game operations`.

## Task 8: Build the Realtime Mobile Game Experience

**Create**

- `src/app/(app)/layout.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(app)/games/[gameId]/page.tsx`
- `src/app/(app)/admin/games/[gameId]/page.tsx`
- `src/components/navigation/mobile-nav.tsx`
- `src/components/games/game-summary.tsx`
- `src/components/games/player-card.tsx`
- `src/components/games/game-admin-console.tsx`
- `src/components/games/add-transaction-dialog.tsx`
- `src/hooks/use-game-realtime.ts`
- `src/hooks/__tests__/use-game-realtime.test.tsx`
- `src/components/games/__tests__/game-admin-console.test.tsx`

**Steps**

1. Write failing tests for member read-only rendering and administrator action
   visibility.
2. Write failing tests for pending, saved, failed, retryable, stale-version, and
   offline states.
3. Write failing hook tests proving relevant Realtime events trigger canonical
   refreshes and clean up subscriptions.
4. Implement the app shell, member live view, administrator console, dialogs,
   and Realtime hook.
5. Ensure server-rendered canonical state remains usable when Realtime is
   unavailable.
6. Verify keyboard operation, focus restoration, touch targets, and narrow
   viewports.
7. Run focused component tests and the live-game Playwright flow.
8. Commit as `feat: add realtime mobile game console`.

## Task 9: Finalize Games and Generate Exact Settlement

**Create**

- `supabase/migrations/0009_finalize_game.sql`
- `supabase/tests/finalize_game.test.sql`
- `src/app/api/admin/games/[gameId]/finalize/route.ts`
- `src/application/finalize-game.ts`
- `src/application/__tests__/finalize-game.test.ts`
- `src/components/games/finalize-game-dialog.tsx`
- `src/components/settlement/settlement-plan.tsx`
- `src/components/settlement/__tests__/settlement-plan.test.tsx`

**Steps**

1. Write failing database tests for imbalance rejection, stale candidate
   rejection, per-player reconciliation, exact-once finalization, duplicate
   request IDs, season inclusion, and concurrent close attempts.
2. Implement the finalization database function that locks the game, recomputes
   source totals, verifies the proposed plan, persists results and transfers,
   and finalizes atomically.
3. Write failing application tests for exact-solver invocation, stale-version
   retry, timeout handling, and safe errors.
4. Implement the protected finalization route.
5. Write failing UI tests for visible imbalance, confirmation, progress,
   finalized results, and retryable failure.
6. Implement the dialog and read-only settlement plan.
7. Run domain, database, application, and component settlement tests.
8. Commit as `feat: finalize games with exact settlement`.

## Task 10: Add Audited Corrections and History

**Create**

- `supabase/migrations/0010_game_corrections.sql`
- `supabase/tests/game_corrections.test.sql`
- `src/app/(app)/history/page.tsx`
- `src/app/(app)/games/[gameId]/settlement/page.tsx`
- `src/app/(app)/admin/games/[gameId]/correction/page.tsx`
- `src/application/corrections.ts`
- `src/application/__tests__/corrections.test.ts`
- `src/components/history/game-history.tsx`

**Steps**

1. Write failing tests proving closed rows cannot be directly edited and every
   correction is attributable.
2. Write failing tests proving a correction atomically supersedes the prior
   result, settlement, and season ranking without double counting.
3. Implement the correction transaction and administrator-only service.
4. Add member history, settlement detail, and administrator correction screens.
5. Run correction and ranking regression tests.
6. Commit as `feat: add audited game corrections and history`.

## Task 11: Add PWA, Accessibility, and Production Diagnostics

**Create**

- `public/manifest.webmanifest`
- `public/icons/`
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/app/not-found.tsx`
- `src/lib/logger.ts`
- `src/lib/request-id.ts`
- `src/lib/__tests__/request-id.test.ts`
- `tests/e2e/accessibility.spec.ts`

**Modify**

- `src/app/layout.tsx`
- `next.config.ts`

**Steps**

1. Add PWA metadata, generated icons, theme colors, and safe-area styling.
2. Add sanitized error boundaries and correlation IDs.
3. Add structured server logs with explicit secret and personal-data
   redaction.
4. Write and run automated accessibility checks for login, live game,
   settlement, and ranking.
5. Run Lighthouse against a production build and address material mobile,
   accessibility, and installability failures.
6. Commit as `feat: harden mobile production experience`.

## Task 12: Complete End-to-End Verification and Deployment Setup

**Create**

- `tests/e2e/admin-game-lifecycle.spec.ts`
- `tests/e2e/member-realtime.spec.ts`
- `tests/e2e/authorization.spec.ts`
- `docs/deployment.md`
- `.github/workflows/ci.yml`

**Steps**

1. Write end-to-end coverage for:
   - invited member authentication;
   - administrator game creation through settlement;
   - mid-game join and exit;
   - two-browser Realtime updates;
   - member write denial;
   - season ranking update;
   - repeated finalization.
2. Add CI jobs for install, formatting, lint, type checking, unit/component
   tests, Supabase database tests, production build, and Playwright.
3. Document Supabase project creation, migrations, Auth URLs, custom SMTP,
   Vercel import, environment variables, custom domain, backup plan, monitoring,
   rollback, and smoke testing.
4. Configure a preview deployment after the repository owner connects Vercel
   and enters secrets directly in platform settings.
5. Apply migrations to the connected Supabase project through the approved
   deployment path.
6. Run the full release gate:

   ```bash
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test
   supabase test db
   pnpm build
   pnpm exec playwright test
   ```

7. Smoke-test authentication, administrator write access, member read-only
   access, Realtime updates, settlement, and ranking on the preview URL.
8. Promote the verified deployment to production and repeat the production
   smoke test.
9. Commit as `ci: add release verification and deployment guide`.

## Required User-Controlled Platform Inputs

The repository owner must perform or approve these account-bound actions:

- Create/select the Supabase organization and project.
- Create/select the Vercel project and authorize this GitHub repository.
- Enter environment secrets directly in Supabase and Vercel.
- Configure a production email/SMTP provider and sender domain.
- Purchase or select a custom domain if desired.
- Select paid backup, retention, and resource plans appropriate for real data.

No passwords, access tokens, service-role keys, or SMTP credentials should be
placed in Git, issue comments, pull-request text, or chat.

## Final Release Evidence

Completion requires:

- A clean full release-gate run.
- Passing RLS and concurrent-finalization database tests.
- Passing two-browser Realtime end-to-end tests.
- A preview deployment smoke-test record.
- Mobile screenshots for member and administrator flows.
- The production URL and post-deployment smoke-test result.
