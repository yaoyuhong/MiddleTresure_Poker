# Invite-Only Poker Club Web MVP Design

## 1. Goal

Build a production-oriented, mobile-first web application for one invite-only
poker club. The application manages member registration, live game operations,
buy-ins, add-ons, mid-game joins and exits, zero-sum settlement, season profit,
and rankings.

The MVP records an offline game and its offline settlement. It does not accept,
hold, or transfer money.

## 2. Confirmed Product Decisions

- Multiple phones receive live game updates.
- Only administrators can create or change financial records.
- Members have read-only access to game and settlement data.
- Members register through administrator-issued email invitations and sign in
  with email magic links.
- Closing a game requires all player results to sum to zero.
- A successfully closed game produces a minimum-transfer settlement plan.
- Season points equal cumulative net profit.
- The initial product supports one club.
- A game supports at most 16 distinct participants, including mid-game joins.
- The product is a responsive web app/PWA, not a native mobile application.

## 3. Scope

### 3.1 Administrator capabilities

- Invite and deactivate members.
- Create, open, and close a season.
- Create and start a game.
- Add an invited member to a game at creation time or mid-game.
- Record an initial buy-in or additional buy-in.
- Record a player's exit and final cash-out.
- View live game totals and the zero-sum difference.
- Close a balanced game and generate its settlement plan.
- Make an explicit, audited correction instead of silently editing a closed
  game.

### 3.2 Member capabilities

- Accept an invitation and create a profile.
- Sign in through an email magic link.
- View the active game and live updates.
- View their own buy-in, cash-out, and net result.
- View the table summary, completed-game settlement plan, personal history,
  and season ranking.

### 3.3 Non-goals

- Payment processing, wallets, bank details, or proof of payment.
- Public registration or public club discovery.
- Multiple clubs or cross-club membership.
- Member-authored financial events.
- Native iOS or Android applications.
- Tournament structures, blinds, hands, or gameplay tracking.
- Chat, notifications beyond authentication/invitation email, or accounting
  integrations.

## 4. Architecture

### 4.1 Application

- Next.js with TypeScript.
- Tailwind CSS for a mobile-first responsive interface.
- A progressive web app manifest for home-screen installation.
- Vercel for builds, deployment, preview environments, and serverless routes.

### 4.2 Managed backend

- Supabase PostgreSQL as the system of record.
- Supabase Auth for email magic-link authentication.
- Supabase Realtime for active-game updates.
- PostgreSQL functions/transactions for atomic game closing and ranking
  updates.
- Row Level Security (RLS) as the authorization boundary.

There is no self-managed server. Vercel and Supabase still provide managed
server and database infrastructure; this is not a static-only application.

### 4.3 Security boundary

- The browser receives only the Supabase public client key.
- The Supabase service-role key is never exposed to browser code.
- RLS permits active club members to read club data.
- RLS permits financial writes only through authenticated administrator
  operations.
- Privileged invitation and correction operations run in trusted serverless
  code or tightly scoped database functions.
- Every privileged financial mutation writes an immutable audit entry with
  actor, timestamp, operation, target, and before/after data.

## 5. Data Model

### 5.1 Core entities

- `clubs`: the single club and its display settings.
- `profiles`: user identity and display name.
- `memberships`: club membership, role, invitation status, and active status.
- `seasons`: club season, start/end timestamps, and lifecycle state.
- `games`: season game, timestamps, lifecycle state, and version.
- `game_players`: player participation, status, aggregate buy-in, aggregate
  cash-out, and final net result.
- `game_transactions`: append-oriented initial buy-in, add-on, cash-out, join,
  exit, and correction events.
- `settlement_transfers`: debtor, creditor, amount, and deterministic order.
- `audit_logs`: immutable privileged-operation history.

### 5.2 Numeric rules

- All money/chip values are non-negative integers in the club's smallest
  configured unit.
- Floating-point values are prohibited for financial arithmetic.
- A player's net result is `cash_out - total_buy_in`.
- A game's zero-sum invariant is `sum(player.net_result) = 0`.
- Season profit is the sum of finalized game net results.
- Equal season profits share the same competition rank. Rows sort by profit
  descending, then display name and membership ID for deterministic display.

## 6. Game Lifecycle and Data Flow

1. An administrator creates a draft game in an open season.
2. The administrator adds players and records initial buy-ins.
3. Starting the game changes its state to `active`.
4. During play, the administrator records add-ons, joins, exits, and cash-outs.
5. Committed changes are broadcast to subscribed member devices.
6. The interface displays total buy-ins, total cash-outs, and the remaining
   zero-sum difference.
7. The administrator requests game closure.
8. A trusted serverless route computes an exact minimum-transfer candidate from
   the current version of the game.
9. One database transaction locks the game row, requires the candidate's
   version to match, recomputes all player totals, rejects an unbalanced result,
   and verifies that every proposed transfer reconciles those totals.
