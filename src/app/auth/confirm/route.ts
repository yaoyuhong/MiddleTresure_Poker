import { NextResponse, type NextRequest } from "next/server";

import { parseAuthConfirmation } from "@/application/auth-confirmation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const confirmation = parseAuthConfirmation(requestUrl);

  if (!confirmation) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", requestUrl),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: confirmation.tokenHash,
    type: confirmation.type,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", requestUrl),
    );
  }

  return NextResponse.redirect(new URL(confirmation.nextPath, requestUrl));
}
