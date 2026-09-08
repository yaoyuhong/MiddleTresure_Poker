import { NextResponse, type NextRequest } from "next/server";

import { getAdminRequestContext } from "@/application/admin-context";
import { correctionRequestSchema } from "@/application/game-actions";
import { signedAmount } from "@/domain/money";
import { createSettlementPlan } from "@/domain/settlement";
import { getRequestId } from "@/lib/request-id";

interface PlayerBalanceRow {
  readonly id: string;
  readonly net_result: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const context = await getAdminRequestContext();
  if (!context) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const input = correctionRequestSchema.safeParse(await safeJson(request));
  const { gameId } = await params;
  if (!input.success || !isUuid(gameId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: playerData, error: playerError } = await context.supabase
    .from("game_players")
    .select("id, net_result")
    .eq("game_id", gameId);

  if (playerError) {
    return NextResponse.json({ error: "game_read_failed" }, { status: 400 });
  }

  const deltaByPlayer = new Map(
    input.data.corrections.map((correction) => [
      correction.gamePlayerId,
      signedAmount(correction.cashOutDelta - correction.buyInDelta),
    ]),
  );

  let settlement;
  try {
    settlement = createSettlementPlan(
      ((playerData ?? []) as ReadonlyArray<PlayerBalanceRow>).map((player) => ({
        memberId: player.id,
        net: signedAmount(
          signedAmount(player.net_result) + (deltaByPlayer.get(player.id) ?? 0),
        ),
      })),
    );
  } catch {
    return NextResponse.json(
      { error: "correction_not_zero_sum" },
      { status: 409 },
    );
  }

  const { data, error } = await context.supabase.rpc("correct_finalized_game", {
    target_game_id: gameId,
    expected_version: input.data.expectedVersion,
    target_request_id: getRequestId(request.headers),
    corrections: input.data.corrections.map((correction) => ({
      game_player_id: correction.gamePlayerId,
      correction_of: correction.correctionOf,
      buy_in_delta: correction.buyInDelta,
      cash_out_delta: correction.cashOutDelta,
    })),
    proposed_plan: settlement.map((transfer, index) => ({
      from_game_player_id: transfer.fromMemberId,
      to_game_player_id: transfer.toMemberId,
      amount: transfer.amount,
      position: index + 1,
    })),
    correction_note: input.data.note,
  });

  if (error) {
    return NextResponse.json(
      { error: "correction_failed" },
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
