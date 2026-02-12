"use client";

import { useState } from "react";
import { forgotPassword } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const msg = await forgotPassword(email);
      setMessage(msg);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
        padding: "40px 20px",
      }}
    >
      <div className="card" style={{ width: 440, maxWidth: "100%", padding: 40, position: "relative", zIndex: 1, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: "var(--brand-primary)", borderRadius: "var(--radius-xl)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 24, fontSize: 28, fontWeight: 800, color: "white",
          }}>
            C
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text-primary)", marginBottom: 8 }}>
            Reset your password
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 15, fontWeight: 500 }}>
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {sent ? (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={18} />
              <span style={{ fontSize: 14 }}>{message}</span>
            </div>
            <a href="/login" className="btn-primary" style={{ width: "100%", textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
              Back to login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon path="M12 9v2m0 4h.01 M10.29 3.86l-8.58 14.86A2 2 0 0 0 3.46 21h17.08a2 2 0 0 0 1.75-2.98L13.71 3.86a2 2 0 0 0-3.42 0z" size={18} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", fontSize: 15 }}>
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Icon path="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" size={18} />
                  Send reset link
                </>
              )}
            </button>

            <p style={{ marginTop: 24, fontSize: 14, textAlign: "center", color: "var(--text-tertiary)", fontWeight: 500 }}>
              Remember your password?{" "}
              <a href="/login" style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "none" }}>
                Sign in
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
