import { notFound } from "next/navigation";

import { GameSummaryCard } from "@/components/games/game-summary";
import {
  PlayerCard,
  type PlayerCardData,
} from "@/components/games/player-card";
import {
  SettlementPlan,
  type SettlementTransferView,
} from "@/components/settlement/settlement-plan";
import { getClubContext } from "@/data/club";
import { money, signedAmount } from "@/domain/money";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface GameRow {
  id: string;
  name: string;
  status: "finalized";
  settlement_revision: number;
}

interface PlayerRow {
  id: string;
  member_id: string;
  status: "exited";
  total_buy_in: number;
  total_cash_out: number;
  net_result: number;
}

interface MembershipRow {
  id: string;
  user_id: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
}

interface TransferRow {
  id: string;
  from_game_player_id: string;
  to_game_player_id: string;
  amount: number;
}

export default async function FinalizedGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const context = await getClubContext();
  if (!context.club) {
    return null;
  }

  const club = context.club;
  const { gameId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: gameData } = await supabase
    .from("games")
    .select("id, name, status, settlement_revision")
    .eq("id", gameId)
    .eq("club_id", club.id)
    .eq("status", "finalized")
    .maybeSingle();

  if (!gameData) {
    notFound();
  }

  const game = gameData as GameRow;
  const [{ data: playerData }, { data: transferData }] = await Promise.all([
    supabase
      .from("game_players")
      .select("id, member_id, status, total_buy_in, total_cash_out, net_result")
      .eq("game_id", game.id)
      .order("joined_at"),
    supabase
      .from("settlement_transfers")
      .select("id, from_game_player_id, to_game_player_id, amount")
      .eq("game_id", game.id)
      .eq("revision", game.settlement_revision)
      .order("position"),
  ]);

  const playerRows = (playerData ?? []) as ReadonlyArray<PlayerRow>;
  const membershipIds = playerRows.map(({ member_id }) => member_id);
  const { data: membershipData } = await supabase
    .from("memberships")
    .select("id, user_id")
    .in("id", membershipIds);
  const memberships = (membershipData ?? []) as ReadonlyArray<MembershipRow>;
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      memberships.map(({ user_id }) => user_id),
    );
  const profiles = (profileData ?? []) as ReadonlyArray<ProfileRow>;
  const userByMembership = new Map(
    memberships.map(({ id, user_id }) => [id, user_id]),
  );
  const nameByUser = new Map(
    profiles.map(({ id, display_name }) => [id, display_name]),
  );
  const players: ReadonlyArray<PlayerCardData> = playerRows.map((player) => ({
    id: player.id,
    displayName:
      nameByUser.get(userByMembership.get(player.member_id) ?? "") ??
      "Club member",
    status: player.status,
    totalBuyIn: money(player.total_buy_in),
    totalCashOut: money(player.total_cash_out),
    netResult: signedAmount(player.net_result),
  }));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const transfers: ReadonlyArray<SettlementTransferView> = (
    (transferData ?? []) as ReadonlyArray<TransferRow>
  ).map((transfer) => ({
    id: transfer.id,
    fromDisplayName:
      playerById.get(transfer.from_game_player_id)?.displayName ?? "Member",
    toDisplayName:
      playerById.get(transfer.to_game_player_id)?.displayName ?? "Member",
    amount: money(transfer.amount),
  }));
  const totalBuyIn = players.reduce(
    (total, player) => money(total + player.totalBuyIn),
    money(0),
  );
  const totalCashOut = players.reduce(
    (total, player) => money(total + player.totalCashOut),
    money(0),
  );

  return (
    <main>
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Final settlement
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        {game.name}
      </h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-6">
          <GameSummaryCard
            difference={totalCashOut - totalBuyIn}
            status="finalized"
            totalBuyIn={totalBuyIn}
            totalCashOut={totalCashOut}
            unitName={club.unitName}
          />
          <section className="bg-panel rounded-[2rem] border border-white/10 p-5">
            <h2 className="mb-4 text-lg font-semibold">Who pays whom</h2>
            <SettlementPlan transfers={transfers} unitName={club.unitName} />
          </section>
        </div>
        <section className="space-y-3">
          {players.map((player) => (
            <PlayerCard
              canManage={false}
              key={player.id}
              player={player}
              unitName={club.unitName}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
