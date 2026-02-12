"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber, fmtDateTime } from "@/lib/format";

type Wallet = {
  id: string;
  contact_id: string;
  contact_name?: string;
  balance: number;
  currency: string;
  minimum_balance: number;
  status: string;
  is_locked: boolean;
  notes?: string;
  is_below_threshold?: boolean;
  has_active_alerts?: boolean;
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  balance_before: number;
  balance_after: number;
  status: string;
  description: string;
  reference_id?: string;
  created_at: string;
};

type Alert = {
  id: string;
  level: string;
  title: string;
  message: string;
  is_resolved: boolean;
  balance_at_alert?: number;
  threshold_at_alert?: number;
  created_at: string;
};

export default function WalletDetailPage() {
  const params = useParams();
  const walletId = params?.id as string;

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editMinBalance, setEditMinBalance] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Record fee (fee charge)
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeDesc, setFeeDesc] = useState("");
  const [feeApplyVat, setFeeApplyVat] = useState(false);
  const [feeProjectId, setFeeProjectId] = useState("");
  const [feeTaskId, setFeeTaskId] = useState("");
  const [feeOverride, setFeeOverride] = useState(false);
  const [feeSubmitting, setFeeSubmitting] = useState(false);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, [walletId]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [walletData, txData, alertData] = await Promise.all([
        api.get(`/api/wallets/${walletId}`),
        api.get(`/api/wallets/${walletId}/transactions`),
        api.get(`/api/wallets/${walletId}/alerts`),
      ]);
      setWallet(walletData as Wallet);
      setTransactions(txData as Transaction[]);
      setAlerts(alertData as Alert[]);

      setEditMinBalance((walletData as Wallet).minimum_balance.toString());
      setEditNotes((walletData as Wallet).notes || "");
    } catch (err: any) {
      setError(err.message || "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!wallet) return;
    try {
      await api.patch(`/api/wallets/${walletId}`, {
        minimum_balance: parseFloat(editMinBalance),
        notes: editNotes,
      });
      setIsEditing(false);
      loadData();
      toast.success("Wallet updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update wallet");
    }
  }

  async function loadProjects() {
    try {
      const list = await api.get("/api/projects/") as { id: string; title: string }[];
      setProjects(list);
    } catch {
      setProjects([]);
    }
  }

  async function handleRecordFee(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return;
    setFeeSubmitting(true);
    try {
      await api.post(`/api/wallets/${walletId}/fee-charge`, {
        amount: parseFloat(feeAmount),
        description: feeDesc,
        apply_vat: feeApplyVat,
        project_id: feeProjectId || undefined,
        task_id: feeTaskId || undefined,
        red_alert_override: feeOverride,
      });
      setShowFeeForm(false);
      setFeeAmount("");
      setFeeDesc("");
      setFeeApplyVat(false);
      setFeeProjectId("");
      setFeeTaskId("");
      setFeeOverride(false);
      loadData();
      toast.success("Fee recorded");
    } catch (err: any) {
      toast.error(err.message || "Failed to record fee");
    } finally {
      setFeeSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Wallet Details</h1>
            <p className="page-subtitle">Loading wallet information...</p>
          </div>
        </div>
        <div className="flex items-center justify-center" style={{ padding: 80 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Error</h1>
            <p className="page-subtitle">{error || "Wallet not found"}</p>
          </div>
        </div>
        <div className="empty-state" style={{ minHeight: 400 }}>
          <div className="empty-state-icon">
            <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={48} />
          </div>
          <div className="empty-state-title">{error || "Wallet not found"}</div>
          <div className="empty-state-description">
            This wallet may not exist or you don't have permission to view it
          </div>
          <a href="/dashboard/wallets" className="btn-primary" style={{ textDecoration: "none" }}>
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={18} />
            Back to Wallets
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <a href="/dashboard/wallets" style={{ 
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
            Back to Wallets
          </a>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: "var(--radius-lg)", 
                  background: wallet.is_below_threshold ? "linear-gradient(135deg, var(--danger) 0%, var(--warning) 100%)" : "linear-gradient(135deg, var(--success) 0%, var(--accent) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white"
                }}>
                  <Icon path="M21 12V7H5a2 2 0 0 1 0-4h14v4" size={24} />
                </div>
                <div>
                  <h1 className="page-title" style={{ marginBottom: 4 }}>{wallet.contact_name}</h1>
                  <p className="page-subtitle">Client trust wallet</p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => { setShowFeeForm(!showFeeForm); if (!showFeeForm) loadProjects(); }}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Icon path="M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" size={16} />
                Record Fee
              </button>
              <a href={`/dashboard/wallets/${walletId}/top-up`} className="btn-primary">
                <Icon path="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" size={16} />
                Top-up
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {wallet.is_below_threshold && (
        <div className="alert alert-danger" style={{ marginBottom: 24, border: "2px solid var(--danger)" }}>
          <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={24} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--danger)", marginBottom: 6 }}>
                Red Alert: Low Balance
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
                Current balance ({fmtNumber(wallet.balance)} {wallet.currency}) is below minimum threshold (
                {fmtNumber(wallet.minimum_balance)} {wallet.currency}). Immediate top-up required.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Info Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            Wallet Details
          </h3>
          {!isEditing ? (
            <button className="btn-secondary btn-sm" onClick={() => setIsEditing(true)}>
              <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />
              Edit
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="btn-primary btn-sm" onClick={handleSaveEdit}>
                <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={14} />
                Save
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 24 }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
              <Icon path="M21 12V7H5a2 2 0 0 1 0-4h14v4" size={14} />
              Current Balance
            </label>
            <p
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: wallet.is_below_threshold ? "var(--danger)" : "var(--success)",
              }}
            >
              {fmtNumber(wallet.balance)} {wallet.currency}
            </p>
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
              <Icon path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" size={14} />
              Minimum Balance
            </label>
            {isEditing ? (
              <input
                type="number"
                step="0.01"
                value={editMinBalance}
                onChange={(e) => setEditMinBalance(e.target.value)}
              />
            ) : (
              <p style={{ fontSize: 18, fontWeight: 600, marginTop: 8, color: "var(--text-primary)" }}>
                {fmtNumber(wallet.minimum_balance)} {wallet.currency}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
              <Icon path="M9 12l2 2 4-4 M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z" size={14} />
              Status
            </label>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className={`badge badge-${wallet.status === "active" ? "success" : "warning"}`}>
                {wallet.status}
              </span>
              {wallet.is_locked && (
                <span className="badge badge-danger" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon path="M5 11h14 M6 11V7a6 6 0 0 1 12 0v4" size={12} />
                  Locked
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="divider" />

        <div>
          <label style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />
            Notes
          </label>
          {isEditing ? (
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this wallet..."
            />
          ) : (
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {wallet.notes || "No notes"}
            </p>
          )}
        </div>
      </div>

      {/* Record fee form */}
      {showFeeForm && (
        <div className="card" style={{ marginBottom: 24, background: "var(--bg-subtle)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Record fee charge (debit)</h3>
          <form onSubmit={handleRecordFee}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8 }}>Amount AED *</label>
              <input type="number" step="0.01" min="0.01" required value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8 }}>Description *</label>
              <input type="text" required value={feeDesc} onChange={(e) => setFeeDesc(e.target.value)} placeholder="e.g. Government fee - DED renewal" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={feeApplyVat} onChange={(e) => setFeeApplyVat(e.target.checked)} />
                <span>Service fee (5% VAT)</span>
              </label>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Uncheck for government fee (0% VAT)</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8 }}>Link to project (optional)</label>
              <select value={feeProjectId} onChange={(e) => { setFeeProjectId(e.target.value); setFeeTaskId(""); }}>
                <option value="">-- None --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={feeOverride} onChange={(e) => setFeeOverride(e.target.checked)} />
                <span>Manager override (allow despite insufficient balance)</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowFeeForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={feeSubmitting}>{feeSubmitting ? "Recording..." : "Record fee"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>⚠️ Active Alerts</h3>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="card"
              style={{
                background: alert.level === "critical" ? "var(--danger-light)" : "var(--warning-light)",
                marginBottom: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: alert.level === "critical" ? "var(--danger)" : "var(--warning)" }}>
                    {alert.title}
                  </p>
                  <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 8 }}>{alert.message}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Created: {fmtDateTime(alert.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Icon path="M18 20V10 M12 20V4 M6 20v-6" size={20} /> Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p style={{ color: "var(--text-light)", textAlign: "center", padding: 24 }}>
            No transactions yet
          </p>
        ) : (
          <div className="table-container" style={{ border: "none", boxShadow: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {fmtDateTime(tx.created_at)}
                    </td>
                    <td>
                      <span className={`badge badge-${
                        tx.type === "top_up" ? "success" :
                        tx.type === "fee_charge" ? "warning" :
                        tx.type === "refund" ? "info" : "primary"
                      }`}>
                        {tx.type.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ fontSize: 14 }}>{tx.description}</td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: tx.amount > 0 ? "var(--success)" : "var(--danger)",
                        }}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {fmtNumber(tx.amount)} {tx.currency}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{fmtNumber(tx.balance_after)} {tx.currency}</td>
                    <td>
                      <span className={`badge badge-${tx.status === "completed" ? "success" : "warning"}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
