import { formatUnits } from "@/lib/format-units";

export interface SettlementTransferView {
  readonly id: string;
  readonly fromDisplayName: string;
  readonly toDisplayName: string;
  readonly amount: number;
}

interface SettlementPlanProps {
  readonly transfers: ReadonlyArray<SettlementTransferView>;
  readonly unitName: string;
}

export function SettlementPlan({ transfers, unitName }: SettlementPlanProps) {
  return (
    <section>
      <div className="space-y-2">
        {transfers.map((transfer) => (
          <div
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
            key={transfer.id}
          >
            <strong>{transfer.fromDisplayName}</strong>
            <div className="text-center">
              <span className="text-sand/35 block text-xs">pays</span>
              <span className="text-mint font-semibold">
                {formatUnits(transfer.amount, unitName)}
              </span>
            </div>
            <strong className="text-right">{transfer.toDisplayName}</strong>
          </div>
        ))}
      </div>
      <p className="text-sand/35 mt-4 text-center text-xs">
        Payments happen outside this app.
      </p>
    </section>
  );
}
