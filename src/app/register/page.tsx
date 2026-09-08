import Link from "next/link";

import { RegistrationForm } from "@/components/auth/registration-form";

export default function RegisterPage() {
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
          <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
            Invite-only access
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
            Create your account
          </h1>
          <p className="text-sand/50 mt-3 text-sm leading-6">
            Use the reusable code shared by your club administrator.
          </p>
          <div className="mt-7">
            <RegistrationForm />
          </div>
        </section>
        <p className="text-sand/45 mt-5 text-center text-sm">
          Already registered?{" "}
          <Link className="text-mint font-semibold" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
