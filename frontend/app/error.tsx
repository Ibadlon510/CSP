"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 40, fontFamily: "var(--font-primary, Inter, sans-serif)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", background: "var(--danger-light, #fef2f2)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
      }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--danger, #ef4444)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" />
        </svg>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "var(--text-primary, #171717)" }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary, #737373)", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px", fontSize: 14, fontWeight: 600, borderRadius: 8,
          background: "var(--brand-primary, #171717)", color: "#fff", border: "none", cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
