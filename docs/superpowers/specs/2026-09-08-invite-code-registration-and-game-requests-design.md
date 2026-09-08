# Invite-Code Registration and Member Game Requests

## Status

Approved interactively on 2026-09-08. This specification changes the original
authentication and financial-write decisions for the poker club MVP.

## Goals

- Replace routine Magic Link access with email-and-password registration and
  login.
- Require a reusable club invite code during registration.
- Allow a separate reusable administrator invite code to create administrators.
- Activate a valid registration immediately without administrator approval.
- Let members request their own game entry, add-on, and exit while preserving an
  administrator-approved official ledger.
- Preserve realtime updates, zero-sum settlement, exact transfer planning,
  season ranking, idempotency, and immutable audit history.
- Fix mid-game entry for newly registered active members.

## Confirmed Product Decisions

- A member registers with display name, email, password, and a reusable member
  invite code.
- An administrator can register with the same form and a separate reusable
  administrator invite code.
- Both codes remain valid until an administrator rotates them.
- A valid registration becomes active immediately.
- Routine login uses email and password.
- Email is retained for password recovery, but Magic Link is not the primary
  login method.
- Members submit game actions; administrators approve them before they affect
  the official financial ledger.
- Members can request entry with an initial buy-in, an add-on, and exit with a
  cash-out.
- Administrators retain the ability to enter game actions directly.
- A game can accept entry requests while draft or active when registration is
  open.
- A game still supports no more than 16 distinct participants.

## Scope

### Member capabilities

- Register using a valid member or administrator invite code.
- Log in and sign out using email and password.
- Request password recovery by email.
- View open games and submit an entry request with an initial buy-in.
- Submit add-on and exit requests for their own active game-player record.
- View, cancel, and receive realtime updates for their own pending requests.
- Continue to view active games, finalized history, settlement, and ranking.

### Administrator capabilities

- Perform every existing direct game operation.
- Open or close registration independently of game draft/active state.
- Review pending game-action requests.
- Approve or reject a request with an optional note.
- Rotate the member and administrator invite codes.
- Copy newly generated codes at rotation time.
- Set or change their own password.

### Non-goals

- No payment processing, custody, or bank transfer execution.
- No member self-approval.
- No direct member mutation of the official ledger.
- No account recovery without access to the registered email.
- No restoration of an account solely from a display name or local device.
- No per-member or single-use registration codes in this iteration.

## Architecture

### Registration

The browser posts display name, normalized email, password, and invite code to a
server-only registration endpoint. The endpoint never exposes code hashes or
the service-role key.

The server validates input and applies a database-backed attempt limit before
checking the submitted code. A security-definer function compares the submitted
value against `pgcrypto` hashes and returns only the resulting role. Invalid
code, duplicate email, and internal validation failures share a generic public
error.

After code validation, the server creates a confirmed Supabase Auth user using
the service-role client. Email confirmation is intentionally bypassed so a
valid invite-code registration can enter immediately. It then calls a database
function that creates or repairs the profile and active membership and records
an audit event. If database finalization fails for a newly created Auth user,
the endpoint deletes that Auth user. Retries use a stable request ID and recover
an existing orphan only when it has no membership.

The endpoint signs the new user in with the submitted email and password through
the normal server client, which writes the session cookies used by the
application.

### Login and recovery

The primary login page calls `signInWithPassword`. Generic invalid-credentials
errors avoid account enumeration. Password recovery continues to use Supabase
email and the token-hash confirmation route, then presents an authenticated
password-update form.

The existing authenticated administrator receives a security page for setting
a password through `auth.updateUser`. Existing sessions and finalized records
remain attached to the same Auth user and membership.

### Invite-code management

Codes are generated server-side from cryptographically secure random bytes.
Human-readable formatting distinguishes member and administrator codes without
reducing entropy. The administrator code is longer than the member code.

Only salted `pgcrypto` hashes are persisted. Plaintext is returned exactly once
after initial setup or rotation. Administrators cannot retrieve the old
plaintext. Rotating a code invalidates the previous value immediately and
writes an audit event containing metadata, never plaintext.

Because the administrator code is reusable, the UI permanently warns that
anyone who knows it can create another administrator.

### Member game requests

Members never call official game mutation functions. They create rows through
request-specific security-definer functions:

- `join`: game ID and positive initial buy-in.
- `add_on`: active game-player ID and positive amount.
- `exit`: active game-player ID and non-negative cash-out.

The function derives membership from `auth.uid()` rather than trusting a
client-supplied membership ID. It validates ownership, game state, registration
state, safe-integer amounts, participant capacity, and duplicate pending
requests.

Pending requests do not change buy-ins, cash-outs, player status, game version,
ranking, or settlement.

An administrator approval function locks the request and game, revalidates the
latest state, applies the corresponding official mutation in the same
transaction, marks the request approved, and writes the approval audit event.
A rejection or member cancellation changes only request state and audit
history.

The approval function accepts a request ID for idempotency. Unknown network and
HTTP 5xx outcomes reuse the exact same request ID and payload.

## Data Model

### `club_access_codes`

- `id uuid primary key`
- `club_id uuid references clubs`
- `kind access_code_kind` (`member`, `admin`)
- `code_hash text`
- `rotated_by uuid references profiles`
- `rotated_at timestamptz`
- `created_at timestamptz`
- Unique `(club_id, kind)`

