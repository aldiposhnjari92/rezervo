"use client";

/**
 * Rrjeta e fundit e sigurisë: kap edhe gabimet e root layout-it.
 * Duhet të përmbajë vetë <html> dhe <body>, sepse zëvendëson layout-in rrënjë.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="sq">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
          Diçka shkoi keq
        </h1>
        <p style={{ marginTop: "0.5rem", color: "#64748b", maxWidth: "24rem" }}>
          Na ndodhi një gabim i papritur. Provo sërish.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            background: "#2563eb",
            color: "#fff",
            border: 0,
            borderRadius: "0.5rem",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Provo sërish
        </button>
      </body>
    </html>
  );
}
