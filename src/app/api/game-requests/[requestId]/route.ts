import { NextResponse, type NextRequest } from "next/server";

import { cancelGameRequestSchema } from "@/application/game-requests";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  const input = cancelGameRequestSchema.safeParse(await safeJson(request));
  if (!input.success || !isUuid(requestId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("cancel_game_action_request", {
    target_game_request_id: requestId,
    target_request_id: input.data.requestId,
  });
  if (error) {
    return NextResponse.json(
      { error: "cancellation_failed" },
      { status: error.code === "55000" ? 409 : 400 },
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
