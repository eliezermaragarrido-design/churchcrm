"use client";

export default function AutomationError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "#f5f0e6",
        color: "#1f3d33",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          background: "#fffdf8",
          border: "1px solid #d8c8ad",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "0 12px 40px rgba(31, 61, 51, 0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Automation Error</h1>
        <p style={{ marginTop: 0 }}>
          The automation page hit a client-side exception. This panel shows the real error so we can fix it instead of guessing.
        </p>
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            borderRadius: "12px",
            background: "#f2ebe0",
            overflowX: "auto",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {props.error?.message || "Unknown automation client error"}
          {props.error?.digest ? `\n\ndigest: ${props.error.digest}` : ""}
        </div>
        <button
          type="button"
          onClick={props.reset}
          style={{
            marginTop: "1rem",
            border: 0,
            borderRadius: "999px",
            background: "#245645",
            color: "white",
            padding: "0.75rem 1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
