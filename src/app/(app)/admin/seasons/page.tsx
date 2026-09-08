import { notFound } from "next/navigation";

import {
  SeasonAdmin,
  type SeasonAdminRow,
} from "@/components/seasons/season-admin";
import { getClubContext } from "@/data/club";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SeasonsPage() {
  const context = await getClubContext();
  if (context.role !== "admin" || !context.club) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, status")
    .eq("club_id", context.club.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Could not load seasons.");
  }

  return (
    <main>
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Administrator
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        Seasons
      </h1>
      <p className="text-sand/45 mt-3 text-sm leading-6">
        One season can be open at a time. Every game must be finalized before
        that season closes.
      </p>
      <div className="mt-8">
        <SeasonAdmin seasons={(data ?? []) as ReadonlyArray<SeasonAdminRow>} />
      </div>
    </main>
  );
}
