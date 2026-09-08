import { notFound } from "next/navigation";

import {
  CorrectionForm,
  type CorrectableTransaction,
} from "@/components/games/correction-form";
import { getClubContext } from "@/data/club";
import { formatUnits } from "@/lib/format-units";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface TransactionRow {
  id: string;
  game_player_id: string;
  type: string;
  amount: number;
}

interface PlayerRow {
  id: string;
  member_id: string;
}

interface MembershipRow {
  id: string;
  user_id: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
}

export default async function CorrectionPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const context = await getClubContext();
  if (context.role !== "admin" || !context.club) {
    notFound();
  }

  const club = context.club;
  const { gameId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, name, version")
    .eq("id", gameId)
    .eq("club_id", club.id)
    .eq("status", "finalized")
    .maybeSingle();

  if (!game) {
    notFound();
  }

  const [{ data: transactionData }, { data: playerData }] = await Promise.all([
    supabase
      .from("game_transactions")
      .select("id, game_player_id, type, amount")
      .eq("game_id", game.id)
      .in("type", ["initial_buy_in", "add_on", "cash_out", "exit"])
      .order("created_at"),
    supabase
      .from("game_players")
      .select("id, member_id")
      .eq("game_id", game.id),
  ]);
  const players = (playerData ?? []) as ReadonlyArray<PlayerRow>;
  const { data: membershipData } = await supabase
    .from("memberships")
    .select("id, user_id")
    .in(
      "id",
      players.map(({ member_id }) => member_id),
    );
  const memberships = (membershipData ?? []) as ReadonlyArray<MembershipRow>;
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      memberships.map(({ user_id }) => user_id),
    );
  const profiles = (profileData ?? []) as ReadonlyArray<ProfileRow>;
  const membershipById = new Map(
    memberships.map((membership) => [membership.id, membership]),
  );
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const playerName = new Map(
    players.map((player) => [
      player.id,
      profileById.get(membershipById.get(player.member_id)?.user_id ?? "")
        ?.display_name ?? "Club member",
    ]),
  );
  const transactions: ReadonlyArray<CorrectableTransaction> = (
    (transactionData ?? []) as ReadonlyArray<TransactionRow>
  ).map((transaction) => ({
    id: transaction.id,
    gamePlayerId: transaction.game_player_id,
    label: `${playerName.get(transaction.game_player_id) ?? "Member"} · ${transaction.type.replaceAll("_", " ")} · ${formatUnits(transaction.amount, club.unitName)}`,
  }));

  return (
    <main className="mx-auto max-w-2xl">
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Administrator audit
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        Correct {game.name}
      </h1>
      <p className="text-sand/45 mt-3 text-sm leading-6">
        Enter signed deltas, not replacement totals. Use negative values to
        reduce a recorded amount.
      </p>
      <div className="mt-8">
        <CorrectionForm
          gameId={game.id}
          gameVersion={game.version}
          transactions={transactions}
        />
      </div>
    </main>
  );
}
