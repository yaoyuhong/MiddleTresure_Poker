# Invite-Code Registration and Game Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace routine Magic Link login with invite-code-gated email/password accounts and let members submit game actions that administrators approve into the official ledger.

**Architecture:** Public registration is a server-only, rate-limited orchestration across hashed PostgreSQL access codes and Supabase Auth Admin. Member game actions are immutable request rows; security-definer approval functions lock and revalidate each request before invoking the existing administrator-only ledger mutations. Realtime refreshes request state, registration state, and newly active memberships.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase Auth/PostgreSQL/RLS/Realtime, pgcrypto, Vitest, Testing Library, pgTAP, Playwright, pnpm.

## Global Constraints

- Money/chip values are integer JavaScript-safe values and PostgreSQL `bigint`.
- A game supports at most 16 distinct participants.
- Pending requests never affect official totals, settlement, or ranking.
- Members can mutate only their own requests; only administrators approve ledger writes.
- Both reusable invite codes are stored only as salted hashes and can be rotated immediately.
- Plaintext codes, passwords, service keys, Magic Links, and raw submitted codes never enter logs or audit JSON.
- Registration success activates the membership immediately and establishes a password session.
- Every mutation is idempotent through a stable request UUID.
- Unknown transport and HTTP 5xx outcomes retry the exact request ID and payload.
- Existing finalized records, memberships, and Auth user IDs remain unchanged.

---

## File Map

- `src/domain/access-code.ts`: generate and format high-entropy member/admin codes.
- `src/application/registration.ts`: Zod contracts for registration and password login.
- `src/application/game-requests.ts`: Zod contracts for request creation and review.
- `supabase/migrations/0011_access_codes_and_registration.sql`: access-code schema, rate-limit state, validation, rotation, and membership finalization RPCs.
- `supabase/migrations/0012_game_action_requests.sql`: request schema, RLS, submission/review/cancellation/toggle RPCs, and finalization guard.
- `src/app/api/auth/register/route.ts`: service-side registration orchestration.
- `src/app/api/admin/access-codes/route.ts`: code initialization and rotation.
- `src/app/api/games/[gameId]/requests/route.ts`: member join request endpoint.
- `src/app/api/game-players/[gamePlayerId]/requests/route.ts`: member add-on/exit endpoint.
- `src/app/api/game-requests/[requestId]/route.ts`: member cancellation endpoint.
- `src/app/api/admin/game-requests/[requestId]/route.ts`: administrator approval/rejection endpoint.
- `src/app/api/admin/games/[gameId]/registration/route.ts`: registration-open toggle.
- `src/components/auth/registration-form.tsx`: mobile registration UI.
- `src/components/auth/password-login-form.tsx`: routine password login UI.
- `src/components/admin/access-security.tsx`: password setup and code rotation UI.
- `src/components/games/member-game-actions.tsx`: member join/add-on/exit request UI.
- `src/components/games/game-request-list.tsx`: member request status and cancellation.
- `src/components/games/game-request-queue.tsx`: administrator review queue.
- `src/components/games/game-realtime-refresh.tsx`: expanded membership/request/game subscriptions.
- `src/data/game-requests.ts`: server query mappers for member/admin request views.

---

### Task 1: Access-code and request validation contracts

**Files:**

- Create: `src/domain/access-code.ts`
- Create: `src/domain/__tests__/access-code.test.ts`
- Create: `src/application/registration.ts`
- Create: `src/application/__tests__/registration.test.ts`
- Create: `src/application/game-requests.ts`
- Create: `src/application/__tests__/game-requests.test.ts`

**Interfaces:**

- Produces: `generateAccessCode(kind: "member" | "admin", randomBytes?: (size: number) => Uint8Array): string`
- Produces: `registrationSchema`, `passwordLoginSchema`, `passwordUpdateSchema`
- Produces: `memberGameRequestSchema`, `reviewGameRequestSchema`, `cancelGameRequestSchema`

- [ ] **Step 1: Write failing access-code tests**

```ts
const fixedBytes = (size: number) => new Uint8Array(size).fill(7);
expect(generateAccessCode("member", fixedBytes)).toMatch(
  /^MTP-M-[A-Z2-9]{16}$/,
);
expect(generateAccessCode("admin", fixedBytes)).toMatch(/^MTP-A-[A-Z2-9]{24}$/);
expect(memberCode).not.toBe(adminCode);
```

