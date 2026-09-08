#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const help = `Bootstrap the first invite-only club administrator.

Usage:
  pnpm bootstrap:admin -- \\
    --club-name "Middle Treasure Poker" \\
    --admin-email "owner@example.com" \\
    --display-name "Club Owner" \\
    --site-url "https://your-project.vercel.app"

Options:
  --club-name       Club display name (required)
  --admin-email     Email that receives the one-time invitation (required)
  --display-name    Administrator name shown to members (required)
  --site-url        Deployed application origin used for the callback (required)
  --unit-name       Smallest chip/accounting unit (default: chips)
  --dry-run         Validate input without changing Supabase
  --help            Show this help

Environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

The service-role key stays server-side. Never paste it into chat or commit it.`;

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  console.log(help);
  process.exit(0);
}

validateOptions(options);

if (options.dryRun) {
  console.log(
    JSON.stringify(
      {
        valid: true,
        clubName: options.clubName,
        adminEmail: options.adminEmail,
        displayName: options.displayName,
        siteUrl: options.siteUrl,
        unitName: options.unitName,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const existingUser = await findUserByEmail(supabase, options.adminEmail);
let user = existingUser;
let createdUser = false;

if (user) {
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { display_name: options.displayName },
  });
  if (error || !data.user) {
    fail("Could not update the existing administrator profile.");
  }
  user = data.user;
} else {
  const redirectTo = new URL("/auth/callback", options.siteUrl).toString();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    options.adminEmail,
    {
      data: { display_name: options.displayName },
      redirectTo,
    },
  );
  if (error || !data.user) {
    fail("Could not create the administrator invitation.");
  }
  user = data.user;
  createdUser = true;
}

const { data: result, error: bootstrapError } = await supabase.rpc(
  "bootstrap_club",
  {
    target_user_id: user.id,
    club_name: options.clubName,
    unit_name: options.unitName,
    target_request_id: crypto.randomUUID(),
  },
);

if (bootstrapError) {
  if (createdUser) {
    await supabase.auth.admin.deleteUser(user.id);
  }
  fail("Club bootstrap failed. No service key or password was printed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      ...result,
      adminEmail: options.adminEmail,
      invitation: createdUser ? "sent" : "existing user promoted",
    },
    null,
    2,
  ),
);

function parseArgs(args) {
  const parsed = { unitName: "chips", dryRun: false, help: false };
  const names = {
    "--club-name": "clubName",
    "--admin-email": "adminEmail",
    "--display-name": "displayName",
    "--site-url": "siteUrl",
    "--unit-name": "unitName",
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--help") {
      parsed.help = true;
      continue;
    }
    if (argument === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    const name = names[argument];
    if (!name) {
      fail(`Unknown option: ${argument}\n\n${help}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${argument}.`);
    }
    parsed[name] = value.trim();
    index += 1;
  }

  return parsed;
}

function validateOptions(value) {
  for (const name of ["clubName", "adminEmail", "displayName", "siteUrl"]) {
    if (!value[name]) {
      fail(`--${toKebab(name)} is required.\n\n${help}`);
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.adminEmail)) {
    fail("--admin-email must be a valid email address.");
  }
  value.adminEmail = value.adminEmail.toLowerCase();
  try {
    const siteUrl = new URL(value.siteUrl);
    if (siteUrl.protocol !== "https:" && siteUrl.hostname !== "localhost") {
      fail("--site-url must use HTTPS outside localhost.");
    }
    value.siteUrl = siteUrl.origin;
  } catch {
    fail("--site-url must be a valid absolute URL.");
  }
  if (value.clubName.length > 120 || value.displayName.length > 80) {
    fail("Club name or display name is too long.");
  }
  if (!value.unitName || value.unitName.length > 24) {
    fail("--unit-name must contain 1 to 24 characters.");
  }
}

async function findUserByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      fail("Could not inspect existing Supabase users.");
    }
    const found = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    if (found || data.users.length < 100) {
      return found;
    }
  }
  fail("User lookup exceeded 2,000 accounts; use a dedicated bootstrap path.");
}

function toKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
