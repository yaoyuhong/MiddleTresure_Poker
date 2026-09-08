import { NextResponse, type NextRequest } from "next/server";

import { invitationInputSchema } from "@/application/invitations";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: actorMembership } = await supabase
    .from("memberships")
    .select("id, club_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("status", "active")
    .maybeSingle();

  if (!actorMembership) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const input = invitationInputSchema.safeParse(await safeJson(request));
  if (!input.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const redirectTo = new URL("/auth/callback", request.url).toString();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(input.data.email, {
      data: { display_name: input.data.displayName },
      redirectTo,
    });

  if (inviteError || !invited.user) {
    return NextResponse.json({ error: "invitation_failed" }, { status: 409 });
  }

  const requestId = crypto.randomUUID();
  const { data: membership, error: membershipError } = await admin
    .from("memberships")
    .insert({
      club_id: actorMembership.club_id,
      user_id: invited.user.id,
      role: "member",
      status: "invited",
      invited_by: user.id,
    })
    .select("id")
    .single();

  if (membershipError || !membership) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: "membership_failed" }, { status: 500 });
  }

  const { error: auditError } = await admin.from("audit_logs").insert({
    club_id: actorMembership.club_id,
    actor_id: user.id,
    action: "membership.invited",
    entity_type: "membership",
    entity_id: membership.id,
    request_id: requestId,
    after_data: {
      email: input.data.email,
      display_name: input.data.displayName,
      role: "member",
      status: "invited",
    },
  });

  if (auditError) {
    await admin.from("memberships").delete().eq("id", membership.id);
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: "audit_failed" }, { status: 500 });
  }

  return NextResponse.json({ membershipId: membership.id }, { status: 201 });
}

async function safeJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
