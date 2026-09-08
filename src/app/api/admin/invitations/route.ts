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
  const redirectTo = new URL("/auth/confirm", request.url).toString();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(input.data.email, {
      data: { display_name: input.data.displayName },
      redirectTo,
    });

  const existingUser =
    inviteError || !invited.user
      ? await findUserByEmail(admin, input.data.email)
      : null;
  const invitedUser = invited.user ?? existingUser;
  const createdUser = !inviteError && Boolean(invited.user);

  if (!invitedUser) {
    return NextResponse.json({ error: "invitation_failed" }, { status: 409 });
  }

  const requestId = crypto.randomUUID();
  const { data: membership, error: membershipError } = await admin.rpc(
    "ensure_invited_membership",
    {
      target_club_id: actorMembership.club_id,
      target_user_id: invitedUser.id,
      target_invited_by: user.id,
      target_request_id: requestId,
    },
  );

  if (membershipError || !membership) {
    if (createdUser) {
      await admin.auth.admin.deleteUser(invitedUser.id);
    }
    return NextResponse.json({ error: "membership_failed" }, { status: 500 });
  }

  return NextResponse.json({ membershipId: membership.id }, { status: 201 });
}

async function findUserByEmail(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  email: string,
) {
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

async function safeJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
