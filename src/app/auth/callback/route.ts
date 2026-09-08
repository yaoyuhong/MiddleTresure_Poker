import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", requestUrl),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", requestUrl),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await activateInvitedMembership(user.id);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl));
}

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/club";
}

async function activateInvitedMembership(userId: string) {
  const admin = createAdminSupabaseClient();
  const { data: memberships } = await admin
    .from("memberships")
    .select("id, club_id")
    .eq("user_id", userId)
    .eq("status", "invited");

  for (const membership of memberships ?? []) {
    const activatedAt = new Date().toISOString();
    const { error } = await admin
      .from("memberships")
      .update({
        status: "active",
        activated_at: activatedAt,
        deactivated_at: null,
      })
      .eq("id", membership.id)
      .eq("status", "invited");

    if (!error) {
      await admin.from("audit_logs").insert({
        club_id: membership.club_id,
        actor_id: userId,
        action: "membership.activated",
        entity_type: "membership",
        entity_id: membership.id,
        request_id: crypto.randomUUID(),
        before_data: { status: "invited" },
        after_data: { status: "active", activated_at: activatedAt },
      });
    }
  }
}
