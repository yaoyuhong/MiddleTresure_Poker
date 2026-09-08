import Link from "next/link";

import { getClubContext } from "@/data/club";
import { formatSignedUnits } from "@/lib/format-units";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface HistoryPlayerRow {
  readonly game_id: string;
  readonly total_buy_in: number;
  readonly total_cash_out: number;
  readonly net_result: number;
}

interface HistoryGameRow {
  readonly id: string;
  readonly name: string;
  readonly finalized_at: string;
}

export default async function HistoryPage() {
  const context = await getClubContext();
  if (!context.club || !context.membershipId) {
    return null;
  }

  const club = context.club;
  const supabase = await createServerSupabaseClient();
  const { data: playerData, error: playerError } = await supabase
    .from("game_players")
    .select("game_id, total_buy_in, total_cash_out, net_result")
    .eq("member_id", context.membershipId);

  if (playerError) {
    throw new Error("Could not load player history.");
  }

  const playerRows = (playerData ?? []) as ReadonlyArray<HistoryPlayerRow>;
  const gameIds = playerRows.map(({ game_id }) => game_id);
  let gameRows: ReadonlyArray<HistoryGameRow> = [];

  if (gameIds.length > 0) {
    const { data, error } = await supabase
      .from("games")
      .select("id, name, finalized_at")
      .in("id", gameIds)
      .eq("status", "finalized")
      .order("finalized_at", { ascending: false });
    if (error) {
      throw new Error("Could not load finalized games.");
    }
    gameRows = (data ?? []) as ReadonlyArray<HistoryGameRow>;
  }

  const playerByGame = new Map(
    playerRows.map((player) => [player.game_id, player]),
  );

  return (
    <main>
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Your record
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        Game history
      </h1>
      <div className="mt-8 space-y-3">
        {gameRows.length === 0 ? (
          <div className="text-sand/45 rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm">
            No finalized games yet.
          </div>
        ) : (
          gameRows.map((game) => {
            const player = playerByGame.get(game.id);
            if (!player) {
              return null;
            }

            return (
              <Link
                className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 hover:border-white/15"
                href={`/games/${game.id}`}
                key={game.id}
              >
                <span>
                  <strong className="block">{game.name}</strong>
                  <span className="text-sand/35 mt-1 block text-xs">
                    {new Date(game.finalized_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                  </span>
                </span>
                <strong
                  className={
                    player.net_result >= 0 ? "text-mint" : "text-rose-200"
                  }
                >
                  {formatSignedUnits(player.net_result, club.unitName)}
                </strong>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
