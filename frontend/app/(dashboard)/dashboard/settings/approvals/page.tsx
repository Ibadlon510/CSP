"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

type ApprovalSetting = {
  id: string;
  approval_type: string;
  is_enabled: boolean;
  fallback_approver_id?: string;
  fallback_approver_name?: string;
};

type UserOption = { id: string; full_name: string };

const TYPE_LABELS: Record<string, string> = {
  non_billable_product: "Non-Billable Product Approval",
};

export default function ApprovalSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<ApprovalSetting[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        api.get("/api/approvals/settings") as Promise<ApprovalSetting[]>,
        api.get("/api/users/") as Promise<UserOption[]>,
      ]);
      setSettings(s);
      setUsers(u);
    } catch {
      toast.error("Failed to load approval settings");
    }
    setLoading(false);
  }

  async function toggleEnabled(setting: ApprovalSetting) {
    try {
      const res = await api.patch(`/api/approvals/settings/${setting.id}`, {
        is_enabled: !setting.is_enabled,
      }) as ApprovalSetting;
      setSettings((prev) => prev.map((s) => (s.id === res.id ? res : s)));
      toast.success(`${setting.is_enabled ? "Disabled" : "Enabled"} ${TYPE_LABELS[setting.approval_type] || setting.approval_type}`);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  }

  async function updateFallback(settingId: string, userId: string) {
    try {
      const res = await api.patch(`/api/approvals/settings/${settingId}`, {
        fallback_approver_id: userId || "",
      }) as ApprovalSetting;
      setSettings((prev) => prev.map((s) => (s.id === res.id ? res : s)));
      toast.success("Fallback approver updated");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Approval Process</h2>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 24 }}>
        Configure which actions require manager approval and set fallback approvers.
      </p>

      {settings.length === 0 ? (
        <div style={{ padding: 32, background: "var(--bg-tertiary)", borderRadius: 8, textAlign: "center", color: "var(--text-tertiary)" }}>
          No approval types configured.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {settings.map((s) => (
            <div key={s.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 600 }}>{TYPE_LABELS[s.approval_type] || s.approval_type}</h4>
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {s.approval_type === "non_billable_product"
                      ? "Requires manager approval when a user adds a non-billable product to a project."
                      : ""}
                  </p>
                </div>
                <button
                  className={s.is_enabled ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
                  onClick={() => toggleEnabled(s)}
                  style={{ minWidth: 80 }}
                >
                  {s.is_enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: 13, marginBottom: 0, whiteSpace: "nowrap" }}>Fallback Approver</label>
                <select
                  value={s.fallback_approver_id || ""}
                  onChange={(e) => updateFallback(s.id, e.target.value)}
                  style={{ maxWidth: 300, margin: 0 }}
                >
                  <option value="">None (user&apos;s manager only)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
                {s.fallback_approver_name && (
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    Current: {s.fallback_approver_name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
