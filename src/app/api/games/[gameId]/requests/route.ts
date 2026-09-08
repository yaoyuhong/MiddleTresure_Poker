import { NextResponse, type NextRequest } from "next/server";

import { memberGameRequestSchema } from "@/application/game-requests";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const input = memberGameRequestSchema.safeParse(await safeJson(request));
  if (!input.success || !isUuid(gameId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("submit_game_action_request", {
    target_game_id: gameId,
    target_action: input.data.action,
    target_amount: input.data.amount,
    target_request_id: input.data.requestId,
  });
  if (error) {
    return NextResponse.json(
      { error: "request_failed" },
      { status: error.code === "55000" || error.code === "23505" ? 409 : 400 },
    );
  }

  return NextResponse.json(data, { status: 201 });
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
