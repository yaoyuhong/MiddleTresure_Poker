import Link from "next/link";

interface MobileNavProps {
  readonly isAdmin: boolean;
}

const memberLinks = [
  { href: "/club", label: "Live", icon: "♠" },
  { href: "/ranking", label: "Ranking", icon: "↗" },
  { href: "/history", label: "History", icon: "◷" },
];

export function MobileNav({ isAdmin }: MobileNavProps) {
  const links = isAdmin
    ? [...memberLinks, { href: "/admin", label: "Manage", icon: "＋" }]
    : memberLinks;

  return (
    <nav
      aria-label="Club navigation"
      className="bg-ink/95 fixed inset-x-0 bottom-0 z-20 border-t border-white/10 px-[max(1rem,env(safe-area-inset-left))] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 lg:flex lg:max-w-none lg:justify-end">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              className="text-sand/45 hover:text-mint flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-[0.68rem] font-semibold hover:bg-white/5 lg:min-h-10 lg:flex-row lg:gap-2 lg:text-sm"
              href={link.href}
            >
              <span aria-hidden="true" className="text-base">
                {link.icon}
              </span>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
