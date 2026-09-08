import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ClubHomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="bg-ink text-sand min-h-dvh px-5 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
          Club home
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          Ready for the next game
        </h1>
        <div className="bg-panel mt-8 rounded-[2rem] border border-white/10 p-6">
          <p className="text-sand/50 text-sm">No active game</p>
          <p className="mt-2 text-xl font-semibold">
            Your live table will appear here.
          </p>
        </div>
      </div>
    </main>
  );
}
