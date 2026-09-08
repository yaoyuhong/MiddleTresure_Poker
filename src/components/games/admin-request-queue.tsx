"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export interface AdminGameRequest {
  readonly id: string;
  readonly action: "join" | "add_on" | "exit";
  readonly amount: number;
  readonly displayName: string;
  readonly createdAt: string;
}

interface ReviewRetry {
  requestId: string;
  entityId: string;
  decision: "approve" | "reject";
}

export function AdminRequestQueue({
  requests,
  unitName,
}: {
  requests: ReadonlyArray<AdminGameRequest>;
  unitName: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const retry = useRef<ReviewRetry | null>(null);

  async function review(entityId: string, decision: ReviewRetry["decision"]) {
    if (
      retry.current &&
      (retry.current.entityId !== entityId ||
        retry.current.decision !== decision)
    ) {
      return;
    }
    retry.current ??= {
      entityId,
      decision,
      requestId: crypto.randomUUID(),
    };
    setPendingId(entityId);
    setError(false);
    try {
      const response = await fetch(`/api/admin/game-requests/${entityId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          note: "",
          requestId: retry.current.requestId,
        }),
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
      setPendingId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <p className="text-sand/40 rounded-2xl border border-dashed border-white/10 p-5 text-sm">
        No pending member requests.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <article
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          key={request.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{request.displayName}</h3>
              <p className="text-sand/50 mt-1 text-sm">
                {actionLabel(request.action)} ·{" "}
                {request.amount.toLocaleString()} {unitName}
              </p>
            </div>
            <time className="text-sand/30 text-xs">
              {new Date(request.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              aria-label={`Approve ${request.displayName}`}
              className="bg-mint text-ink min-h-10 rounded-full px-4 text-sm font-bold disabled:opacity-60"
              disabled={pendingId !== null}
              onClick={() => review(request.id, "approve")}
              type="button"
            >
              Approve
            </button>
            <button
              aria-label={`Reject ${request.displayName}`}
              className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-60"
              disabled={pendingId !== null}
              onClick={() => review(request.id, "reject")}
              type="button"
            >
              Reject
            </button>
          </div>
        </article>
      ))}
      {error ? (
        <p className="text-sm text-red-200" role="alert">
          The review outcome is unclear. Retry the same action safely.
        </p>
      ) : null}
    </div>
  );
}

function actionLabel(action: AdminGameRequest["action"]) {
  if (action === "add_on") return "Add-on";
  if (action === "exit") return "Exit";
  return "Join";
}
