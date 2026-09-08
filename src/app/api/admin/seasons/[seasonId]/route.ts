import { NextResponse, type NextRequest } from "next/server";

import { getAdminRequestContext } from "@/application/admin-context";
import { seasonActionSchema } from "@/application/game-actions";
import { getRequestId } from "@/lib/request-id";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const context = await getAdminRequestContext();
  if (!context) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const input = seasonActionSchema.safeParse(await safeJson(request));
  const { seasonId } = await params;
  if (!input.success || !isUuid(seasonId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const functionName =
    input.data.action === "open" ? "open_season" : "close_season";
  const { data, error } = await context.supabase.rpc(functionName, {
    target_season_id: seasonId,
    target_request_id: getRequestId(request.headers),
  });

  if (error) {
    return NextResponse.json(
      { error: "season_change_failed" },
      { status: mutationStatus(error.code) },
    );
  }

  return NextResponse.json(data);
}

function mutationStatus(code?: string): number {
  return code === "40001" || code === "23514" || code === "55000" ? 409 : 400;
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
