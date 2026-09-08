import { notFound } from "next/navigation";

import {
  AccessSecurity,
  type AccessCodeStatus,
} from "@/components/admin/access-security";
import { getClubContext } from "@/data/club";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface AccessCodeStatusRow {
  readonly kind: "member" | "admin";
  readonly rotated_at: string;
}

export default async function SecurityPage() {
  const context = await getClubContext();
  if (context.role !== "admin" || !context.club) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_access_code_status");
  if (error) {
    throw new Error("Could not load access security.");
  }

  const codeStatus: ReadonlyArray<AccessCodeStatus> = (
    (data ?? []) as ReadonlyArray<AccessCodeStatusRow>
  ).map((row) => ({
    kind: row.kind,
    rotatedAt: row.rotated_at,
  }));

  return (
    <main>
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Administrator
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        Access security
      </h1>
      <p className="text-sand/45 mt-3 max-w-xl text-sm leading-6">
        Manage password access and reusable registration codes. Existing
        sessions remain signed in when a code is rotated.
      </p>
      <div className="mt-8 max-w-2xl">
        <AccessSecurity codeStatus={codeStatus} />
      </div>
    </main>
  );
}