- [ ] **Step 2: Write failing registration and request schema tests**

```ts
expect(
  registrationSchema.safeParse({
    displayName: "Alex",
    email: " ALEX@example.com ",
    password: "ten-characters",
    inviteCode: "MTP-M-23456789ABCDEFGH",
    requestId: crypto.randomUUID(),
  }).success,
).toBe(true);

expect(
  memberGameRequestSchema.safeParse({
    action: "exit",
    amount: -1,
    requestId: crypto.randomUUID(),
  }).success,
).toBe(false);
```

- [ ] **Step 3: Run the focused tests and observe missing modules**

Run:

```bash
pnpm test -- src/domain/__tests__/access-code.test.ts src/application/__tests__/registration.test.ts src/application/__tests__/game-requests.test.ts
```

Expected: FAIL because the three implementation modules do not exist.

- [ ] **Step 4: Implement deterministic code formatting and Zod contracts**

```ts
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(
  kind: "member" | "admin",
  randomBytes = (size: number) => crypto.getRandomValues(new Uint8Array(size)),
): string {
  const length = kind === "admin" ? 24 : 16;
  const bytes = randomBytes(length);
  const body = Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
  return `MTP-${kind === "admin" ? "A" : "M"}-${body}`;
}
```

Schemas normalize email with `trim().toLowerCase()`, require display names of
1–80 characters, passwords of 10–128 characters, UUID request IDs, positive
join/add-on amounts, and non-negative exit amounts.

- [ ] **Step 5: Run focused tests**

Expected: all focused tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/access-code.ts src/domain/__tests__/access-code.test.ts src/application
git commit -m "feat: define invite registration contracts"
```

---

### Task 2: Access-code and registration database foundation

**Files:**

- Create: `supabase/migrations/0011_access_codes_and_registration.sql`
- Create: `supabase/tests/access_code_registration.test.sql`

**Interfaces:**

- Consumes: existing `public.is_club_admin`, `_write_audit`, `profiles`, `memberships`, and singleton `clubs`.
- Produces: `public.check_registration_code(raw_code text, normalized_email text, network_key text, target_request_id uuid) returns text`
- Produces: `public.complete_code_registration(target_user_id uuid, normalized_email text, display_name text, raw_code text, target_request_id uuid) returns jsonb`
- Produces: `public.rotate_access_code(target_kind access_code_kind, new_code text, target_request_id uuid) returns jsonb`

- [ ] **Step 1: Write failing pgTAP tests**

Cover these exact assertions:

```sql
select is(
  public.check_registration_code('MTP-M-VALID', 'new@example.test', 'network-a', gen_random_uuid()),
  'member',
  'member code selects member role'
);
select throws_ok(
  $$ select public.check_registration_code('WRONG', 'new@example.test', 'network-a', gen_random_uuid()) $$,
  'P0001',
  'Registration unavailable',
  'invalid code uses a generic error'
);
```

Also assert:

- code hashes do not equal plaintext;
- authenticated members cannot select `club_access_codes`;
- five invalid attempts block the same email/network window;
- rotation invalidates the old code;
- completion creates an active role-matched membership and one audit event;
- a repeated request ID returns the same membership;
- an active existing account cannot be role-upgraded by re-registering.

- [ ] **Step 2: Run database tests before migration**

Run:

```bash
pnpm exec supabase db reset
pnpm exec supabase test db supabase/tests/access_code_registration.test.sql
```

Expected: FAIL because types, tables, and functions do not exist.

- [ ] **Step 3: Add enums and tables**

```sql
create type public.access_code_kind as enum ('member', 'admin');

create table public.club_access_codes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  kind public.access_code_kind not null,
  code_hash text not null,
  rotated_by uuid not null references public.profiles(id),
  rotated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (club_id, kind)
);

create table public.registration_attempts (
  fingerprint text primary key,
  attempt_count integer not null check (attempt_count between 1 and 5),
  window_started_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);
