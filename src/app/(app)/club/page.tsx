import Link from "next/link";

import { GameRealtimeRefresh } from "@/components/games/game-realtime-refresh";
import { GameSummaryCard } from "@/components/games/game-summary";
import { PlayerCard } from "@/components/games/player-card";
import { getClubContext } from "@/data/club";
import { getActiveGame } from "@/data/games";

export default async function ClubHomePage() {
  const context = await getClubContext();

  if (!context.club) {
    return null;
  }

  const club = context.club;
  const game = await getActiveGame(club.id);

  if (!game) {
    return (
      <main>
        <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
          Club home
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          Ready for the next game
        </h1>
        <section className="bg-panel mt-8 rounded-[2rem] border border-white/10 p-6">
          <p className="text-sand/50 text-sm">No active game</p>
          <p className="mt-2 text-xl font-semibold">
            The live table will appear here when an administrator starts it.
          </p>
          {context.role === "admin" ? (
            <Link
              className="bg-mint text-ink mt-6 inline-flex rounded-full px-5 py-3 text-sm font-bold"
              href="/admin"
            >
              Create a game
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main>
      <GameRealtimeRefresh gameId={game.id} />
      <div className="mb-6">
        <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
          Now playing
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
          {game.name}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <GameSummaryCard
          difference={game.difference}
          status={game.status}
          totalBuyIn={game.totalBuyIn}
          totalCashOut={game.totalCashOut}
          unitName={club.unitName}
        />
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Players</h2>
            <span className="text-sand/35 text-xs">
              {game.players.length} / 16
            </span>
          </div>
          <div className="space-y-3">
            {game.players.map((player) => (
              <PlayerCard
                canManage={context.role === "admin"}
                key={player.id}
                player={player}
                unitName={club.unitName}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
