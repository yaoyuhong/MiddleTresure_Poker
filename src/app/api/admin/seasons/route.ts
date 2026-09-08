import { NextResponse, type NextRequest } from "next/server";

import { getAdminRequestContext } from "@/application/admin-context";
import { createSeasonSchema } from "@/application/game-actions";
import { getRequestId } from "@/lib/request-id";

export async function POST(request: NextRequest) {
  const context = await getAdminRequestContext();
  if (!context) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const input = createSeasonSchema.safeParse(await safeJson(request));
  if (!input.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("create_season", {
    target_club_id: context.membership.club_id,
    season_name: input.data.name,
    target_request_id: getRequestId(request.headers),
  });

  if (error) {
    return NextResponse.json(
      { error: "season_create_failed" },
      { status: mutationStatus(error.code) },
    );
  }

  return NextResponse.json(data, { status: 201 });
}

function mutationStatus(code?: string): number {
  return code === "40001" || code === "23514" || code === "55000" ? 409 : 400;
}

async function safeJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
