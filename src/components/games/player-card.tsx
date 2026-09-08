import { formatSignedUnits, formatUnits } from "@/lib/format-units";

export interface PlayerCardData {
  readonly id: string;
  readonly displayName: string;
  readonly status: "active" | "exited";
  readonly totalBuyIn: number;
  readonly totalCashOut: number;
  readonly netResult: number;
}

interface PlayerCardProps {
  readonly player: PlayerCardData;
  readonly unitName: string;
  readonly canManage: boolean;
}

export function PlayerCard({ player, unitName, canManage }: PlayerCardProps) {
  const showActions = canManage && player.status === "active";

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{player.displayName}</h3>
            {player.status === "exited" ? (
              <span className="text-sand/45 rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase">
                Exited
              </span>
            ) : null}
          </div>
          <p className="text-sand/45 mt-1 text-sm">
            In {formatUnits(player.totalBuyIn, unitName)} · Out{" "}
            {formatUnits(player.totalCashOut, unitName)}
          </p>
        </div>
        <p
          className={
            player.netResult >= 0
              ? "text-mint font-semibold"
              : "font-semibold text-rose-200"
          }
        >
          {formatSignedUnits(player.netResult, unitName)}
        </p>
      </div>

      {showActions ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            aria-label={`Add chips for ${player.displayName}`}
            className="bg-mint/10 text-mint hover:bg-mint/15 min-h-11 rounded-full px-3 text-sm font-semibold"
            type="button"
          >
            Add chips
          </button>
          <button
            aria-label={`Exit ${player.displayName}`}
            className="text-sand/70 min-h-11 rounded-full border border-white/10 px-3 text-sm font-semibold hover:border-white/20"
            type="button"
          >
            Exit
          </button>
        </div>
      ) : null}
    </article>
  );
}
