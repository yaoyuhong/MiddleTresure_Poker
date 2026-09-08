import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { registrationSchema } from "@/application/registration";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const input = registrationSchema.safeParse(await safeJson(request));
  if (!input.success) {
    return registrationFailure();
  }

  const admin = createAdminSupabaseClient();
  const networkKey = getNetworkKey(request);
  const { data: role, error: codeError } = await admin.rpc(
    "check_registration_code",
    {
      raw_code: input.data.inviteCode,
      normalized_email: input.data.email,
      network_key: networkKey,
      target_request_id: input.data.requestId,
    },
  );

  if (codeError || (role !== "member" && role !== "admin")) {
    return registrationFailure();
  }

  let user = await findUserByEmail(admin, input.data.email);
  let createdUser = false;

  if (user) {
    const { data: membership } = await admin
      .from("memberships")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership && membership.status !== "invited") {
      return registrationFailure();
    }

    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: input.data.password,
      email_confirm: true,
      user_metadata: { display_name: input.data.displayName },
    });
    if (error || !data.user) {
      return registrationFailure();
    }
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: input.data.email,
      password: input.data.password,
      email_confirm: true,
      user_metadata: { display_name: input.data.displayName },
    });
    if (error || !data.user) {
      return registrationFailure();
    }
    user = data.user;
    createdUser = true;
  }

  const { error: membershipError } = await admin.rpc(
    "complete_code_registration",
    {
      target_user_id: user.id,
      normalized_email: input.data.email,
      display_name: input.data.displayName,
      raw_code: input.data.inviteCode,
      target_request_id: input.data.requestId,
    },
  );

  if (membershipError) {
    if (createdUser) {
      await admin.auth.admin.deleteUser(user.id);
    }
    return registrationFailure();
  }

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.data.email,
    password: input.data.password,
  });

  return NextResponse.json(
    { ok: true, authenticated: !signInError },
    {
      status: 201,
      headers: { "cache-control": "no-store" },
    },
  );
}

async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<User | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      return null;
    }
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    if (user || data.users.length < 100) {
      return user ?? null;
    }
  }
  return null;
}

function getNetworkKey(request: NextRequest): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "unknown";
  return forwarded.split(",")[0].trim().slice(0, 128);
}

function registrationFailure() {
  return NextResponse.json(
    { error: "registration_failed" },
    {
      status: 400,
      headers: { "cache-control": "no-store" },
    },
  );
}

async function safeJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
