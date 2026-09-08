"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

export interface CorrectableTransaction {
  readonly id: string;
  readonly gamePlayerId: string;
  readonly label: string;
}

interface CorrectionFormProps {
  readonly gameId: string;
  readonly gameVersion: number;
  readonly transactions: ReadonlyArray<CorrectableTransaction>;
}

export function CorrectionForm({
  gameId,
  gameVersion,
  transactions,
}: CorrectionFormProps) {
  const router = useRouter();
  const [rowIds, setRowIds] = useState([0, 1]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const corrections = rowIds.map((rowId) => {
      const [correctionOf, gamePlayerId] = String(
        form.get(`transaction-${rowId}`),
      ).split("|");

      return {
        correctionOf,
        gamePlayerId,
        buyInDelta: Number(form.get(`buy-in-${rowId}`)),
        cashOutDelta: Number(form.get(`cash-out-${rowId}`)),
      };
    });

    setPending(true);
    setError(false);
    requestId.current ??= crypto.randomUUID();
    let response: Response;
    try {
      response = await fetch(`/api/admin/games/${gameId}/corrections`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId.current,
        },
        body: JSON.stringify({
          expectedVersion: gameVersion,
          note: String(form.get("note") ?? "").trim(),
          corrections,
        }),
      });
    } catch {
      setPending(false);
      setError(true);
      return;
    }
    setPending(false);
    requestId.current = null;

    if (response.ok) {
      router.push(`/games/${gameId}`);
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-3">
        {rowIds.map((rowId, index) => (
          <fieldset
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
            key={rowId}
          >
            <legend className="px-2 text-sm font-semibold">
              Correction {index + 1}
            </legend>
            <label className="block">
              <span className="text-sand/40 mb-2 block text-xs">
                Original transaction
              </span>
              <select
                className="bg-ink min-h-11 w-full rounded-xl border border-white/10 px-3"
                name={`transaction-${rowId}`}
                required
              >
                {transactions.map((transaction) => (
                  <option
                    key={transaction.id}
                    value={`${transaction.id}|${transaction.gamePlayerId}`}
                  >
                    {transaction.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <SignedAmount label="Buy-in change" name={`buy-in-${rowId}`} />
              <SignedAmount
                label="Cash-out change"
                name={`cash-out-${rowId}`}
              />
            </div>
            {rowIds.length > 1 ? (
              <button
                className="text-sand/45 mt-3 text-xs font-semibold hover:text-rose-200"
                onClick={() =>
                  setRowIds((current) =>
                    current.filter((currentId) => currentId !== rowId),
                  )
                }
                type="button"
              >
                Remove correction
              </button>
            ) : null}
          </fieldset>
        ))}
      </div>

      {rowIds.length < 16 ? (
        <button
          className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold"
          onClick={() =>
            setRowIds((current) => [...current, Math.max(-1, ...current) + 1])
          }
          type="button"
        >
          Add another correction
        </button>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-semibold">
          Reason for correction
        </span>
        <textarea
          className="focus:border-mint min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 p-4 outline-none"
          maxLength={500}
          name="note"
          required
        />
      </label>

      <div className="rounded-2xl border border-amber-200/15 bg-amber-200/5 p-4 text-sm leading-6 text-amber-100/80">
        The corrected results must still sum to zero. Existing records remain in
        the audit history and a new settlement revision is created.
      </div>

      <button
        className="bg-mint text-ink min-h-12 w-full rounded-full font-bold disabled:opacity-50"
        disabled={pending || transactions.length === 0}
        type="submit"
      >
        {pending ? "Validating correction…" : "Apply audited correction"}
      </button>

      {error ? (
        <p className="text-sm text-rose-200" role="alert">
          The correction was not saved. Check that each player appears once and
          all corrected results still sum to zero.
        </p>
      ) : null}
    </form>
  );
}

function SignedAmount({ label, name }: { label: string; name: string }) {
  return (
    <label>
      <span className="text-sand/40 mb-2 block text-xs">{label}</span>
      <input
        className="focus:border-mint min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none"
        defaultValue={0}
        inputMode="numeric"
        name={name}
        required
        step={1}
        type="number"
      />
    </label>
  );
}
