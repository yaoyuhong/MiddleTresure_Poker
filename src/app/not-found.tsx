import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-ink text-sand grid min-h-dvh place-items-center px-5 text-center">
      <section>
        <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
          Not found
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          This table is not available
        </h1>
        <Link
          className="mt-6 inline-flex min-h-12 items-center rounded-full border border-white/15 px-6 font-semibold"
          href="/club"
        >
          Return to club
        </Link>
      </section>
    </main>
  );
}
