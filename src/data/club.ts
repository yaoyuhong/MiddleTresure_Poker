import { cache } from "react";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ClubContext {
  readonly userId: string;
  readonly membershipId: string | null;
  readonly role: "admin" | "member" | null;
  readonly club: {
    readonly id: string;
    readonly name: string;
    readonly unitName: string;
  } | null;
}

export const getClubContext = cache(async (): Promise<ClubContext> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, club_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    throw new Error("Could not load club membership.");
  }

  if (!membership) {
    return {
      userId: user.id,
      membershipId: null,
      role: null,
      club: null,
    };
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, unit_name")
    .eq("id", membership.club_id)
    .single();

  if (clubError) {
    throw new Error("Could not load club.");
  }

  return {
    userId: user.id,
    membershipId: membership.id,
    role: membership.role as "admin" | "member",
    club: {
      id: club.id,
      name: club.name,
      unitName: club.unit_name,
    },
  };
});
