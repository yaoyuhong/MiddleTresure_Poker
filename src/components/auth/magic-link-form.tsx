"use client";

import { useState, type FormEvent } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export function MagicLinkForm() {
  const [state, setState] = useState<SubmissionState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();

    const { error } = await getBrowserSupabaseClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });

    setState(error ? "error" : "success");
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div>
        <label
          className="text-sand/70 mb-2 block text-sm font-semibold"
          htmlFor="email"
        >
          Email address
        </label>
        <input
          autoComplete="email"
          className="text-sand placeholder:text-sand/25 focus:border-mint min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none"
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>
      <button
        className="bg-mint text-ink hover:bg-mint-bright min-h-12 w-full rounded-full px-5 font-bold transition disabled:cursor-wait disabled:opacity-60"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting"
          ? "Sending secure link…"
          : "Email me a sign-in link"}
      </button>
      {state === "success" ? (
        <p
          className="border-mint/20 bg-mint/10 text-mint rounded-2xl border p-3 text-sm"
          role="status"
        >
          Check your email for the sign-in link.
        </p>
      ) : null}
      {state === "error" ? (
        <p
          className="rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"
          role="alert"
        >
          We could not send a sign-in link. Ask a club administrator to check
          your invitation.
        </p>
      ) : null}
    </form>
  );
}
