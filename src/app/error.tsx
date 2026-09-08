"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="text-sand grid min-h-[70dvh] place-items-center px-5">
      <section className="max-w-md text-center">
        <p className="text-mint text-sm font-semibold tracking-[0.2em] uppercase">
          Sync interrupted
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          We could not load this view
        </h1>
        <p className="text-sand/45 mt-3 text-sm leading-6">
          No financial change is considered saved until the app confirms it.
          Check your connection and try again.
        </p>
        <button
          className="bg-mint text-ink mt-6 min-h-12 rounded-full px-6 font-bold"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
