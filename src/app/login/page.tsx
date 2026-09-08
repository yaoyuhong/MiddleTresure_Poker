import Link from "next/link";

import { PasswordLoginForm } from "@/components/auth/password-login-form";

export default function LoginPage() {
  return (
    <main className="bg-ink text-sand grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link
          className="text-sand/50 hover:text-mint mb-8 inline-flex items-center gap-2 text-sm"
          href="/"
        >
          <span aria-hidden="true">←</span>
          Middle Treasure Poker
        </Link>
        <section className="bg-panel rounded-[2rem] border border-white/10 p-6 shadow-2xl shadow-black/25 sm:p-8">
          <span
            aria-hidden="true"
            className="bg-mint/10 text-mint mb-6 grid size-12 place-items-center rounded-full text-xl"
          >
            ♠
          </span>
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">
            Welcome back
          </h1>
          <p className="text-sand/50 mt-3 text-sm leading-6">
            Sign in with the email and password used during invite-code
            registration.
          </p>
          <div className="mt-7">
            <PasswordLoginForm />
          </div>
          <Link
            className="text-sand/45 hover:text-mint mt-4 inline-block text-sm"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </section>
        <p className="text-sand/45 mt-5 text-center text-sm">
          Have an invite code?{" "}
          <Link className="text-mint font-semibold" href="/register">
            Create an account
          </Link>
        </p>
        <p className="text-sand/35 mt-5 text-center text-xs leading-5">
          Club records only. This service does not process payments.
        </p>
      </div>
    </main>
  );
}
