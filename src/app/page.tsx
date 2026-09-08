import Link from "next/link";

const features = [
  ["Live table", "Buy-ins, add-ons, joins, and exits stay in sync."],
  ["Zero-sum close", "Balance every game before results are locked."],
  ["Season form", "Track cumulative profit and shared rankings."],
];

export default function Home() {
  return (
    <main className="bg-ink text-sand min-h-dvh overflow-hidden">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="border-mint/30 bg-mint/10 text-mint grid size-10 place-items-center rounded-full border text-lg"
            >
              ♠
            </span>
            <span className="text-sand/80 text-sm font-semibold tracking-[0.18em]">
              PRIVATE CLUB
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className="text-sand/60 hover:text-mint px-3 py-2 text-sm font-semibold"
              href="/register"
            >
              Register
            </Link>
            <Link
              className="border-sand/20 text-sand hover:border-mint/70 hover:text-mint rounded-full border px-4 py-2 text-sm font-semibold transition"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="text-mint mb-5 text-sm font-semibold tracking-[0.24em] uppercase">
              Invite only · Live operations
            </p>
            <h1 className="max-w-3xl text-5xl leading-[0.94] font-semibold tracking-[-0.055em] text-balance sm:text-6xl lg:text-8xl">
              Middle Treasure Poker
            </h1>
            <p className="text-sand/65 mt-7 max-w-xl text-lg leading-8 text-pretty sm:text-xl">
              Private games. Clear settlement.
            </p>
            <p className="text-sand/50 mt-3 max-w-xl leading-7 text-pretty">
              One calm place for club invitations, live buy-ins, exact
              settlement, and season standings.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className="bg-mint text-ink hover:bg-mint-bright rounded-full px-6 py-3.5 font-bold transition"
                href="/register"
              >
                Register with a code
              </Link>
              <span className="text-sand/45 flex items-center px-2 text-sm">
                Access requires an invitation
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="bg-mint/5 absolute -inset-5 rounded-[2.5rem] blur-2xl" />
            <div className="bg-panel/80 relative rounded-[2rem] border border-white/10 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
              <div className="mb-7 flex items-start justify-between">
                <div>
                  <p className="text-sand/40 text-xs font-semibold tracking-[0.2em] uppercase">
                    Friday session
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    Table is balanced
                  </p>
                </div>
                <span className="bg-mint/10 text-mint rounded-full px-3 py-1.5 text-xs font-bold">
                  LIVE
                </span>
              </div>
              <div className="mb-7 grid grid-cols-2 gap-3">
                <Stat label="Buy-ins" value="8,400" />
                <Stat label="Difference" value="0" accent />
              </div>
              <div className="space-y-3">
                {features.map(([title, body], index) => (
                  <div
                    className="flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
                    key={title}
                  >
                    <span className="bg-sand/10 text-mint grid size-8 shrink-0 place-items-center rounded-full text-sm">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-sand/45 mt-1 text-sm leading-6">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="text-sand/35 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>Club records only. No payments are processed.</span>
          <span>Built for mobile, ready at the table.</span>
        </footer>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-sand/35 text-xs tracking-[0.16em] uppercase">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${accent ? "text-mint" : ""}`}>
        {value}
      </p>
    </div>
  );
}
