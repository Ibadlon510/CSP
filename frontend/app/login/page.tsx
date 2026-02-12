"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/auth";
import { useToast } from "@/components/Toast";

const DEMO_EMAIL = "demo@csp.local";
const DEMO_PASSWORD = "demo123";

// Icon component
const Icon = ({ path, size = 20 }: { path: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = "/dashboard";
    } catch (err: any) {
      const msg = err.message || "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickLogin() {
    setError("");
    setLoading(true);
    try {
      try {
        await login(DEMO_EMAIL, DEMO_PASSWORD);
      } catch {
        await register(DEMO_EMAIL, DEMO_PASSWORD, "Demo User", "Demo CSP");
      }
      window.location.href = "/dashboard";
    } catch (err: any) {
      const msg = err.message || "Quick login failed";
      setError(msg);
      toast.error(msg);
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
        position: "relative",
        padding: "40px 20px"
      }}
    >
      {/* Background Pattern */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `radial-gradient(circle at 1px 1px, var(--border-primary) 1px, transparent 0)`,
        backgroundSize: "40px 40px",
        opacity: 0.4,
        pointerEvents: "none"
      }} />

      {/* Gradient Orbs */}
      <div style={{
        position: "fixed",
        top: "-20%",
        right: "-10%",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(0, 102, 255, 0.08) 0%, transparent 70%)",
        borderRadius: "50%",
        filter: "blur(60px)",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "fixed",
        bottom: "-20%",
        left: "-10%",
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)",
        borderRadius: "50%",
        filter: "blur(60px)",
        pointerEvents: "none"
      }} />

      {/* Login Card */}
      <div className="card" style={{ 
        width: 440, 
        maxWidth: "100%",
        position: "relative",
        zIndex: 1,
        boxShadow: "var(--shadow-xl)",
        padding: 40
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 56,
            height: 56,
            background: "var(--brand-primary)",
            borderRadius: "var(--radius-xl)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            fontSize: 28,
            fontWeight: 800,
            color: "white",
            boxShadow: "var(--shadow-md)"
          }}>
            C
          </div>
          <h1 style={{ 
            marginBottom: 8, 
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--text-primary)"
          }}>
            Welcome back
          </h1>
          <p style={{ 
            color: "var(--text-tertiary)", 
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "-0.011em"
          }}>
            Sign in to your CSP ERP account
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 20 }}>
              <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={18} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", fontSize: 15 }}
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Signing in...
              </>
            ) : (
              <>
                <Icon path="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3" size={18} />
                Sign in
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={{ 
          margin: "28px 0",
          display: "flex",
          alignItems: "center",
          gap: 16
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--border-primary)" }} />
          <span style={{ fontSize: 13, color: "var(--text-quaternary)", fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border-primary)" }} />
        </div>

        {/* Quick Demo Login */}
        <button
          type="button"
          onClick={handleQuickLogin}
          disabled={loading}
          className="btn-secondary"
          style={{
            width: "100%",
          }}
        >
          {loading ? (
            <>
              <div className="loading-spinner"></div>
              Loading...
            </>
          ) : (
            <>
              <Icon path="M13 2L3 14h9l-1 8 10-12h-9l1-8z" size={18} />
              Quick Demo Login
            </>
          )}
        </button>

        {/* Register Link */}
        <p style={{ 
          marginTop: 32, 
          fontSize: 14, 
          textAlign: "center", 
          color: "var(--text-tertiary)",
          fontWeight: 500
        }}>
          Don't have an account?{" "}
          <a href="/register" style={{ 
            color: "var(--text-primary)", 
            fontWeight: 600,
            textDecoration: "none",
            transition: "color var(--transition-fast)"
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-blue)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          >
            Register your CSP
          </a>
        </p>

        {/* Footer */}
        <div style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid var(--border-primary)",
          textAlign: "center"
        }}>
          <p style={{
            fontSize: 12,
            color: "var(--text-quaternary)",
            lineHeight: 1.6
          }}>
            Built for Corporate Service Providers in UAE<br/>
            Secure • Compliant • Modern
          </p>
        </div>
      </div>
    </div>
  );
}
