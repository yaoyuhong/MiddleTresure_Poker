import Link from "next/link";
import { notFound } from "next/navigation";

import { getClubContext } from "@/data/club";

const actions = [
  {
    href: "/admin/games/new",
    title: "Create game",
    body: "Open a table and record the first buy-ins.",
  },
  {
    href: "/admin/members",
    title: "Invite members",
    body: "Manage invite-only access and club roles.",
  },
  {
    href: "/admin/seasons",
    title: "Manage season",
    body: "Open or close the cumulative-profit season.",
  },
];

export default async function AdminPage() {
  const context = await getClubContext();

  if (context.role !== "admin") {
    notFound();
  }

  return (
    <main>
      <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
        Administrator
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
        Club control
      </h1>
      <p className="text-sand/45 mt-3 max-w-xl text-sm leading-6">
        Financial changes are administrator-only and recorded in the audit
        history.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {actions.map((action) => (
          <Link
            className="bg-panel hover:border-mint/30 rounded-3xl border border-white/10 p-5"
            href={action.href}
            key={action.href}
          >
            <h2 className="font-semibold">{action.title}</h2>
            <p className="text-sand/45 mt-2 text-sm leading-6">{action.body}</p>
            <span className="text-mint mt-5 inline-block text-sm font-semibold">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
