"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegistrationToggle({
  gameId,
  gameVersion,
  open,
}: {
  gameId: string;
  gameVersion: number;
  open: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setPending(true);
    setError(false);
    try {
      const response = await fetch(`/api/admin/games/${gameId}/actions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          action: "set-registration",
          expectedVersion: gameVersion,
          open: !open,
        }),
      });
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

  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="font-semibold">
        Member registration is {open ? "open" : "closed"}
      </p>
      <p className="text-sand/45 mt-1 text-sm">
        {open
          ? "Members may request to join this game."
          : "New join requests are blocked; existing players may still request actions."}
      </p>
      <button
        className="border-mint/30 text-mint mt-3 min-h-10 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
        disabled={pending}
        onClick={toggle}
        type="button"
      >
        {open ? "Close registration" : "Open registration"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-red-200" role="alert">
          Registration state could not be changed.
        </p>
      ) : null}
    </div>
  );
}
