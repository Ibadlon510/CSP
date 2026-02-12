"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { fmtNumber, fmtDate, fmtDateTime } from "@/lib/format";

type Project = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  contact_id?: string;
  owner_id?: string;
  estimated_govt_fee?: number;
  start_date?: string;
  due_date?: string;
  invoice_id?: string;
  sales_order_id?: string;
};

type Transaction = {
  id: string;
  date?: string;
  description?: string;
  type: string;
  amount: number;
  status?: string;
};

type FinancialsData = {
  total_debit: number;
  total_credit: number;
  net: number;
  transactions: Transaction[];
};

type AuditEntry = {
  id: string;
  timestamp: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  action: string;
  resource?: string;
  resource_id?: string;
  detail?: string;
};

export default function SettingsTab({ projectId, project }: { projectId: string; project: Project }) {
  const toast = useToast();
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [financials, setFinancials] = useState<FinancialsData | null>(null);
  const [activityLog, setActivityLog] = useState<AuditEntry[]>([]);
  const [activeSection, setActiveSection] = useState<"settings" | "financials" | "activity">("settings");

  useEffect(() => {
    setForm({
      title: project.title,
      description: project.description || "",
      status: project.status,
      priority: project.priority || "",
      estimated_govt_fee: project.estimated_govt_fee,
      start_date: project.start_date ? project.start_date.slice(0, 10) : "",
      due_date: project.due_date ? project.due_date.slice(0, 10) : "",
    });
  }, [project]);

  useEffect(() => {
    if (activeSection === "financials" && !financials) loadFinancials();
    if (activeSection === "activity" && activityLog.length === 0) loadActivity();
  }, [activeSection]);

  async function loadFinancials() {
    try {
      const res = await api.get(`/api/projects/${projectId}/financials`) as FinancialsData;
      setFinancials(res);
    } catch {}
  }

  async function loadActivity() {
    try {
      const res = await api.get(`/api/projects/${projectId}/activity-log`) as AuditEntry[];
      setActivityLog(res);
    } catch {}
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await api.patch(`/api/projects/${projectId}`, {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority || null,
        estimated_govt_fee: form.estimated_govt_fee,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
      });
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(false);
  }

  const sectionTabs = [
    { key: "settings", label: "Project Settings" },
    { key: "financials", label: "Financials" },
    { key: "activity", label: "Activity Log" },
  ] as const;

  return (
    <div>
      {/* Sub-section navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border-primary)", paddingBottom: 0 }}>
        {sectionTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveSection(t.key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: activeSection === t.key ? "var(--text-primary)" : "var(--text-tertiary)",
              background: "none",
              border: "none",
              borderBottom: activeSection === t.key ? "2px solid var(--text-primary)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Project Settings */}
      {activeSection === "settings" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label>Title</label>
              <input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label>Status</label>
              <select value={form.status || ""} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select value={form.priority || ""} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label>Est. Govt Fee</label>
              <input type="number" step="0.01" value={form.estimated_govt_fee ?? ""} onChange={(e) => setForm((p) => ({ ...p, estimated_govt_fee: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <label>Start Date</label>
              <input type="date" value={form.start_date || ""} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <label>Due Date</label>
              <input type="date" value={form.due_date || ""} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label>Description</label>
            <textarea rows={3} value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn-primary" onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Financials */}
      {activeSection === "financials" && (
        <div>
          {financials ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div className="card" style={{ background: "var(--bg-tertiary)", textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Total Credit</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "var(--success)" }}>{fmtNumber(financials.total_credit)}</p>
                </div>
                <div className="card" style={{ background: "var(--bg-tertiary)", textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Total Debit</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "var(--danger)" }}>{fmtNumber(financials.total_debit)}</p>
                </div>
                <div className="card" style={{ background: "var(--bg-tertiary)", textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Net</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: financials.net >= 0 ? "var(--success)" : "var(--danger)" }}>{fmtNumber(financials.net)}</p>
                </div>
              </div>
              {financials.transactions.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {financials.transactions.map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontSize: 13 }}>{fmtDate(t.date)}</td>
                          <td style={{ fontSize: 14 }}>{t.description || "—"}</td>
                          <td><span className="badge badge-info" style={{ fontSize: 11 }}>{t.type}</span></td>
                          <td style={{ fontSize: 14, fontWeight: 600 }}>{fmtNumber(t.amount)}</td>
                          <td style={{ fontSize: 13 }}>{t.status || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 32 }}>No transactions</div>
              )}
            </>
          ) : (
            <div style={{ padding: 40, textAlign: "center" }}><div className="loading-spinner" style={{ width: 24, height: 24, margin: "0 auto" }} /></div>
          )}
        </div>
      )}

      {/* Activity Log */}
      {activeSection === "activity" && (
        <div>
          {activityLog.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 32, background: "var(--bg-tertiary)", borderRadius: 8 }}>
              No activity recorded yet. Actions performed on this project will appear here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {activityLog.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border-secondary)",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--accent-blue-light)", color: "var(--accent-blue)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {(entry.user_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {entry.user_name || "System"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-quaternary)", whiteSpace: "nowrap" }}>
                        {entry.timestamp ? fmtDateTime(entry.timestamp) : ""}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      <span className={`badge badge-${entry.action === "create" ? "success" : entry.action === "delete" ? "danger" : entry.action === "auto_complete" ? "accent" : "info"}`} style={{ fontSize: 10, marginRight: 6 }}>
                        {entry.action}
                      </span>
                      {entry.detail || `${entry.action} on ${entry.resource}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
