"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            background: "#101a17",
            color: "#f3ead7",
            display: "grid",
            minHeight: "100dvh",
            placeItems: "center",
            padding: "1.25rem",
            textAlign: "center",
          }}
        >
          <section>
            <h1>Middle Treasure is temporarily unavailable</h1>
            <p>No unconfirmed financial action has been saved.</p>
            <button onClick={reset} type="button">
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
