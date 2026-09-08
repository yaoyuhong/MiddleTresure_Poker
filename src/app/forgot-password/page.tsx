import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/password-recovery";

export default function ForgotPasswordPage() {
  return (
    <main className="bg-ink text-sand grid min-h-dvh place-items-center px-5 py-10">
      <section className="bg-panel w-full max-w-md rounded-[2rem] border border-white/10 p-6">
        <h1 className="text-3xl font-semibold">Recover password</h1>
        <p className="text-sand/50 mt-3 text-sm leading-6">
          We will email the account owner a one-time recovery link.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
        <Link className="text-mint mt-6 inline-block text-sm" href="/login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
