import { NextResponse, type NextRequest } from "next/server";

import { getAdminRequestContext } from "@/application/admin-context";
import { reviewGameRequestSchema } from "@/application/game-requests";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const context = await getAdminRequestContext();
  if (!context) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { requestId } = await params;
  const input = reviewGameRequestSchema.safeParse(await safeJson(request));
  if (!input.success || !isUuid(requestId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc(
    "review_game_action_request",
    {
      target_game_request_id: requestId,
      target_decision: input.data.decision,
      target_note: input.data.note || null,
      target_request_id: input.data.requestId,
    },
  );
  if (error) {
    return NextResponse.json(
      { error: "review_failed" },
      { status: error.code === "55000" || error.code === "23505" ? 409 : 400 },
    );
  }
  return NextResponse.json(data);
}

function isUuid(value: string) {
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
