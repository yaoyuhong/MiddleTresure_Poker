"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { passwordUpdateSchema } from "@/application/registration";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error">(
    "idle",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();
    setState("pending");
    try {
      const { error } =
        await getBrowserSupabaseClient().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      setState(error ? "error" : "sent");
    } catch {
      setState("error");
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block">
        <span className="text-sand/70 mb-2 block text-sm font-semibold">
          Email address
        </span>
        <input
          autoComplete="email"
          className="text-sand focus:border-mint min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none"
          name="email"
          required
          type="email"
        />
      </label>
      <button
        className="bg-mint text-ink min-h-11 rounded-full px-5 font-bold disabled:opacity-60"
        disabled={state === "pending"}
        type="submit"
      >
        Send recovery link
      </button>
      {state === "sent" ? (
        <p className="text-mint text-sm" role="status">
          If this account exists, a recovery link has been sent.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="text-sm text-red-200" role="alert">
          Recovery is temporarily unavailable.
        </p>
      ) : null}
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = passwordUpdateSchema.safeParse({
      password: String(form.get("password") ?? ""),
      confirmation: String(form.get("confirmation") ?? ""),
    });
    if (!parsed.success) {
      setError(true);
      return;
    }
    let updateError: unknown;
    try {
      const result = await getBrowserSupabaseClient().auth.updateUser({
        password: parsed.data.password,
      });
      updateError = result.error;
    } catch {
      updateError = new Error("Network error");
    }
    if (updateError) {
      setError(true);
      return;
    }
    router.replace("/club");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {["password", "confirmation"].map((name) => (
        <label className="block" key={name}>
          <span className="text-sand/70 mb-2 block text-sm font-semibold">
            {name === "password" ? "New password" : "Confirm password"}
          </span>
          <input
            autoComplete="new-password"
            className="text-sand focus:border-mint min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none"
            minLength={10}
            name={name}
            required
            type="password"
          />
        </label>
      ))}
      <button
        className="bg-mint text-ink min-h-11 rounded-full px-5 font-bold"
        type="submit"
      >
        Save new password
      </button>
      {error ? (
        <p className="text-sm text-red-200" role="alert">
          The password could not be updated.
        </p>
      ) : null}
    </form>
  );
}
