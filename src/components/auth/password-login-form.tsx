"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function PasswordLoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");

    setPending(true);
    setError(false);
    let signInError: unknown;
    try {
      const result = await getBrowserSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });
      signInError = result.error;
    } catch {
      signInError = new Error("Network error");
    }
    setPending(false);

    if (signInError) {
      setError(true);
      return;
    }

    router.replace("/club");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <label className="block">
        <span className="text-sand/70 mb-2 block text-sm font-semibold">
          Email address
        </span>
        <input
          autoComplete="email"
          className="text-sand focus:border-mint min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block">
        <span className="text-sand/70 mb-2 block text-sm font-semibold">
          Password
        </span>
        <input
          autoComplete="current-password"
          className="text-sand focus:border-mint min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none"
          name="password"
          required
          type="password"
        />
      </label>
      <button
        className="bg-mint text-ink min-h-12 w-full rounded-full px-5 font-bold disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {error ? (
        <p
          className="rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"
          role="alert"
        >
          Email or password is incorrect.
        </p>
      ) : null}
    </form>
  );
}
