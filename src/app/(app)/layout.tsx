import Link from "next/link";

import { MobileNav } from "@/components/navigation/mobile-nav";
import { getClubContext } from "@/data/club";

export default async function ClubAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getClubContext();

  if (!context.club || !context.role) {
    return (
      <main className="bg-ink text-sand grid min-h-dvh place-items-center px-5">
        <section className="bg-panel w-full max-w-md rounded-[2rem] border border-white/10 p-7 text-center">
          <span className="text-mint text-3xl" aria-hidden="true">
            ♠
          </span>
          <h1 className="mt-4 text-2xl font-semibold">Invitation pending</h1>
          <p className="text-sand/50 mt-3 text-sm leading-6">
            Your account is signed in but does not have an active club
            membership. Ask the club administrator to confirm your invitation.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-semibold"
            href="/"
          >
            Return home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <div className="bg-ink text-sand min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Link className="flex items-center gap-3" href="/club">
          <span
            aria-hidden="true"
            className="bg-mint/10 text-mint grid size-9 place-items-center rounded-full"
          >
            ♠
          </span>
          <span>
            <span className="text-sand/35 block text-xs tracking-[0.15em] uppercase">
              Private club
            </span>
            <span className="font-semibold">{context.club.name}</span>
          </span>
        </Link>
        <div className="hidden lg:block">
          <MobileNav isAdmin={context.role === "admin"} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-5 pt-4 pb-28 lg:pb-10">
        {children}
      </div>
      <div className="lg:hidden">
        <MobileNav isAdmin={context.role === "admin"} />
      </div>
    </div>
  );
}
