import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";

export function createAdminSupabaseClient() {
  const environment = getServerEnv();

  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
