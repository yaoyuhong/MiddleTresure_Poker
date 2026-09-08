"use client";

import { useState, type FormEvent } from "react";

import { passwordUpdateSchema } from "@/application/registration";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export interface AccessCodeStatus {
  readonly kind: "member" | "admin";
  readonly rotatedAt: string;
}

export function AccessSecurity({
  codeStatus,
}: {
  codeStatus: ReadonlyArray<AccessCodeStatus>;
}) {
  const [passwordState, setPasswordState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [pendingKind, setPendingKind] = useState<"member" | "admin" | null>(
    null,
  );
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [rotationError, setRotationError] = useState(false);

  async function setPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const parsed = passwordUpdateSchema.safeParse({
      password: String(form.get("password") ?? ""),
      confirmation: String(form.get("confirmation") ?? ""),
    });
    if (!parsed.success) {
      setPasswordState("error");
      return;
    }

    setPasswordState("pending");
    const { error } = await getBrowserSupabaseClient().auth.updateUser({
      password: parsed.data.password,
    });
    setPasswordState(error ? "error" : "success");
    if (!error) {
      formElement.reset();
    }
  }

  async function rotate(kind: "member" | "admin") {
    setPendingKind(kind);
    setRotationError(false);
    setRevealedCode(null);
    try {
      const response = await fetch("/api/admin/access-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, requestId: crypto.randomUUID() }),
      });
      if (!response.ok) {
        setRotationError(true);
        return;
      }
      const result = (await response.json()) as { code: string };
      setRevealedCode(result.code);
    } catch {
      setRotationError(true);
    } finally {
      setPendingKind(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-panel rounded-[2rem] border border-white/10 p-5">
        <h2 className="text-xl font-semibold">Your administrator password</h2>
        <p className="text-sand/45 mt-2 text-sm leading-6">
          Set this once so your existing administrator account can use the new
          sign-in page.
        </p>
        <form className="mt-5 space-y-4" onSubmit={setPassword}>
          <PasswordField label="New password" name="password" />
          <PasswordField label="Confirm password" name="confirmation" />
          <button
            className="bg-mint text-ink min-h-11 rounded-full px-5 font-bold disabled:opacity-60"
            disabled={passwordState === "pending"}
            type="submit"
          >
            Set password
          </button>
          {passwordState === "success" ? (
            <p className="text-mint text-sm" role="status">
              Password updated.
            </p>
          ) : null}
          {passwordState === "error" ? (
            <p className="text-sm text-red-200" role="alert">
              Passwords must match and contain at least 10 characters.
            </p>
          ) : null}
        </form>
      </section>

      {(["member", "admin"] as const).map((kind) => {
        const status = codeStatus.find((item) => item.kind === kind);
        const initialized = Boolean(status);
        const label = `${initialized ? "Rotate" : "Initialize"} ${kind} code`;
        return (
          <section
            className="bg-panel rounded-[2rem] border border-white/10 p-5"
            key={kind}
          >
            <h2 className="text-xl font-semibold capitalize">{kind} code</h2>
            <p className="text-sand/45 mt-2 text-sm">
              {status
                ? `Last rotated ${new Date(status.rotatedAt).toLocaleString()}.`
                : "Not initialized."}
            </p>
            {kind === "admin" ? (
              <p className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-3 text-sm leading-6 text-amber-100">
                Anyone who knows the administrator code can create an
                administrator account. Share it only when intentionally adding
                another administrator.
              </p>
            ) : null}
            <button
              className="border-mint/30 text-mint mt-5 min-h-11 rounded-full border px-5 font-semibold disabled:opacity-60"
              disabled={pendingKind !== null}
              onClick={() => rotate(kind)}
              type="button"
            >
              {pendingKind === kind ? "Generating…" : label}
            </button>
          </section>
        );
      })}

      {revealedCode ? (
        <section
          className="border-mint/30 bg-mint/10 rounded-[2rem] border p-5"
          role="status"
        >
          <p className="text-sand/60 text-sm">
            Copy this code now. It will not be shown again.
          </p>
          <code className="text-mint mt-3 block text-xl font-bold break-all">
            {revealedCode}
          </code>
          <button
            className="border-mint/30 text-mint mt-4 min-h-10 rounded-full border px-4 text-sm font-semibold"
            onClick={() => navigator.clipboard.writeText(revealedCode)}
            type="button"
          >
            Copy code
          </button>
        </section>
      ) : null}
      {rotationError ? (
        <p className="text-sm text-red-200" role="alert">
          The access code could not be changed.
        </p>
      ) : null}
    </div>
  );
}

function PasswordField({ label, name }: { label: string; name: string }) {
  return (
    <label className="block">
      <span className="text-sand/70 mb-2 block text-sm font-semibold">
        {label}
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
  );
}
