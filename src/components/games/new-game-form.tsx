"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function NewGameForm({
  seasonId,
}: {
  readonly seasonId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seasonId) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(false);
    const response = await fetch("/api/admin/games", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        seasonId,
        name: String(form.get("name") ?? "").trim(),
      }),
    });
    setPending(false);

    if (response.ok) {
      const game = (await response.json()) as { id: string };
      router.push(`/admin/games/${game.id}`);
    } else {
      setError(true);
    }
  }

  return (
    <form
      className="bg-panel max-w-xl rounded-[2rem] border border-white/10 p-6"
      onSubmit={submit}
    >
      <label className="block text-sm font-semibold" htmlFor="gameName">
        Game name
      </label>
      <input
        className="focus:border-mint mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none"
        defaultValue={`Game · ${new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}`}
        disabled={!seasonId}
        id="gameName"
        maxLength={120}
        name="name"
        required
      />
      <button
        className="bg-mint text-ink mt-5 min-h-12 w-full rounded-full font-bold disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!seasonId || pending}
        type="submit"
      >
        {pending ? "Creating game…" : "Create draft game"}
      </button>
      {!seasonId ? (
        <p className="mt-3 text-sm text-amber-100" role="status">
          Open a season before creating a game.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-rose-200" role="alert">
          The game could not be created.
        </p>
      ) : null}
    </form>
  );
}