```

- [ ] **Step 4: Implement rate-limited hash comparison**

Use:

```sql
crypt(raw_code, code_hash) = code_hash
```

The function runs only for `service_role`, hashes
`lower(trim(normalized_email)) || ':' || network_key` with `digest(...,
'sha256')`, records no raw value, returns `member` or `admin`, and raises only
`Registration unavailable` for invalid/blocked attempts.

- [ ] **Step 5: Implement completion and rotation**

`complete_code_registration` rechecks the code after locking its row, upserts
the profile display name, activates an invited membership or inserts a new
membership, refuses an already active membership, and audits
`membership.code_registered`.

`rotate_access_code` requires an active administrator and stores:

```sql
crypt(new_code, gen_salt('bf', 12))
```

It returns `{ "kind": ..., "rotated_at": ... }` and never returns or audits
`new_code`.

- [ ] **Step 6: Add RLS and grants**

Enable RLS on both tables; grant no direct code-table access to authenticated
users. Grant execute on registration functions only to `service_role` and code
rotation only to `authenticated`.

- [ ] **Step 7: Reset and run all database tests**

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
```

Expected: all pgTAP suites PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0011_access_codes_and_registration.sql supabase/tests/access_code_registration.test.sql
git commit -m "feat: add hashed club access codes"
```

---

### Task 3: Password registration and login

**Files:**

- Create: `src/app/api/auth/register/route.ts`
- Create: `src/components/auth/registration-form.tsx`
- Create: `src/components/auth/password-login-form.tsx`
- Create: `src/components/auth/__tests__/registration-form.test.tsx`
- Create: `src/components/auth/__tests__/password-login-form.test.tsx`
- Create: `src/app/register/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/proxy.ts`

**Interfaces:**

- Consumes: `registrationSchema`, `passwordLoginSchema`, `check_registration_code`, `complete_code_registration`.
- Produces: `POST /api/auth/register`
- Produces: `RegistrationForm`, `PasswordLoginForm`

- [ ] **Step 1: Write failing component tests**

Assert registration posts normalized input and one stable request ID:

```ts
expect(fetchMock).toHaveBeenCalledWith(
  "/api/auth/register",
  expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      displayName: "Alex",
      email: "alex@example.com",
      password: "ten-characters",
      inviteCode: "MTP-M-23456789ABCDEFGH",
      requestId,
    }),
  }),
);
```

Assert password login calls `signInWithPassword`, successful login routes to
`/club`, and invalid credentials show a generic error.

- [ ] **Step 2: Run component tests and observe failure**

Expected: FAIL because pages/components do not exist.

- [ ] **Step 3: Implement registration orchestration**

The route:

1. Parses JSON with `registrationSchema`.
2. Derives a network key from trusted Vercel headers.
3. Calls `check_registration_code`.
4. Lists an existing Auth user by normalized email only through the admin API.
5. Creates a confirmed user with:

```ts
await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: displayName },
});
```

6. Calls `complete_code_registration`.
7. Deletes a newly created user if completion fails.
8. Signs in through the cookie-writing server client with
   `signInWithPassword`.
9. Returns `{ ok: true }`; all expected failures return
   `{ error: "registration_failed" }`.

An existing invited user may receive the submitted password and become active;
an existing active membership always fails without revealing why.

- [ ] **Step 4: Implement mobile registration and password login**

Registration fields use `autoComplete` values `name`, `email`, `new-password`,
and `one-time-code`. The submit button remains disabled during a request.
Ambiguous retries preserve the exact payload/request ID.

Password login uses the browser Supabase client and:

```ts
await supabase.auth.signInWithPassword({ email, password });
```

- [ ] **Step 5: Update public routes and middleware**

Landing page links to `/register` and `/login`. Proxy allows unauthenticated
access to `/register`, `/login`, `/auth/confirm`, `/auth/callback`, and
`/api/auth/register`, while protected application routes retain cookie refresh.

- [ ] **Step 6: Run tests, typecheck, and build**

```bash
pnpm test -- src/components/auth
pnpm typecheck
pnpm build
```

Expected: PASS and route manifest includes `/register` and
`/api/auth/register`.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components/auth src/proxy.ts
git commit -m "feat: add invite-code password registration"
```

---

### Task 4: Administrator access-security controls

**Files:**

