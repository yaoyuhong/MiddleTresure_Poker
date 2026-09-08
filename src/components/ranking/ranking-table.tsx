import { formatSignedUnits } from "@/lib/format-units";

export interface RankingTableRow {
  readonly membershipId: string;
  readonly displayName: string;
  readonly profit: number;
  readonly rank: number;
}

interface RankingTableProps {
  readonly rows: ReadonlyArray<RankingTableRow>;
  readonly unitName: string;
}

export function RankingTable({ rows, unitName }: RankingTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-sand/45 rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm">
        No finalized games yet.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <li
          className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"
          key={row.membershipId}
        >
          <span className="text-mint text-center text-sm font-bold">
            #{row.rank}
          </span>
          <span className="font-semibold">{row.displayName}</span>
          <span
            className={
              row.profit >= 0
                ? "text-mint text-sm font-semibold"
                : "text-sm font-semibold text-rose-200"
            }
          >
            {formatSignedUnits(row.profit, unitName)}
          </span>
        </li>
      ))}
    </ol>
  );
}
