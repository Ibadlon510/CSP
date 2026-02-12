"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div className="loading-spinner" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) setToken(t);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!token.trim()) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const msg = await resetPassword(token, password);
      setMessage(msg);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
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
            Set new password
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 15, fontWeight: 500 }}>
            Choose a strong password for your account
          </p>
        </div>

        {success ? (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={18} />
              <span style={{ fontSize: 14 }}>{message}</span>
            </div>
            <a href="/login" className="btn-primary" style={{ width: "100%", textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon path="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3" size={16} />
              Sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!token && (
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="token">Reset Token</label>
                <input
                  id="token"
                  type="text"
                  placeholder="Paste your reset token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  style={{ fontFamily: "monospace", fontSize: 13 }}
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="password">New Password</label>
              <input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Resetting...
                </>
              ) : (
                <>
                  <Icon path="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" size={18} />
                  Reset password
                </>
              )}
            </button>

            <p style={{ marginTop: 24, fontSize: 14, textAlign: "center", color: "var(--text-tertiary)", fontWeight: 500 }}>
              <a href="/login" style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "none" }}>
                Back to login
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

