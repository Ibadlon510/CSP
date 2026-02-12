import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 40, fontFamily: "var(--font-primary, Inter, sans-serif)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", background: "var(--bg-tertiary, #f5f5f5)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
      }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary, #a3a3a3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
        </svg>
      </div>
      <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 8, color: "var(--text-primary, #171717)" }}>
        404
      </h1>
      <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "var(--text-primary, #171717)" }}>
        Page not found
      </p>
      <p style={{ fontSize: 15, color: "var(--text-secondary, #737373)", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        style={{
          padding: "10px 24px", fontSize: 14, fontWeight: 600, borderRadius: 8,
          background: "var(--brand-primary, #171717)", color: "#fff", textDecoration: "none",
        }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
