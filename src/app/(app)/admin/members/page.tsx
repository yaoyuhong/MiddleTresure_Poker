import { notFound } from "next/navigation";

import { InviteMemberForm } from "@/components/members/invite-member-form";
import { getClubContext } from "@/data/club";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface MembershipRow {
  readonly id: string;
  readonly user_id: string;
  readonly role: "admin" | "member";
  readonly status: "invited" | "active" | "inactive";
}

interface ProfileRow {
  readonly id: string;
  readonly display_name: string;
}

export default async function MembersPage() {
  const context = await getClubContext();
  if (context.role !== "admin" || !context.club) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("club_id", context.club.id)
    .order("created_at");

  if (error) {
    throw new Error("Could not load members.");
  }

  const memberships = (data ?? []) as ReadonlyArray<MembershipRow>;
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      memberships.map(({ user_id }) => user_id),
    );

  if (profileError) {
    throw new Error("Could not load member profiles.");
  }

  const names = new Map(
    ((profileData ?? []) as ReadonlyArray<ProfileRow>).map((profile) => [
      profile.id,
      profile.display_name,
    ]),
  );

  return (
    <main>
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Access control
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        Members
      </h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Club members · {memberships.length}
          </h2>
          <div className="space-y-2">
            {memberships.map((membership) => (
              <div
                className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
                key={membership.id}
              >
                <span>
                  <strong className="block">
                    {names.get(membership.user_id) ?? "Invited member"}
                  </strong>
                  <span className="text-sand/35 mt-1 block text-xs">
                    {membership.role}
                  </span>
                </span>
                <span className="text-sand/55 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold capitalize">
                  {membership.status}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-panel h-fit rounded-[2rem] border border-white/10 p-5">
          <h2 className="text-xl font-semibold">Invite a member</h2>
          <p className="text-sand/45 mt-2 text-sm leading-6">
            They receive a one-time email link and become active after signing
            in.
          </p>
          <div className="mt-6">
            <InviteMemberForm />
          </div>
        </section>
      </div>
    </main>
  );
}
