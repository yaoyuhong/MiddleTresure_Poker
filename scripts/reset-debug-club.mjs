#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const confirmation = "DELETE_ALL_DEBUG_DATA";
const help = `Permanently reset debug club data while retaining one administrator.

Usage:
  pnpm reset:debug-club -- \\
    --retained-admin-email "owner@example.com" \\
    --confirm DELETE_ALL_DEBUG_DATA

Options:
  --retained-admin-email  Existing active administrator to retain (required)
  --confirm               Exact destructive phrase (required)
  --dry-run               Validate input without changing Supabase
  --help                  Show this help

This deletes every other Auth user, all games, seasons, requests, settlements,
and prior audit records. It retains the club, access codes, and named admin.`;

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(help);
  process.exit(0);
}
validate(options);

if (options.dryRun) {
  console.log(
    JSON.stringify(
      {
        valid: true,
        retainedAdminEmail: options.retainedAdminEmail,
        destructiveConfirmation: true,
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
const { data, error } = await supabase.rpc("reset_debug_club", {
  retained_admin_email: options.retainedAdminEmail,
  destructive_confirmation: options.confirm,
  target_request_id: crypto.randomUUID(),
});
if (error) {
  fail(`Debug reset failed (${error.code ?? "unknown"}).`);
}

const users = await listAllUsers(supabase);
if (
  users.length !== 1 ||
  users[0].email?.toLowerCase() !== options.retainedAdminEmail
) {
  fail("Post-reset verification found unexpected Auth users.");
}

console.log(
  JSON.stringify(
    {
      ...(data ?? {}),
      retainedAdminEmail: options.retainedAdminEmail,
      authUsersVerified: 1,
    },
    null,
    2,
  ),
);

function parseArgs(args) {
  const parsed = { dryRun: false, help: false };
  const names = {
    "--retained-admin-email": "retainedAdminEmail",
    "--confirm": "confirm",
  };
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
  if (parsed.retainedAdminEmail) {
    parsed.retainedAdminEmail = parsed.retainedAdminEmail.toLowerCase();
  }
  return parsed;
}

function validate(options) {
  if (
    !options.retainedAdminEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.retainedAdminEmail)
  ) {
    fail("--retained-admin-email must be a valid email address.");
  }
  if (options.confirm !== confirmation) {
    fail(`Exact confirmation required: ${confirmation}`);
  }
}

async function listAllUsers(supabase) {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) fail("Could not verify remaining Auth users.");
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
  fail("Auth user verification exceeded the supported account limit.");
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
