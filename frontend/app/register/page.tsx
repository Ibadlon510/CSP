"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/auth";
import { useToast } from "@/components/Toast";

// Icon component
const Icon = ({ path, size = 20 }: { path: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, fullName, orgName);
      toast.success("Account created successfully");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.message || "Registration failed";
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

      {/* Register Card */}
      <div className="card" style={{ 
        width: 480, 
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
            Create Account
          </h1>
          <p style={{ 
            color: "var(--text-tertiary)", 
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "-0.011em"
          }}>
            Register your CSP to get started
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="orgName">
              Organization Name
            </label>
            <input
              id="orgName"
              placeholder="Your CSP company name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="fullName">
              Full Name
            </label>
            <input
              id="fullName"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

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
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
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
                Creating account...
              </>
            ) : (
              <>
                <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" size={18} />
                Create Account
              </>
            )}
          </button>
        </form>

        {/* Sign In Link */}
        <p style={{ 
          marginTop: 32, 
          fontSize: 14, 
          textAlign: "center", 
          color: "var(--text-tertiary)",
          fontWeight: 500
        }}>
          Already have an account?{" "}
          <a href="/login" style={{ 
            color: "var(--text-primary)", 
            fontWeight: 600,
            textDecoration: "none",
            transition: "color var(--transition-fast)"
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-blue)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          >
            Sign in
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
            By creating an account, you agree to our<br/>
            Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
