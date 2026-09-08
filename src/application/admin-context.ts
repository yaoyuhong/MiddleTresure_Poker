import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getAdminRequestContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, club_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("status", "active")
    .maybeSingle();

  return membership ? { supabase, user, membership } : null;
}