10. For a valid candidate, that transaction stores settlement transfers, stores
    final player results, marks the game finalized, and makes its results
    available to season ranking queries.
11. Retrying the same close request is idempotent and cannot finalize or count
    the game twice.

Closed records are not silently edited. A correction is a new audited action
that reverses or supersedes affected values and atomically recomputes the
settlement and ranking.

## 7. Minimum-Transfer Settlement

For each finalized player:

- Positive net results form the creditor list.
- Negative net results form the debtor list.
- Zero results are omitted.

Because minimizing the number of transfers is not guaranteed by a simple greedy
match, the serverless solver uses deterministic branch-and-bound over possible
debtor/creditor matches. Its objective is the exact minimum number of transfers;
lexicographically ordered membership IDs break ties between equally small
plans. The MVP limit of 16 distinct participants bounds computation. The
database independently verifies that the selected plan preserves every
player's net result before finalization.

The generated plan is advisory for offline payment. The application does not
track bank accounts or execute transfers.

## 8. Mobile-First Experience

### 8.1 Member navigation

- Home: current game status and the member's live totals.
- Live game: table totals and read-only participant status.
- Settlement: final result and who pays whom.
- Ranking: current season cumulative net-profit leaderboard.
- History: the member's finalized games.

### 8.2 Administrator game console

- Prominent active-game totals and zero-sum difference.
- Compact player cards with buy-in, add-on, cash-out, and exit actions.
- A searchable member picker for mid-game joins.
- Confirmation for every important financial write.
- A close-game action that is disabled until required player data is complete;
  the server still independently enforces all invariants.

Touch targets, typography, spacing, loading states, and safe-area handling are
optimized for phones, with an adaptive desktop layout.

## 9. Concurrency and Error Handling

- Writes use request IDs for idempotency.
- A game version checked while holding a row lock prevents stale concurrent
  edits.
- A device shows pending, saved, offline, and failed states explicitly.
- Failed writes remain visible and retryable; the UI never reports success
  before the database commits.
- Realtime events trigger a canonical data refresh where ordering is uncertain.
- An unbalanced close request reports the exact difference and remains active.
- Expired or reused invitation links show a safe recovery path through an
  administrator.
- Unauthorized operations fail at the database boundary even if the UI is
  bypassed.
- User-facing errors omit secrets and internal database details; server-side
  diagnostics retain a correlation/request ID.

## 10. Testing and Acceptance

### 10.1 Automated tests

- Unit tests for integer arithmetic, zero-sum validation, ranking, ties, and
  minimum-transfer settlement.
- Database tests for RLS, administrator-only writes, transactional closure,
  idempotency, corrections, and concurrent close attempts.
- Integration tests for invitation, authentication, live updates, and game
  lifecycle.
- Mobile end-to-end tests for the primary administrator and member flows.

### 10.2 MVP acceptance criteria

- An uninvited account cannot access club data.
- A member cannot create or alter a financial record.
- Two signed-in phones see a committed active-game update without reloading.
- Joins, add-ons, exits, and cash-outs produce correct integer totals.
- An unbalanced game cannot close.
- A balanced game closes exactly once and produces a valid settlement plan.
- Every debtor and creditor balance is fully reconciled by the plan.
- A finalized result appears once in season profit and ranking.
- A privileged correction is attributable in the audit history.
- The critical flows work at common narrow mobile viewport widths.

## 11. Deployment and Operations

### 11.1 Initial deployment

1. Create a Supabase project and apply version-controlled database migrations.
2. Configure production URL allowlists and email authentication.
3. Configure a production-capable custom SMTP provider before inviting real
   members; provider defaults are suitable only for initial development.
4. Import the GitHub repository into Vercel.
5. Configure public Supabase URL/key and server-only secrets in Vercel
   environment settings.
6. Deploy a preview environment, run smoke tests, then promote the verified
   build to production.
7. Optionally attach a custom domain and configure DNS.

Secrets must be entered directly in the relevant platform, never committed or
sent through chat.

### 11.2 Production readiness

- Keep schema changes in migrations and apply them through a controlled
  deployment step.
- Enable appropriate Supabase backup/recovery and resource plans before using
  the application for real club records.
- Configure error monitoring, request correlation, and uptime checks.
- Review current Vercel, Supabase, email-provider, and domain limits and prices
  before launch.
- Publish clear privacy, data-retention, and acceptable-use information.
- Confirm local laws and club policies because the application records
  poker-related financial results even though it does not process payments.

## 12. Delivery Boundary

Cloud development can produce, test, commit, and push the application and make
it ready for one-click platform integration. The repository owner controls the
Vercel and Supabase accounts. Deployment requires those accounts to authorize
the GitHub repository and requires secrets to be configured directly in the
platform dashboards. No account password or access token should be shared in
chat.
