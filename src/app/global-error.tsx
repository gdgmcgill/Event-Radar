"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            padding: "4rem",
            textAlign: "center",
            fontFamily: "system-ui",
            backgroundColor: "var(--bg, #fff)",
            color: "var(--fg, #111)",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
                :root { --bg: #fff; --fg: #111; --muted: #666; }
                @media (prefers-color-scheme: dark) {
                  :root { --bg: #09090b; --fg: #fafafa; --muted: #a1a1aa; }
                }
              `,
            }}
          />
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Something went wrong</h1>
          <p style={{ color: "var(--muted, #666)", marginBottom: "2rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: "#ED1B2F",
              color: "white",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