Plaintext codes and failed submitted codes are never stored.

### `registration_attempts`

- Stores a short-lived keyed hash of normalized email and network identifier.
- Stores attempt window, count, and blocked-until timestamp.
- Contains no raw invite code or password.
- Successful registration clears its matching attempt row.
- Expired rows are safe to delete through scheduled maintenance.

### `game_action_requests`

- `id uuid primary key`
- `club_id uuid references clubs`
- `game_id uuid references games`
- `membership_id uuid references memberships`
- `game_player_id uuid null references game_players`
- `action game_request_action` (`join`, `add_on`, `exit`)
- `amount bigint`
- `status game_request_status`
  (`pending`, `approved`, `rejected`, `cancelled`)
- `request_id uuid`
- `reviewed_by uuid null references profiles`
- `review_note text null`
- `reviewed_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Partial unique indexes prevent conflicting pending requests. A member can have
one pending join per game and at most one pending add-on or exit of each type per
active player. A pending exit blocks new add-on requests until resolved.

### `games`

Add `registration_open boolean not null default true`. Finalization always
closes registration. Administrators can close registration before finalization
without ending the game.

## Authorization and RLS

- Anonymous users cannot read club, code, membership, or request rows.
- Code hashes are never selectable by authenticated members.
- Registration code validation is available only through a narrowly scoped
  server/service-role function with rate-limit checks.
- Active members can read open games in their club.
- Members can read only their own action requests.
- Members can create/cancel only requests derived from their authenticated
  membership.
- Administrators can read and review all requests in their club.
- Existing official financial tables remain administrator-write-only.
- Realtime publication includes request state and game registration state, with
  RLS filtering each subscriber.

## Mobile UX

### Public entry

The landing page shows `Register` and `Log in`.

Registration fields:

- Display name
- Email
- Password
- Invite code

The password requires at least 10 characters. Submission disables while
pending. Success enters `/club`; failure preserves non-secret fields and shows
a generic actionable message.

### Member game view

Open games show `Request to join`. An amount sheet collects the initial buy-in.
Active participants see `Request add-on` and `Request exit`. A compact request
timeline shows pending and resolved state. Pending actions can be cancelled
before review.

### Administrator game view

The existing game console gains:

- Registration open/closed toggle.
- Pending-request count.
- Request cards with member, operation, amount, age, Approve, Reject, and note.

Approval refreshes game totals and both clients through Realtime. Newly
registered active members also appear in the direct-add selector without a
manual reload.

### Access security

Administrators can set/change their password and rotate either invite code. A
successful rotation displays the new plaintext once with a copy action and
confirmation warning.

## Concurrency and Error Handling

- All amounts remain non-negative safe integers where required.
- Every mutation uses a client-generated request ID.
- Registration, request creation, cancellation, approval, rejection, code
  rotation, and registration toggles are idempotent.
- Approval locks the target request and game and revalidates current state.
- A stale or invalid request is rejected with a stable reason and never partly
  applies.
- Approving a seventeenth distinct player fails without changing the request or
  ledger.
- A game cannot finalize while a pending exit or join request exists; the
  administrator must approve, reject, or cancel it first. Pending add-ons also
  block finalization to avoid silently discarding a financial request.
- Realtime disconnects fall back to router refresh and preserve pending request
  state from the database.

## Migration

1. Add access-code, registration-attempt, and game-request schema and enums.
2. Let the existing authenticated administrator initialize both codes from the
   access-security page. Plaintext never appears in workflow or server logs.
3. Keep all existing memberships and user IDs.
4. Add a password-setting page for the currently authenticated administrator.
5. Replace the landing/login UI and enable registration only after code hashes
   exist.
6. Keep token-hash confirmation for password recovery.
7. Remove Magic Link from the primary UI only after password login is verified
   in production.

## Testing

### Unit and component

- Registration validation and generic errors.
- Password login and password-setting forms.
- Invite-code rotation display and one-time plaintext behavior.
- Member request forms, cancellation, and admin request cards.
- Stable request ID reuse after ambiguous responses.

### Database

- Correct role assignment for member/admin code.
- Invalid and rotated codes fail.
- Registration attempt limits do not store raw inputs.
- Members cannot read hashes or another member's requests.
- Request ownership, state transitions, duplicate prevention, and audit events.
- Approval applies exactly one official transaction.
- Approval revalidates game state and 16-player capacity.
- Pending requests block finalization.
- Mid-game approved joins remain supported.

### End to end

- Member-code registration enters the club immediately.
- Administrator-code registration receives admin navigation.
- Email/password login and recovery.
- Member requests entry; administrator approves; both views update.
- Member requests add-on and exit; rejected/cancelled requests do not affect
  totals.
- Existing administrator sets a password and retains historical records.

## Deployment Gates

- Apply forward-only Supabase migrations before deploying registration UI.
- Configure production SMTP for password recovery.
- Initialize both codes and record them in an external password manager.
- Confirm Vercel production has URL, publishable key, and service-role secret.
- Run database tests, application tests, strict type checking, production build,
  and mobile Playwright flows.
- Smoke-test registration and approval using non-production accounts before
  distributing the member code.
