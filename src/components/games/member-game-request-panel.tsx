"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

export interface PendingGameRequest {
  readonly id: string;
  readonly action: "join" | "add_on" | "exit";
  readonly amount: number;
}

interface RequestPayload {
  action: PendingGameRequest["action"];
  amount: number;
  requestId: string;
}

export function MemberGameRequestPanel({
  gameId,
  pendingRequest,
  playerStatus,
  unitName,
}: {
  gameId: string;
  pendingRequest: PendingGameRequest | null;
  playerStatus: "active" | "exited" | null;
  unitName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const retry = useRef<RequestPayload | null>(null);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: RequestPayload["action"],
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    retry.current ??= {
      action,
      amount: Number(form.get("amount")),
      requestId: crypto.randomUUID(),
    };
    setPending(true);
    setError(false);
    try {
      const response = await fetch(`/api/games/${gameId}/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(retry.current),
      });
      if (!response.ok) {
        if (response.status < 500) retry.current = null;
        setError(true);
        return;
      }
      retry.current = null;
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    setPending(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/game-requests/${pendingRequest?.id ?? ""}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
        },
      );
      if (!response.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  if (pendingRequest) {
    return (
      <section className="border-mint/20 bg-mint/5 rounded-[2rem] border p-5">
        <h2 className="text-lg font-semibold">Request pending</h2>
        <p className="text-sand/55 mt-2 text-sm leading-6">
          {actionLabel(pendingRequest.action)} request is awaiting approval:{" "}
          {pendingRequest.amount.toLocaleString()} {unitName}.
        </p>
        <button
          className="mt-4 min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold"
          disabled={pending}
          onClick={cancel}
          type="button"
        >
          Cancel request
        </button>
        {error ? <RequestError /> : null}
      </section>
    );
  }

  if (playerStatus === "exited") {
    return (
      <p className="text-sand/45 rounded-2xl border border-white/10 p-5 text-sm">
        Your participation in this game is complete.
      </p>
    );
  }

  return (
    <section className="bg-panel rounded-[2rem] border border-white/10 p-5">
      <h2 className="text-lg font-semibold">Your table request</h2>
      <p className="text-sand/45 mt-2 text-sm leading-6">
        An administrator approves every amount before it reaches the official
        ledger.
      </p>
      {playerStatus === null ? (
        <AmountRequestForm
          action="join"
          disabled={pending}
          label="Requested buy-in"
          onSubmit={submit}
          submitLabel="Request to join"
          unitName={unitName}
        />
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <AmountRequestForm
            action="add_on"
            disabled={pending}
            label="Add-on amount"
            onSubmit={submit}
            submitLabel="Request add-on"
            unitName={unitName}
          />
          <AmountRequestForm
            action="exit"
            allowZero
            disabled={pending}
            label="Cash-out amount"
            onSubmit={submit}
            submitLabel="Request exit"
            unitName={unitName}
          />
        </div>
      )}
      {error ? <RequestError /> : null}
    </section>
  );
}

function AmountRequestForm({
  action,
  allowZero = false,
  disabled,
  label,
  onSubmit,
  submitLabel,
  unitName,
}: {
  action: RequestPayload["action"];
  allowZero?: boolean;
  disabled: boolean;
  label: string;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    action: RequestPayload["action"],
  ) => void;
  submitLabel: string;
  unitName: string;
}) {
  return (
    <form className="mt-5" onSubmit={(event) => onSubmit(event, action)}>
      <label className="block">
        <span className="text-sand/70 text-sm font-semibold">{label}</span>
        <div className="focus-within:border-mint mt-2 flex items-center rounded-2xl border border-white/10 bg-black/20">
          <input
            className="text-sand min-h-12 min-w-0 flex-1 bg-transparent px-4 outline-none"
            min={allowZero ? 0 : 1}
            name="amount"
            required
            step={1}
            type="number"
          />
          <span className="text-sand/35 pr-4 text-xs">{unitName}</span>
        </div>
      </label>
      <button
        className="bg-mint text-ink mt-3 min-h-11 rounded-full px-5 font-bold disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function RequestError() {
  return (
    <p className="mt-3 text-sm text-red-200" role="alert">
      The request could not be saved. Refresh the game before trying again.
    </p>
  );
}

function actionLabel(action: PendingGameRequest["action"]) {
  if (action === "add_on") return "Add-on";
  if (action === "exit") return "Exit";
  return "Join";
}