- Create: `src/app/api/admin/access-codes/route.ts`
- Create: `src/components/admin/access-security.tsx`
- Create: `src/components/admin/__tests__/access-security.test.tsx`
- Create: `src/app/(app)/admin/security/page.tsx`
- Modify: `src/app/(app)/admin/page.tsx`

**Interfaces:**

- Consumes: `generateAccessCode`, `passwordUpdateSchema`, `rotate_access_code`.
- Produces: `POST /api/admin/access-codes` with `{ kind, requestId }`.
- Produces: authenticated password update through `supabase.auth.updateUser`.

- [ ] **Step 1: Write failing security-page tests**

Assert:

- member/admin initialization and rotation buttons;
- returned plaintext is displayed once with Copy;
- a second successful rotation replaces the prior plaintext;
- no endpoint response or UI displays a hash;
- password setup requires matching 10-character passwords;
- administrator-code warning is always visible.

- [ ] **Step 2: Run tests and observe missing component**

- [ ] **Step 3: Implement rotation endpoint**

Require `getAdminRequestContext`, generate a code server-side, call
`rotate_access_code(kind, code, requestId)`, and return:

```json
{ "kind": "member", "code": "MTP-M-...", "rotatedAt": "..." }
```

Set `cache-control: no-store`; never log request/response bodies.

- [ ] **Step 4: Implement access-security page**

The page shows only rotation timestamps on reload. Plaintext exists only in
client state after a successful response. Password setup calls:

```ts
await getBrowserSupabaseClient().auth.updateUser({ password });
```

- [ ] **Step 5: Run component tests, lint, and typecheck**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/access-codes src/app/'(app)'/admin/security src/components/admin src/app/'(app)'/admin/page.tsx
git commit -m "feat: add access code rotation controls"
```

---

### Task 5: Game-action request database workflow

**Files:**

- Create: `supabase/migrations/0012_game_action_requests.sql`
- Create: `supabase/tests/game_action_requests.test.sql`

**Interfaces:**

- Produces: `submit_game_action_request(target_game_id uuid, target_game_player_id uuid, target_action game_request_action, target_amount bigint, target_request_id uuid) returns jsonb`
- Produces: `cancel_game_action_request(target_request_id uuid, mutation_request_id uuid) returns jsonb`
- Produces: `review_game_action_request(target_request_id uuid, decision game_request_decision, review_note text, mutation_request_id uuid) returns jsonb`
- Produces: `set_game_registration(target_game_id uuid, target_open boolean, expected_version bigint, target_request_id uuid) returns jsonb`

- [ ] **Step 1: Write failing pgTAP request tests**

Test:

- member can request join to a registration-open draft or active game;
- membership is derived from `auth.uid()`;
- member cannot submit for another game-player;
- closed registration rejects join;
- add-on and exit require own active game-player;
- one pending exit blocks add-on;
- cancellation affects only own pending request;
- administrator approval applies one existing ledger mutation and audit;
- repeated approval request ID does not duplicate money;
- rejection changes no totals;
- stale/finalized/full-game approvals roll back;
- pending requests block finalization.

- [ ] **Step 2: Run focused pgTAP and observe missing schema**

- [ ] **Step 3: Add enums, game column, and request table**

```sql
create type public.game_request_action as enum ('join', 'add_on', 'exit');
create type public.game_request_status as enum (
  'pending', 'approved', 'rejected', 'cancelled'
);
create type public.game_request_decision as enum ('approve', 'reject');

