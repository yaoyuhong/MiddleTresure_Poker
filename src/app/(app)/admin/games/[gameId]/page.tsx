import { notFound } from "next/navigation";

import {
  AdminRequestQueue,
  type AdminGameRequest,
} from "@/components/games/admin-request-queue";
import { GameAdminConsole } from "@/components/games/game-admin-console";
import { GameRealtimeRefresh } from "@/components/games/game-realtime-refresh";
import { GameSummaryCard } from "@/components/games/game-summary";
import type { PlayerCardData } from "@/components/games/player-card";
import { getClubContext } from "@/data/club";
import { money, signedAmount } from "@/domain/money";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface GameRow {
  id: string;
  name: string;
  status: "draft" | "active" | "finalized";
  version: number;
}

interface PlayerRow {
  id: string;
  member_id: string;
  status: "active" | "exited";
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

interface RequestRow {
  id: string;
  membership_id: string;
  action: "join" | "add_on" | "exit";
  amount: number;
  created_at: string;
}

export default async function AdminGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const context = await getClubContext();
  if (context.role !== "admin" || !context.club) {
    notFound();
  }

  const { gameId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: gameData, error: gameError } = await supabase
    .from("games")
    .select("id, name, status, version")
    .eq("id", gameId)
    .eq("club_id", context.club.id)
    .maybeSingle();

  if (gameError || !gameData) {
    notFound();
  }

  const game = gameData as GameRow;
  const { data: playerData, error: playerError } = await supabase
    .from("game_players")
    .select("id, member_id, status, total_buy_in, total_cash_out, net_result")
    .eq("game_id", game.id)
    .order("joined_at");
  const [
    { data: membershipData, error: membershipError },
    { data: requestData, error: requestError },
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id")
      .eq("club_id", context.club.id)
      .eq("status", "active"),
    supabase
      .from("game_action_requests")
      .select("id, membership_id, action, amount, created_at")
      .eq("game_id", game.id)
      .eq("status", "pending")
      .order("created_at"),
  ]);

  if (playerError || membershipError || requestError) {
    throw new Error("Could not load game administration data.");
  }

  const playerRows = (playerData ?? []) as ReadonlyArray<PlayerRow>;
  const memberships = (membershipData ?? []) as ReadonlyArray<MembershipRow>;
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      memberships.map(({ user_id }) => user_id),
    );

  if (profileError) {
    throw new Error("Could not load member profiles.");
  }

  const displayNames = new Map(
    ((profileData ?? []) as ReadonlyArray<ProfileRow>).map((profile) => [
      profile.id,
      profile.display_name,
    ]),
  );
  const membershipById = new Map(
    memberships.map((membership) => [membership.id, membership]),
  );
  const players: ReadonlyArray<PlayerCardData> = playerRows.map((player) => ({
    id: player.id,
    displayName:
      displayNames.get(membershipById.get(player.member_id)?.user_id ?? "") ??
      "Club member",
    status: player.status,
    totalBuyIn: money(player.total_buy_in),
    totalCashOut: money(player.total_cash_out),
    netResult: signedAmount(player.net_result),
  }));
  const participating = new Set(playerRows.map(({ member_id }) => member_id));
  const availableMembers = memberships
    .filter(({ id }) => !participating.has(id))
    .map((membership) => ({
      id: membership.id,
      displayName: displayNames.get(membership.user_id) ?? "Active club member",
    }));
  const requests: ReadonlyArray<AdminGameRequest> = (
    (requestData ?? []) as ReadonlyArray<RequestRow>
  ).map((request) => ({
    id: request.id,
    action: request.action,
    amount: request.amount,
    displayName:
      displayNames.get(
        membershipById.get(request.membership_id)?.user_id ?? "",
      ) ?? "Club member",
    createdAt: request.created_at,
  }));
  const totalBuyIn = players.reduce(
    (total, player) => money(total + player.totalBuyIn),
    money(0),
  );
  const totalCashOut = players.reduce(
    (total, player) => money(total + player.totalCashOut),
    money(0),
  );

  if (game.status === "finalized") {
    notFound();
  }

  return (
    <main>
      <GameRealtimeRefresh gameId={game.id} />
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Game control
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        {game.name}
      </h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-6">
          <GameSummaryCard
            difference={totalCashOut - totalBuyIn}
            status={game.status}
            totalBuyIn={totalBuyIn}
            totalCashOut={totalCashOut}
            unitName={context.club.unitName}
          />
          <section>
            <h2 className="mb-3 text-lg font-semibold">Member requests</h2>
            <AdminRequestQueue
              requests={requests}
              unitName={context.club.unitName}
            />
          </section>
        </div>
        <GameAdminConsole
          availableMembers={availableMembers}
          game={{
            id: game.id,
            status: game.status,
            version: game.version,
            difference: totalCashOut - totalBuyIn,
          }}
          players={players}
          unitName={context.club.unitName}
        />
      </div>
    </main>
  );
}
