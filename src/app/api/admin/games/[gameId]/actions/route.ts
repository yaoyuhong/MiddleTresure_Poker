import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminRequestContext } from "@/application/admin-context";
import { gameActionSchema } from "@/application/game-actions";
import { signedAmount } from "@/domain/money";
import { createSettlementPlan } from "@/domain/settlement";
import { getRequestId } from "@/lib/request-id";

interface BalanceRow {
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

  const input = gameActionSchema.safeParse(await safeJson(request));
  const { gameId } = await params;
  if (!input.success || !isUuid(gameId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const requestId = getRequestId(request.headers);
  let result: {
    data: unknown;
    error: { code?: string } | null;
  };

  switch (input.data.action) {
    case "start":
      result = await context.supabase.rpc("start_game", {
        target_game_id: gameId,
        expected_version: input.data.expectedVersion,
        target_request_id: requestId,
      });
      break;
    case "add-player":
      result = await context.supabase.rpc("add_game_player", {
        target_game_id: gameId,
        target_member_id: input.data.membershipId,
        initial_buy_in: input.data.amount,
        expected_version: input.data.expectedVersion,
        target_request_id: requestId,
      });
      break;
    case "add-on":
      result = await context.supabase.rpc("add_game_player_add_on", {
        target_game_player_id: input.data.gamePlayerId,
        add_on_amount: input.data.amount,
        expected_version: input.data.expectedVersion,
        target_request_id: requestId,
      });
      break;
    case "exit":
      result = await context.supabase.rpc("exit_game_player", {
        target_game_player_id: input.data.gamePlayerId,
        cash_out_amount: input.data.amount,
        expected_version: input.data.expectedVersion,
        target_request_id: requestId,
      });
      break;
    case "finalize":
      result = await finalizeGame(
        context.supabase,
        gameId,
        input.data.expectedVersion,
        requestId,
      );
      break;
    case "set-registration":
      result = await context.supabase.rpc("set_game_registration", {
        target_game_id: gameId,
        target_open: input.data.open,
        expected_version: input.data.expectedVersion,
        target_request_id: requestId,
      });
      break;
  }

  if (result.error) {
    return NextResponse.json(
      { error: "game_change_failed" },
      { status: mutationStatus(result.error.code) },
    );
  }

  return NextResponse.json(result.data);
}

async function finalizeGame(
  supabase: SupabaseClient,
  gameId: string,
  expectedVersion: number,
  requestId: string,
) {
  const { data, error } = await supabase
    .from("game_players")
    .select("id, net_result")
    .eq("game_id", gameId);

  if (error) {
    return { data: null, error };
  }

  let plan;
  try {
    plan = createSettlementPlan(
      ((data ?? []) as ReadonlyArray<BalanceRow>).map((player) => ({
        memberId: player.id,
        net: signedAmount(player.net_result),
      })),
    );
  } catch {
    return { data: null, error: { code: "23514" } };
  }

  return supabase.rpc("finalize_game", {
    target_game_id: gameId,
    expected_version: expectedVersion,
    target_request_id: requestId,
    proposed_plan: plan.map((transfer, index) => ({
      from_game_player_id: transfer.fromMemberId,
      to_game_player_id: transfer.toMemberId,
      amount: transfer.amount,
      position: index + 1,
    })),
  });
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
