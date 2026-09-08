import { NextResponse, type NextRequest } from "next/server";

import { getAdminRequestContext } from "@/application/admin-context";
import { memberAccessSchema } from "@/application/invitations";
import { getRequestId } from "@/lib/request-id";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const context = await getAdminRequestContext();
  if (!context) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const input = memberAccessSchema.safeParse(await safeJson(request));
  const { membershipId } = await params;
  if (!input.success || !isUuid(membershipId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("set_member_access", {
    target_membership_id: membershipId,
    target_active: input.data.action === "reactivate",
    target_request_id: getRequestId(request.headers),
  });

  if (error) {
    return NextResponse.json(
      { error: "member_access_failed" },
      { status: error.code === "23514" ? 409 : 400 },
    );
  }

  return NextResponse.json(data);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function safeJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
