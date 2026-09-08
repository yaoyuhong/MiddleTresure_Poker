"use client";

import { useState, type FormEvent } from "react";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export function InviteMemberForm() {
  const [state, setState] = useState<SubmissionState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setState("submitting");

    const response = await fetch("/api/admin/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: String(form.get("displayName") ?? "").trim(),
        email: String(form.get("email") ?? "")
          .trim()
          .toLowerCase(),
      }),
    });

    if (response.ok) {
      formElement.reset();
      setState("success");
    } else {
      setState("error");
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <label
          className="text-sand/65 mb-2 block text-sm font-semibold"
          htmlFor="displayName"
        >
          Display name
        </label>
        <input
          className="focus:border-mint min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none"
          id="displayName"
          maxLength={80}
          name="displayName"
          required
        />
      </div>
      <div>
        <label
          className="text-sand/65 mb-2 block text-sm font-semibold"
          htmlFor="inviteEmail"
        >
          Email address
        </label>
        <input
          autoComplete="email"
          className="focus:border-mint min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none"
          id="inviteEmail"
          name="email"
          required
          type="email"
        />
      </div>
      <button
        className="bg-mint text-ink min-h-12 w-full rounded-full px-5 font-bold disabled:cursor-wait disabled:opacity-60"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "Sending invitation…" : "Send invitation"}
      </button>
      {state === "success" ? (
        <p className="text-mint text-sm" role="status">
          Invitation sent.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="text-sm text-rose-200" role="alert">
          We could not send this invitation. Check the address or existing
          membership, then try again.
        </p>
      ) : null}
    </form>
  );
}
