"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ModuleItem {
  module_id: string;
  label: string;
  enabled: boolean;
}

export default function ModulesSettingsPage() {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchModules = () => {
    api
      .get("/api/settings/modules")
      .then((d) => setModules(d.modules))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const toggleModule = async (moduleId: string, enabled: boolean) => {
    setUpdating(moduleId);
    setError("");
    try {
      await api.patch("/api/settings/modules", { module_id: moduleId, enabled });
      setModules((prev) => prev.map((m) => (m.module_id === moduleId ? { ...m, enabled } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Module Visibility</h3>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 24 }}>
        Enable or disable modules for your organization. Disabled modules are hidden from the sidebar.
      </p>
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {modules.map((m) => (
          <div
            key={m.module_id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              background: "var(--bg-tertiary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{m.label}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={m.enabled}
                onChange={(e) => toggleModule(m.module_id, e.target.checked)}
                disabled={updating === m.module_id}
              />
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {m.enabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
