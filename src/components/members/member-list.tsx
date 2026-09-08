"use client";

import { useState } from "react";

export interface MemberListRow {
  readonly id: string;
  readonly displayName: string;
  readonly role: "admin" | "member";
  readonly status: "invited" | "active" | "inactive";
}

export function MemberList({
  members: initialMembers,
}: {
  readonly members: ReadonlyArray<MemberListRow>;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function changeAccess(member: MemberListRow) {
    const action = member.status === "inactive" ? "reactivate" : "deactivate";
    setPendingId(member.id);
    setError(false);
    const response = await fetch(`/api/admin/members/${member.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-request-id": crypto.randomUUID(),
      },
      body: JSON.stringify({ action }),
    });
    setPendingId(null);

    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        status?: MemberListRow["status"];
      } | null;
      setMembers((current) =>
        current.map((item) =>
          item.id === member.id
            ? {
                ...item,
                status:
                  payload?.status ??
                  (action === "deactivate" ? "inactive" : "active"),
              }
            : item,
        ),
      );
    } else {
      setError(true);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {members.map((member) => (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
            key={member.id}
          >
            <span>
              <strong className="block">{member.displayName}</strong>
              <span className="text-sand/35 mt-1 block text-xs">
                {member.role}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sand/55 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold capitalize">
                {member.status}
              </span>
              {member.role === "member" ? (
                <button
                  aria-label={`${member.status === "inactive" ? "Reactivate" : "Deactivate"} ${member.displayName}`}
                  className="text-sand/60 min-h-9 rounded-full border border-white/10 px-3 text-xs font-semibold disabled:opacity-50"
                  disabled={pendingId === member.id}
                  onClick={() => changeAccess(member)}
                  type="button"
                >
                  {member.status === "inactive" ? "Reactivate" : "Deactivate"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-rose-200" role="alert">
          Member access was not changed. Refresh and try again.
        </p>
      ) : null}
    </div>
  );
}
