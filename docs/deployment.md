# Deployment Guide

Middle Treasure uses managed Vercel and Supabase infrastructure. No
self-managed server is required, but a production deployment still needs a
database project, authentication email delivery, secrets, backups, and
monitoring.

## 1. Create the Supabase Project

1. Open <https://supabase.com/dashboard> and create a project in the preferred
   region.
2. Save the project reference, project URL, publishable key, database password,
   and service-role key in a password manager.
3. Never commit the database password or service-role key.
4. Link the repository from a trusted terminal:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref YOUR_PROJECT_REF
   pnpm exec supabase db push
   ```

5. Confirm every migration appears under **Database → Migrations**.

Alternatively, configure these GitHub Actions repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

Then run **Actions → Deploy Supabase → Run workflow** from `main`. The manual
workflow validates all three secrets before linking the project and applying
pending migrations. Its `production` environment can be configured with
required reviewers for an additional release gate.

## 2. Bootstrap the First Administrator

Create a local `.env.local` file containing the project URL, publishable key,
and service-role key. This file is ignored by Git. Validate the command without
changing Supabase:

```bash
pnpm bootstrap:admin -- \
  --club-name "Middle Treasure Poker" \
  --admin-email "owner@example.com" \
  --display-name "Club Owner" \
  --site-url "https://YOUR_PROJECT.vercel.app" \
  --dry-run
```

Remove `--dry-run` to create the single club, send the administrator invitation,
and create the audited administrator membership. The command is idempotent for
an existing user and never prints the service-role key.

The administrator opens the invitation email and signs in once to activate the
membership. Immediately open **Manage → Access security**:

1. Set a password for the existing administrator account.
2. Initialize the reusable member code.
3. Initialize the administrator code only if another administrator needs to
   register. This code grants administrator access and must not be shared as a
   member code.

Members then use `/register` with their email, password, and the current member
code. They become active immediately. Rotating a code blocks future use of the
old code but does not sign out existing members.

For a hosted bootstrap, add `SUPABASE_SERVICE_ROLE_KEY` to GitHub repository
secrets, then run **Actions → Bootstrap Club Admin** from `main`. Supply a
publicly reachable HTTPS site URL because it is embedded in the one-time
invitation link. The workflow suppresses command output so the administrator
email is not written to logs.

## 3. Configure Authentication

In **Authentication → URL Configuration**:

- Set the site URL to the production Vercel domain.
- Add the Vercel preview URL pattern only if preview authentication is needed.
- Add `http://127.0.0.1:3000/auth/callback` for local development.
- Add `https://YOUR_DOMAIN/auth/callback` for production.

In **Authentication → Providers → Email**:

1. Configure a production SMTP provider and a sender address on a verified
   domain.
2. Disable public email sign-up. The server creates accounts only after
   validating a club access code.
3. Keep email confirmation disabled for code registration because the server
   confirms the account after code validation. SMTP remains useful for the
   initial administrator bootstrap and future password recovery.

Use token-hash links so invitations work without a browser PKCE verifier. In
the **Invite user** email template, set the action link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">
  Accept invitation
</a>
```

The **Magic Link** template can use the same confirmation route with
`type=magiclink`. These links are a bootstrap/recovery path, not routine member
login. Do not use a raw `{{ .SiteURL }}` link because it does not verify or
establish a session.

Set the **Reset Password** template action link to:

```html
<a
  href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password"
>
  Reset password
</a>
```

## 4. Create the Vercel Project

1. Open <https://vercel.com/new>.
2. Import the GitHub repository.
3. Keep the detected Next.js framework and `pnpm` build settings.
4. Add these values in **Settings → Environment Variables**:

   | Variable                               | Visibility         |
   | -------------------------------------- | ------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`             | Browser-safe       |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe       |
   | `SUPABASE_SERVICE_ROLE_KEY`            | Server-only secret |

5. Apply production values to Production and separate test-project values to
   Preview. Do not point preview deployments at production club data.
6. Redeploy after adding or rotating environment variables.

## 5. Preview Release Gate

Before promoting a deployment:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test
```

Against the preview deployment, verify:

- An incorrect or rotated code cannot create an account.
- The member code creates a member account; the administrator code creates an
  administrator account.
- A member can submit a join, add-on, or exit request but cannot write the
  official game ledger directly.
- An administrator can approve or reject each request exactly once.
- An administrator can create and operate a game.
- Two signed-in browsers receive a live update.
- An unbalanced game cannot close.
- A balanced game closes once and produces a valid transfer plan.
- Season ranking changes exactly once.

## 6. Domain and Production Promotion

1. Attach a custom domain under **Vercel → Settings → Domains**.
2. Add the DNS records Vercel provides.
3. Add the final callback URL to Supabase before switching traffic.
4. Promote only the preview build that passed smoke testing.
5. Repeat login, permissions, live update, settlement, and ranking smoke tests
   on the production URL.

## 7. Backups, Monitoring, and Recovery

- Select a Supabase plan with backup and point-in-time recovery appropriate for
  real club records.
- Configure Vercel function-error alerts and an external uptime check.
- Record request correlation IDs in server logs; do not log magic links,
  cookies, service keys, or complete member records.
- Practice restoring into a non-production Supabase project.
- Roll back application code through Vercel deployment promotion. Never roll
  back a database by deleting migrations; use a forward corrective migration.
- Export finalized season records according to the club's retention policy.

## 8. Legal and Privacy Checklist

Before real use:

- Publish privacy and retention notices.
- Restrict administrator access to the smallest possible group.
- Confirm applicable local laws and club policies for recording poker-related
  results.
- Keep the product ledger-only: do not add payment credentials, money custody,
  or payment execution without a separate legal and security review.
