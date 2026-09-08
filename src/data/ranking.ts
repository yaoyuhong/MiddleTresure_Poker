import { cache } from "react";

import type { RankingTableRow } from "@/components/ranking/ranking-table";
import { signedAmount } from "@/domain/money";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface RankingRow {
  readonly membership_id: string;
  readonly display_name: string;
  readonly profit: number;
  readonly rank: number;
}

export const getSeasonRanking = cache(
  async (
    clubId: string,
  ): Promise<{
    seasonName: string | null;
    rows: ReadonlyArray<RankingTableRow>;
  }> => {
    const supabase = await createServerSupabaseClient();
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id, name")
      .eq("club_id", clubId)
      .eq("status", "open")
      .maybeSingle();

    if (seasonError) {
      throw new Error("Could not load the open season.");
    }
    if (!season) {
      return { seasonName: null, rows: [] };
    }

    const { data, error } = await supabase
      .from("season_rankings")
      .select("membership_id, display_name, profit, rank")
      .eq("season_id", season.id)
      .order("rank")
      .order("display_name")
      .order("membership_id");

    if (error) {
      throw new Error("Could not load season ranking.");
    }

    return {
      seasonName: season.name,
      rows: ((data ?? []) as ReadonlyArray<RankingRow>).map((row) => ({
        membershipId: row.membership_id,
        displayName: row.display_name,
        profit: signedAmount(row.profit),
        rank: row.rank,
      })),
    };
  },
);
