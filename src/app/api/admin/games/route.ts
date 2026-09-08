import { NextResponse, type NextRequest } from "next/server";

import { getAdminRequestContext } from "@/application/admin-context";
import { createGameSchema } from "@/application/game-actions";
import { getRequestId } from "@/lib/request-id";

export async function POST(request: NextRequest) {
  const context = await getAdminRequestContext();
  if (!context) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const input = createGameSchema.safeParse(await safeJson(request));
  if (!input.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("create_game", {
    target_season_id: input.data.seasonId,
    game_name: input.data.name,
    target_request_id: getRequestId(request.headers),
  });

  if (error) {
    return NextResponse.json(
      { error: "game_create_failed" },
      { status: error.code === "55000" ? 409 : 400 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}

async function safeJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
