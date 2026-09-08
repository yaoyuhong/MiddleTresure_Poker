import { formatUnits } from "@/lib/format-units";

interface GameSummaryCardProps {
  readonly totalBuyIn: number;
  readonly totalCashOut: number;
  readonly difference: number;
  readonly status: "draft" | "active" | "finalized";
  readonly unitName: string;
}

export function GameSummaryCard({
  totalBuyIn,
  totalCashOut,
  difference,
  status,
  unitName,
}: GameSummaryCardProps) {
  const balanced = difference === 0;
  const differenceLabel = balanced
    ? "Balanced"
    : difference < 0
      ? `${formatUnits(Math.abs(difference), unitName)} short`
      : `${formatUnits(difference, unitName)} over`;

  return (
    <section className="bg-panel rounded-[2rem] border border-white/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sand/40 text-xs font-semibold tracking-[0.18em] uppercase">
            Live table
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{differenceLabel}</h2>
        </div>
        <span
          className={
            balanced
              ? "bg-mint/10 text-mint rounded-full px-3 py-1.5 text-xs font-bold"
              : "rounded-full bg-amber-200/10 px-3 py-1.5 text-xs font-bold text-amber-100"
          }
        >
          {balanced ? "ZERO SUM" : "CHECK TOTALS"}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black/20 p-4">
          <dt className="text-sand/40 text-xs">Buy-ins</dt>
          <dd className="mt-1 text-xl font-semibold">
            {formatUnits(totalBuyIn, unitName)}
          </dd>
        </div>
        <div className="rounded-2xl bg-black/20 p-4">
          <dt className="text-sand/40 text-xs">Cash-outs</dt>
          <dd className="mt-1 text-xl font-semibold">
            {new Intl.NumberFormat("en-US").format(totalCashOut)}
          </dd>
        </div>
      </dl>

      <p className="text-sand/50 mt-4 text-sm">
        {balanced && status === "active"
          ? "Ready to finalize"
          : balanced
            ? "Final totals are balanced"
            : "Settlement is not balanced"}
      </p>
    </section>
  );
}