alter table public.games
add column registration_open boolean not null default true;
```

Create `game_action_requests` exactly as defined in the approved design, with
safe-integer checks and request/status consistency checks.

- [ ] **Step 4: Add partial unique indexes and RLS**

Use partial uniqueness for pending join and each active-player action:

```sql
create unique index game_requests_pending_join_idx
on public.game_action_requests(game_id, membership_id)
where status = 'pending' and action = 'join';
```

Policies expose own rows to active members and all club rows to active admins.
Direct inserts/updates remain revoked; RPCs enforce transitions.

- [ ] **Step 5: Implement submission, cancellation, and registration toggle**

Submission derives the membership from `auth.uid()`, locks relevant rows, and
audits `game_request.created`. Cancellation requires the same membership and
audits `game_request.cancelled`. The toggle locks the game, checks expected
version, updates `registration_open` and version, and audits
`game.registration_changed`.

- [ ] **Step 6: Implement atomic review**

Approval locks the request/game, fetches the current game version, then invokes:

- `add_game_player` for `join`;
- `add_game_player_add_on` for `add_on`;
- `exit_game_player` for `exit`.

It uses the approval mutation request ID for downstream idempotency, marks the
request approved only after the ledger mutation succeeds, and writes
`game_request.approved`. Rejection marks only the request and writes
`game_request.rejected`.

- [ ] **Step 7: Add finalization guard**

A `before update of status` trigger rejects transition to `finalized` while any
request for the game is pending.

- [ ] **Step 8: Run all database tests**

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
```

Expected: all suites PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0012_game_action_requests.sql supabase/tests/game_action_requests.test.sql
git commit -m "feat: add member game action requests"
```

---

### Task 6: Member request APIs and mobile controls

**Files:**

- Create: `src/app/api/games/[gameId]/requests/route.ts`
- Create: `src/app/api/game-players/[gamePlayerId]/requests/route.ts`
- Create: `src/app/api/game-requests/[requestId]/route.ts`
- Create: `src/data/game-requests.ts`
- Create: `src/components/games/member-game-actions.tsx`
- Create: `src/components/games/game-request-list.tsx`
- Create: `src/components/games/__tests__/member-game-actions.test.tsx`
- Create: `src/components/games/__tests__/game-request-list.test.tsx`
- Modify: `src/app/(app)/club/page.tsx`

**Interfaces:**

- Consumes: Task 1 request schemas and Task 5 RPCs.
- Produces: member request endpoints and `MemberGameActions`.

- [ ] **Step 1: Write failing member UI tests**

Assert:

- nonparticipant sees join only when registration is open;
- active participant sees add-on and exit;
- pending exit disables add-on;
- cancel sends the original request ID plus a new stable mutation ID;
- no member control renders for another member's game-player record.

- [ ] **Step 2: Run focused tests and observe missing components**

- [ ] **Step 3: Implement request endpoints**

Each endpoint gets the authenticated user through the server client, validates
only action/amount/request ID, and lets the RPC derive membership/ownership.
Map SQL state conflicts to HTTP 409 and validation to 400.

- [ ] **Step 4: Implement request query mapper**

Return:

```ts
export interface GameActionRequestView {
  id: string;
  action: "join" | "add_on" | "exit";
  amount: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  reviewNote: string | null;
}
```

- [ ] **Step 5: Implement member controls**

Forms preserve exact payload/request ID after transport/5xx ambiguity. The
request list uses status chips and offers Cancel only for pending own requests.

- [ ] **Step 6: Integrate the club page**

Load the current member's game-player and requests alongside the active game.
Render actions below game summary without exposing administrator writes.

- [ ] **Step 7: Run tests and build**

Expected: component tests, full Vitest, typecheck, and build PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/games src/app/api/game-players src/app/api/game-requests src/data/game-requests.ts src/components/games src/app/'(app)'/club/page.tsx
git commit -m "feat: add member game request controls"
```

---

### Task 7: Administrator review queue and realtime mid-game membership

**Files:**

- Create: `src/app/api/admin/game-requests/[requestId]/route.ts`
- Create: `src/app/api/admin/games/[gameId]/registration/route.ts`
- Create: `src/components/games/game-request-queue.tsx`
- Create: `src/components/games/__tests__/game-request-queue.test.tsx`
- Modify: `src/components/games/game-admin-console.tsx`
- Modify: `src/components/games/game-realtime-refresh.tsx`
- Modify: `src/app/(app)/admin/games/[gameId]/page.tsx`

**Interfaces:**

- Consumes: Task 5 review/toggle RPCs and Task 6 request views.
- Produces: admin review/toggle endpoints and realtime queue UI.

- [ ] **Step 1: Write failing admin queue tests**

Assert approval/rejection includes a stable request ID, pending cards show
member/action/amount, HTTP 5xx offers exact safe retry, and registration toggle
reflects open/closed state.

- [ ] **Step 2: Run focused tests and observe failure**

