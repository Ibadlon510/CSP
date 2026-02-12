"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber } from "@/lib/format";

export default function TopUpPage() {
  const router = useRouter();
  const params = useParams();
  const walletId = params?.id as string;

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Wallet top-up");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post(`/api/wallets/${walletId}/top-up`, {
        amount: parseFloat(amount),
        description,
        reference_id: reference || undefined,
      });

      toast.success("Wallet topped up successfully");
      setSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/wallets/${walletId}`);
      }, 1500);
    } catch (err: any) {
      const msg = err.message || "Failed to top-up wallet";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <a 
            href={`/dashboard/wallets/${walletId}`} 
            style={{ 
              fontSize: 14, 
              color: "var(--text-tertiary)", 
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
              fontWeight: 500,
              transition: "color var(--transition-fast)"
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-tertiary)"}
          >
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
            Back to Wallet
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: "var(--radius-lg)", 
              background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white"
            }}>
              <Icon path="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" size={24} />
            </div>
            <div>
              <h1 className="page-title" style={{ marginBottom: 4 }}>Top-up Wallet</h1>
              <p className="page-subtitle">Add funds to client trust wallet</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600 }}>
        {success && (
          <div className="alert alert-success" style={{ marginBottom: 24 }}>
            <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={20} />
            <div>
              <strong>Top-up successful!</strong>
              <p style={{ fontSize: 14, marginTop: 4 }}>Wallet has been topped up successfully. Redirecting...</p>
            </div>
          </div>
        )}

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 24 }}>
              <label>Amount (AED) *</label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  style={{ paddingLeft: 40, fontSize: 16, fontWeight: 600 }}
                />
                <span style={{ 
                  position: "absolute", 
                  left: 16, 
                  top: "50%", 
                  transform: "translateY(-50%)",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-tertiary)"
                }}>
                  AED
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>
                Enter the amount to add to the wallet
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label>Description *</label>
              <input
                type="text"
                placeholder="e.g., Initial deposit, Monthly top-up"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>
                Brief description of this transaction
              </p>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label>Reference ID <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(Optional)</span></label>
              <input
                type="text"
                placeholder="e.g., Receipt #12345, Bank transfer ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>
                External reference for tracking this transaction
              </p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={18} />
                {error}
              </div>
            )}

            {/* Preview */}
            {amount && parseFloat(amount) > 0 && (
              <div style={{ 
                padding: 20, 
                background: "var(--bg-tertiary)", 
                borderRadius: "var(--radius-lg)",
                marginBottom: 24,
                border: "1px solid var(--border-primary)"
              }}>
                <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 8, fontWeight: 500 }}>
                  Transaction Preview
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>
                  +{fmtNumber(parseFloat(amount))} AED
                </div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  {description}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => router.back()}
                disabled={loading}
                style={{ flex: "0 0 auto" }}
              >
                <Icon path="M15 18l-6-6 6-6" size={16} />
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={loading || success} 
                style={{ flex: 1 }}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner" style={{ width: 16, height: 16 }}></div>
                    Processing...
                  </>
                ) : success ? (
                  <>
                    <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={16} />
                    Success!
                  </>
                ) : (
                  <>
                    <Icon path="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" size={16} />
                    Top-up {amount ? fmtNumber(parseFloat(amount)) : "0.00"} AED
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="card" style={{ marginTop: 24, background: "var(--bg-tertiary)" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Icon path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" size={20} />
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                Secure Transaction
              </h4>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                All wallet transactions are recorded and tracked. The client will be able to see this top-up in their transaction history.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
