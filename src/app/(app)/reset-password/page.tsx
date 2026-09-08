import { ResetPasswordForm } from "@/components/auth/password-recovery";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md">
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Account recovery
      </p>
      <h1 className="mt-2 text-4xl font-semibold">Set a new password</h1>
      <div className="bg-panel mt-8 rounded-[2rem] border border-white/10 p-6">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
