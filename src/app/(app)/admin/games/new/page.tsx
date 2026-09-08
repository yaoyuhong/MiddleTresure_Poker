import Link from "next/link";
import { notFound } from "next/navigation";

import { NewGameForm } from "@/components/games/new-game-form";
import { getClubContext } from "@/data/club";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewGamePage() {
  const context = await getClubContext();
  if (context.role !== "admin" || !context.club) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: season, error } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("club_id", context.club.id)
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the open season.");
  }

  return (
    <main>
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Administrator
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        New game
      </h1>
      <p className="text-sand/45 mt-3 text-sm">
        {season ? `Season: ${season.name}` : "No season is open."}
      </p>
      <div className="mt-8">
        <NewGameForm seasonId={season?.id ?? null} />
      </div>
      {!season ? (
        <Link
          className="text-mint mt-5 inline-flex text-sm font-semibold"
          href="/admin/seasons"
        >
          Manage seasons →
        </Link>
      ) : null}
    </main>
  );
}
