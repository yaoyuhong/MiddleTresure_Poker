"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { PlayerCardData } from "./player-card";
import { PlayerCard } from "./player-card";

interface AvailableMember {
  readonly id: string;
  readonly displayName: string;
}

interface GameAdminConsoleProps {
  readonly game: {
    readonly id: string;
    readonly status: "draft" | "active";
    readonly version: number;
    readonly difference: number;
  };
  readonly players: ReadonlyArray<PlayerCardData>;
  readonly availableMembers: ReadonlyArray<AvailableMember>;
  readonly unitName: string;
}

export function GameAdminConsole({
  game,
  players,
  availableMembers,
  unitName,
}: GameAdminConsoleProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);
  const [retryRequest, setRetryRequest] = useState<{
    body: Record<string, unknown>;
    requestId: string;
  } | null>(null);
  const allExited =
    players.length > 0 && players.every(({ status }) => status === "exited");
  const writesBlocked = pending || retryRequest !== null;

  async function mutate(
    body: Record<string, unknown>,
    requestId = crypto.randomUUID(),
  ) {
    setPending(true);
    setMessage(null);
    let response: Response;
    try {
      response = await fetch(`/api/admin/games/${game.id}/actions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
        },
        body: JSON.stringify({ ...body, expectedVersion: game.version }),
      });
    } catch {
      setPending(false);
      setMessage("error");
      setRetryRequest({ body, requestId });
      return false;
    }

    setPending(false);
    setMessage(response.ok ? "saved" : "error");
    if (response.ok) {
      setRetryRequest(null);
      router.refresh();
      return true;
    }
    setRetryRequest(response.status >= 500 ? { body, requestId } : null);
    return false;
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await mutate({
      action: "add-player",
      membershipId: String(form.get("membershipId")),
      amount: Number(form.get("amount")),
    });
    if (saved) {
      formElement.reset();
    }
  }

  async function playerAction(
    event: FormEvent<HTMLFormElement>,
    action: "add-on" | "exit",
    gamePlayerId: string,
  ) {
    event.preventDefault();
    if (
      action === "exit" &&
      !window.confirm("Confirm this player's final cash-out and exit?")
    ) {
      return;
    }
    const form = new FormData(event.currentTarget);
    await mutate({
      action,
      gamePlayerId,
      amount: Number(form.get("amount")),
    });
  }

  return (
    <div className="space-y-6">
      <section className="bg-panel rounded-[2rem] border border-white/10 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sand/35 text-xs tracking-[0.16em] uppercase">
              Game state
            </p>
            <p className="mt-1 text-xl font-semibold capitalize">
              {game.status}
            </p>
          </div>
          {game.status === "draft" ? (
            <button
              className="bg-mint text-ink min-h-11 rounded-full px-5 font-bold disabled:opacity-50"
              disabled={writesBlocked || players.length === 0}
              onClick={() => mutate({ action: "start" })}
              type="button"
            >
              Start game
            </button>
          ) : (
            <button
              className="bg-mint text-ink min-h-11 rounded-full px-5 font-bold disabled:cursor-not-allowed disabled:opacity-35"
              disabled={writesBlocked || !allExited || game.difference !== 0}
              onClick={() => {
                if (window.confirm("Finalize and lock this balanced game?")) {
                  mutate({ action: "finalize" });
                }
              }}
              type="button"
            >
              Finalize game
            </button>
          )}
        </div>
        {game.status === "active" && (!allExited || game.difference !== 0) ? (
          <p className="text-sand/40 mt-3 text-xs">
            Every player must exit and the table difference must be zero before
            finalization.
          </p>
        ) : null}
        {message === "saved" ? (
          <p className="text-mint mt-3 text-sm" role="status">
            Change saved.
          </p>
        ) : null}
        {message === "error" ? (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            The change was not confirmed.
          </p>
        ) : null}
        {retryRequest ? (
          <button
            className="mt-3 min-h-10 rounded-full border border-amber-200/20 px-4 text-sm font-semibold text-amber-100"
            disabled={pending}
            onClick={() => mutate(retryRequest.body, retryRequest.requestId)}
            type="button"
          >
            Retry the same request safely
          </button>
        ) : null}
      </section>

      {availableMembers.length > 0 ? (
        <form
          className="bg-panel grid gap-3 rounded-[2rem] border border-white/10 p-5 sm:grid-cols-[1fr_10rem_auto]"
          onSubmit={addPlayer}
        >
          <label>
            <span className="text-sand/40 mb-2 block text-xs">Member</span>
            <select
              className="bg-ink min-h-11 w-full rounded-xl border border-white/10 px-3"
              name="membershipId"
              required
            >
              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
          <AmountField label="Initial buy-in" name="amount" />
          <button
            className="border-mint/30 text-mint min-h-11 self-end rounded-full border px-4 text-sm font-bold disabled:opacity-50"
            disabled={writesBlocked}
            type="submit"
          >
            Add player
          </button>
        </form>
      ) : null}

      <section className="space-y-3">
        {players.map((player) => (
          <div key={player.id}>
            <PlayerCard canManage={false} player={player} unitName={unitName} />
            {game.status === "active" && player.status === "active" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <form
                  className="flex gap-2"
                  onSubmit={(event) => playerAction(event, "add-on", player.id)}
                >
                  <AmountField
                    label={`Add chips for ${player.displayName}`}
                    name="amount"
                  />
                  <button
                    className="bg-mint/10 text-mint self-end rounded-full px-3 text-sm font-semibold"
                    disabled={writesBlocked}
                    type="submit"
                  >
                    Add
                  </button>
                </form>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => playerAction(event, "exit", player.id)}
                >
                  <AmountField
                    label={`Cash-out for ${player.displayName}`}
                    name="amount"
                    allowZero
                  />
                  <button
                    className="self-end rounded-full border border-white/10 px-3 text-sm font-semibold"
                    disabled={writesBlocked}
                    type="submit"
                  >
                    Exit
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}

function AmountField({
  label,
  name,
  allowZero = false,
}: {
  label: string;
  name: string;
  allowZero?: boolean;
}) {
  return (
    <label className="min-w-0 flex-1">
      <span className="text-sand/40 mb-2 block truncate text-xs">{label}</span>
      <input
        className="focus:border-mint min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none"
        inputMode="numeric"
        min={allowZero ? 0 : 1}
        name={name}
        required
        step={1}
        type="number"
      />
    </label>
  );
}
