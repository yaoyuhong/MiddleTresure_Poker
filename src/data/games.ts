import { cache } from "react";

import type { PlayerCardData } from "@/components/games/player-card";
import { money, signedAmount } from "@/domain/money";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ActiveGameView {
  readonly id: string;
  readonly name: string;
  readonly status: "active";
  readonly version: number;
  readonly registrationOpen: boolean;
  readonly players: ReadonlyArray<PlayerCardData>;
  readonly totalBuyIn: number;
  readonly totalCashOut: number;
  readonly difference: number;
}

interface GameRow {
  readonly id: string;
  readonly name: string;
  readonly status: "active";
  readonly version: number;
  readonly registration_open: boolean;
}

interface PlayerRow {
  readonly id: string;
  readonly member_id: string;
  readonly status: "active" | "exited";
  readonly total_buy_in: number;
  readonly total_cash_out: number;
  readonly net_result: number;
}

interface MembershipRow {
  readonly id: string;
  readonly user_id: string;
}

interface ProfileRow {
  readonly id: string;
  readonly display_name: string;
}

export const getActiveGame = cache(
  async (clubId: string): Promise<ActiveGameView | null> => {
    const supabase = await createServerSupabaseClient();
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("id, name, status, version, registration_open")
      .eq("club_id", clubId)
      .eq("status", "active")
      .maybeSingle();

    if (gameError) {
      throw new Error("Could not load the active game.");
    }
    if (!gameData) {
      return null;
    }

    const game = gameData as GameRow;
    const { data: playerData, error: playerError } = await supabase
      .from("game_players")
      .select("id, member_id, status, total_buy_in, total_cash_out, net_result")
      .eq("game_id", game.id)
      .order("joined_at");

    if (playerError) {
      throw new Error("Could not load game players.");
    }

    const playerRows = (playerData ?? []) as ReadonlyArray<PlayerRow>;
    const membershipIds = playerRows.map(({ member_id }) => member_id);
    let membershipRows: ReadonlyArray<MembershipRow> = [];

    if (membershipIds.length > 0) {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, user_id")
        .in("id", membershipIds);
      if (error) {
        throw new Error("Could not load player memberships.");
      }
      membershipRows = (data ?? []) as ReadonlyArray<MembershipRow>;
    }

    const userIds = membershipRows.map(({ user_id }) => user_id);
    let profileRows: ReadonlyArray<ProfileRow> = [];

    if (userIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      if (error) {
        throw new Error("Could not load player profiles.");
      }
      profileRows = (data ?? []) as ReadonlyArray<ProfileRow>;
    }

    const userIdByMembership = new Map(
      membershipRows.map((membership) => [membership.id, membership.user_id]),
    );
    const displayNameByUser = new Map(
      profileRows.map((profile) => [profile.id, profile.display_name]),
    );
    const players = playerRows.map((player) => ({
      id: player.id,
      displayName:
        displayNameByUser.get(userIdByMembership.get(player.member_id) ?? "") ??
        "Club member",
      status: player.status,
      totalBuyIn: money(player.total_buy_in),
      totalCashOut: money(player.total_cash_out),
      netResult: signedAmount(player.net_result),
    }));
    const totalBuyIn = players.reduce(
      (total, player) => money(total + player.totalBuyIn),
      money(0),
    );
    const totalCashOut = players.reduce(
      (total, player) => money(total + player.totalCashOut),
      money(0),
    );

    return {
      id: game.id,
      name: game.name,
      status: "active",
      version: game.version,
      registrationOpen: game.registration_open,
      players,
      totalBuyIn,
      totalCashOut,
      difference: totalCashOut - totalBuyIn,
    };
  },
);
