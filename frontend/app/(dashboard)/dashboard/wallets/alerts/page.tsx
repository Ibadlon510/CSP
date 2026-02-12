"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { fmtNumber, fmtDateTime } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";

type Alert = {
  id: string;
  wallet_id: string;
  level: string;
  title: string;
  message: string;
  is_resolved: boolean;
  balance_at_alert?: number;
  threshold_at_alert?: number;
  created_at: string;
  resolved_at?: string;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    setLoading(true);
    try {
      const data = await api.get("/api/wallets/alerts/critical");
      setAlerts(data as Alert[]);
    } catch (err) {
      console.error("Failed to load alerts", err);
    } finally {
      setLoading(false);
    }
  }

  async function resolveAlert(alertId: string) {
    if (!confirm("Are you sure you want to resolve this alert?")) return;

    try {
      await api.post(`/api/wallets/alerts/${alertId}/resolve`, {});
      toast.success("Alert resolved successfully");
      loadAlerts();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve alert");
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Loading alerts...</h1>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={24} color="var(--danger)" /> Critical Wallet Alerts</h1>
            <p className="page-subtitle">Red Alert: Wallets below minimum threshold</p>
          </div>
          <a href="/dashboard/wallets" className="btn-secondary">
            ← Back to Wallets
          </a>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontSize: 64, marginBottom: 16 }}>✅</p>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>All Clear!</h3>
          <p style={{ color: "var(--text-light)", fontSize: 15 }}>
            No critical alerts at this time. All wallets are above their minimum thresholds.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="card"
              style={{
                background: "var(--danger-light)",
                border: "2px solid var(--danger)",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flexShrink: 0 }}><Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={48} color="var(--danger)" /></div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--danger)",
                      marginBottom: 8,
                    }}
                  >
                    {alert.title}
                  </h3>
                  <p style={{ fontSize: 15, color: "var(--text)", marginBottom: 12 }}>
                    {alert.message}
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 16,
                      marginBottom: 16,
                      padding: 16,
                      background: "var(--card)",
                      borderRadius: 8,
                    }}
                  >
                    {alert.balance_at_alert !== undefined && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                          Balance at Alert
                        </p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--danger)" }}>
                          {fmtNumber(alert.balance_at_alert)} AED
                        </p>
                      </div>
                    )}
                    {alert.threshold_at_alert !== undefined && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                          Minimum Threshold
                        </p>
                        <p style={{ fontSize: 16, fontWeight: 700 }}>
                          {fmtNumber(alert.threshold_at_alert)} AED
                        </p>
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                        Created
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>
                        {fmtDateTime(alert.created_at)}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <a
                      href={`/dashboard/wallets/${alert.wallet_id}`}
                      className="btn-primary btn-sm"
                    >
                      View Wallet
                    </a>
                    <a
                      href={`/dashboard/wallets/${alert.wallet_id}/top-up`}
                      className="btn-secondary btn-sm"
                    >
                      <Icon path="M1 4h22v16H1z M1 10h22" size={14} /> Top-up Now
                    </a>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Mark as Resolved
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
