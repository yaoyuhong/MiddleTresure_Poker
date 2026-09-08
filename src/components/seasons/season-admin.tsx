"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

export interface SeasonAdminRow {
  readonly id: string;
  readonly name: string;
  readonly status: "draft" | "open" | "closed";
}

export function SeasonAdmin({
  seasons,
}: {
  readonly seasons: ReadonlyArray<SeasonAdminRow>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const retryRequest = useRef<{ key: string; requestId: string } | null>(null);

  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const key = `create:${name}`;
    if (retryRequest.current && retryRequest.current.key !== key) {
      setError(true);
      return;
    }
    const requestId =
      retryRequest.current?.key === key
        ? retryRequest.current.requestId
        : crypto.randomUUID();
    setPending(true);
    setError(false);

    let response: Response;
    try {
      response = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: requestHeaders(requestId),
        body: JSON.stringify({ name }),
      });
    } catch {
      retryRequest.current = { key, requestId };
      setPending(false);
      setError(true);
      return;
    }

    if (response.status < 500) {
      retryRequest.current = null;
    }
    setPending(false);
    if (response.ok) {
      formElement.reset();
      router.refresh();
    } else {
      setError(true);
    }
  }

  async function changeSeason(seasonId: string, action: "open" | "close") {
    const key = `${action}:${seasonId}`;
    if (retryRequest.current && retryRequest.current.key !== key) {
      setError(true);
      return;
    }
    const requestId =
      retryRequest.current?.key === key
        ? retryRequest.current.requestId
        : crypto.randomUUID();
    setPending(true);
    setError(false);
    let response: Response;
    try {
      response = await fetch(`/api/admin/seasons/${seasonId}`, {
        method: "PATCH",
        headers: requestHeaders(requestId),
        body: JSON.stringify({ action }),
      });
    } catch {
      retryRequest.current = { key, requestId };
      setPending(false);
      setError(true);
      return;
    }
    if (response.status < 500) {
      retryRequest.current = null;
    }
    setPending(false);
    if (response.ok) {
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <section className="space-y-2">
        {seasons.map((season) => (
          <article
            className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
            key={season.id}
          >
            <span>
              <strong className="block">{season.name}</strong>
              <span className="text-sand/35 mt-1 block text-xs capitalize">
                {season.status}
              </span>
            </span>
            {season.status !== "closed" ? (
              <button
                className="min-h-10 rounded-full border border-white/10 px-4 text-sm font-semibold disabled:opacity-50"
                disabled={pending}
                onClick={() =>
                  changeSeason(
                    season.id,
                    season.status === "draft" ? "open" : "close",
                  )
                }
                type="button"
              >
                {season.status === "draft" ? "Open" : "Close"}
              </button>
            ) : null}
          </article>
        ))}
      </section>
      <form
        className="bg-panel h-fit rounded-[2rem] border border-white/10 p-5"
        onSubmit={createSeason}
      >
        <h2 className="text-xl font-semibold">New season</h2>
        <label
          className="mt-5 block text-sm font-semibold"
          htmlFor="seasonName"
        >
          Season name
        </label>
        <input
          className="focus:border-mint mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none"
          id="seasonName"
          maxLength={80}
          name="name"
          required
        />
        <button
          className="bg-mint text-ink mt-4 min-h-12 w-full rounded-full font-bold disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          Create draft
        </button>
        {error ? (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            The season change could not be saved.
          </p>
        ) : null}
      </form>
    </div>
  );
}

function requestHeaders(requestId: string) {
  return {
    "content-type": "application/json",
    "x-request-id": requestId,
  };
}
