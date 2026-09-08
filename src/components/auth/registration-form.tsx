"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

interface RegistrationPayload {
  displayName: string;
  email: string;
  password: string;
  inviteCode: string;
  requestId: string;
}

export function RegistrationForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const retryPayload = useRef<RegistrationPayload | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    retryPayload.current ??= {
      displayName: String(form.get("displayName") ?? "").trim(),
      email: String(form.get("email") ?? "")
        .trim()
        .toLowerCase(),
      password: String(form.get("password") ?? ""),
      inviteCode: String(form.get("inviteCode") ?? "")
        .trim()
        .toUpperCase(),
      requestId: crypto.randomUUID(),
    };

    setPending(true);
    setError(false);
    let response: Response;
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(retryPayload.current),
      });
    } catch {
      setPending(false);
      setError(true);
      return;
    }

    setPending(false);
    if (response.ok) {
      retryPayload.current = null;
      router.replace("/club");
      router.refresh();
      return;
    }
    if (response.status < 500) {
      retryPayload.current = null;
    }
    setError(true);
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field
        autoComplete="name"
        label="Display name"
        name="displayName"
        type="text"
      />
      <Field
        autoComplete="email"
        label="Email address"
        name="email"
        type="email"
      />
      <Field
        autoComplete="new-password"
        label="Password"
        minLength={10}
        name="password"
        type="password"
      />
      <Field
        autoCapitalize="characters"
        autoComplete="one-time-code"
        label="Invite code"
        name="inviteCode"
        type="text"
      />
      <button
        className="bg-mint text-ink min-h-12 w-full rounded-full px-5 font-bold disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      {error ? (
        <p
          className="rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"
          role="alert"
        >
          We could not create this account. Check your details and invite code,
          then try again.
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  type,
  ...inputProps
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  autoCapitalize?: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sand/70 mb-2 block text-sm font-semibold">
        {label}
      </span>
      <input
        {...inputProps}
        className="text-sand placeholder:text-sand/25 focus:border-mint min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none"
        name={name}
        required
        type={type}
      />
    </label>
  );
}