- [ ] **Step 3: Implement admin endpoints**

Require `getAdminRequestContext`. Review endpoint accepts:

```ts
{
  decision: "approve" | "reject";
  note?: string;
  requestId: string;
}
```

Registration endpoint accepts `{ open, expectedVersion, requestId }`.

- [ ] **Step 4: Implement review queue and registration toggle**

Approved/rejected rows leave the pending queue after router refresh. Conflict
responses explain that the game/request changed and require refresh rather than
blind retry.

- [ ] **Step 5: Expand realtime subscriptions**

Subscribe to:

- `games` filtered by game ID;
- `game_players` filtered by game ID;
- `game_transactions` filtered by game ID;
- `game_action_requests` filtered by game ID;
- `memberships` filtered by club ID.

Debounce bursts into one `router.refresh()` call. Pass `clubId` and `gameId`
from both member and admin pages.

- [ ] **Step 6: Load queue and newly active memberships**

Admin game page queries pending requests and active memberships on every
refresh. A registration event therefore adds the member to the direct-add
selector even after game start.

- [ ] **Step 7: Run component/full tests and build**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/admin src/components/games src/app/'(app)'/admin/games
git commit -m "feat: add realtime game request approval"
```

---

### Task 8: Recovery, production migration, and end-to-end release

**Files:**

- Create: `src/components/auth/password-recovery-form.tsx`
- Create: `src/components/auth/password-update-form.tsx`
- Create: `src/app/recover/page.tsx`
- Create: `src/app/auth/update-password/page.tsx`
- Create: `tests/e2e/registration-and-requests.spec.ts`
- Modify: `src/app/auth/confirm/route.ts`
- Modify: `src/app/(app)/admin/security/page.tsx`
- Modify: `docs/deployment.md`

**Interfaces:**

- Consumes: token-hash confirmation and all prior tasks.
- Produces: password recovery/update flow and deployment runbook.

- [ ] **Step 1: Write failing recovery and E2E tests**

Recovery confirmation with `type=recovery` must redirect to
`/auth/update-password`. Playwright covers member-code registration, password
login, join request, administrator approval, realtime appearance, add-on/exit
requests, and code rotation.

- [ ] **Step 2: Extend supported OTP confirmation type**

Add `recovery` to `SupportedEmailOtpType`; force its post-confirmation
destination to `/auth/update-password` regardless of `next`.

- [ ] **Step 3: Implement recovery/update forms**

Recovery calls:

```ts
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${location.origin}/auth/confirm?next=/auth/update-password`,
});
```

Update requires an authenticated recovery session and calls
`supabase.auth.updateUser({ password })`.

Set the Supabase **Reset Password** email template action link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">
  Reset password
</a>
```

- [ ] **Step 4: Document production order**

Document:

1. merge application;
2. run database migration workflow;
3. deploy Vercel;
4. current admin uses existing session/Magic Link once;
5. set admin password;
6. initialize both codes;
7. test member registration;
8. remove Magic Link from primary navigation;
9. distribute member code.

- [ ] **Step 5: Commit and push before hosted testing**

```bash
git add src tests/e2e docs/deployment.md
git commit -m "feat: complete password registration rollout"
git push -u origin cursor/poker-club-mvp-design-7840
```

- [ ] **Step 6: Run local verification**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test
pnpm exec supabase db reset
pnpm exec supabase test db
```

Expected: every command exits 0.

- [ ] **Step 7: Deploy and validate production**

Run `Deploy Supabase` from `main`, confirm every new migration finishes, and
verify:

```bash
curl -fsS https://middle-treasure-poker-club.vercel.app/
curl -fsS https://middle-treasure-poker-club.vercel.app/register
curl -fsS https://middle-treasure-poker-club.vercel.app/login
```

Expected: HTTP 200.

- [ ] **Step 8: Perform mobile smoke test**

Use non-production member/admin accounts and non-sensitive test amounts.
Capture one concise walkthrough showing registration, request submission, admin
approval, and realtime updated totals. Never display invite codes, emails,
passwords, Magic Links, or service keys in the artifact.

- [ ] **Step 9: Final commit for verification-only fixes**

If verification changed files, create one focused commit, push it, and update
the pull request before reporting completion.
