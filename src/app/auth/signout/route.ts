import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
