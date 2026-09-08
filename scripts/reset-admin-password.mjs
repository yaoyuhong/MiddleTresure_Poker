#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const help = `Reset the password of an existing active club administrator.

Usage:
  ADMIN_RESET_PASSWORD="<temporary-password>" pnpm recover:admin -- \\
    --admin-email "owner@example.com"

Options:
  --admin-email  Existing administrator email (required)
  --dry-run      Validate input without changing Supabase
  --help         Show this help

Environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ADMIN_RESET_PASSWORD

The command never creates users, grants roles, or prints passwords. The target
must already have an active administrator membership.`;

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(help);
  process.exit(0);
}

const temporaryPassword = process.env.ADMIN_RESET_PASSWORD;
validate(options, temporaryPassword);

if (options.dryRun) {
  console.log(
    JSON.stringify(
      { valid: true, adminEmail: options.adminEmail, passwordProvided: true },
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
const user = await findUserByEmail(supabase, options.adminEmail);
if (!user) {
  fail("The target is not an existing active administrator.");
}

const { data: membership, error: membershipError } = await supabase
  .from("memberships")
  .select("id")
  .eq("user_id", user.id)
  .eq("role", "admin")
  .eq("status", "active")
  .maybeSingle();
if (membershipError || !membership) {
  fail("The target is not an existing active administrator.");
}

const { error: updateError } = await supabase.auth.admin.updateUserById(
  user.id,
  {
    password: temporaryPassword,
    email_confirm: true,
  },
);
if (updateError) {
  fail("Supabase could not reset the administrator password.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      adminEmail: options.adminEmail,
      membershipId: membership.id,
      passwordReset: true,
    },
    null,
    2,
  ),
);

function parseArgs(args) {
  const parsed = { dryRun: false, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--help") {
      parsed.help = true;
      continue;
    }
    if (argument === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (argument !== "--admin-email") {
      fail(`Unknown option: ${argument}\n\n${help}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      fail("Missing value for --admin-email.");
    }
    parsed.adminEmail = value.trim().toLowerCase();
    index += 1;
  }
  return parsed;
}

function validate(options, password) {
  if (
    !options.adminEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.adminEmail)
  ) {
    fail("--admin-email must be a valid email address.");
  }
  if (
    !password ||
    password.length < 12 ||
    password.length > 128 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    fail(
      "ADMIN_RESET_PASSWORD must contain at least 12 characters, including a letter and a number.",
    );
  }
}

async function findUserByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      fail("Supabase user lookup failed.");
    }
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    if (user || data.users.length < 100) {
      return user ?? null;
    }
  }
  fail("User lookup exceeded the supported account limit.");
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
