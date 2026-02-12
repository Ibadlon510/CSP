"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface SystemInfo {
  org_id: string;
  org_name: string;
  subdomain: string | null;
  is_active: boolean;
}

export default function SystemSettingsPage() {
  const [data, setData] = useState<SystemInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/settings/system")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <p className="error">{error}</p>;
  }
  if (!data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Organization Profile</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Organization Name
          </label>
          <p style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500 }}>{data.org_name}</p>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Subdomain
          </label>
          <p style={{ fontSize: 15, color: "var(--text-primary)" }}>{data.subdomain || "(not set)"}</p>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Status
          </label>
          <span
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              fontSize: 12,
              fontWeight: 600,
              background: data.is_active ? "var(--success-light)" : "var(--danger-light)",
              color: data.is_active ? "var(--success)" : "var(--danger)",
              border: `1px solid ${data.is_active ? "var(--success-border)" : "var(--danger-border)"}`,
            }}
          >
            {data.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 20 }}>
        Organization details are managed by Super Admin. Contact your administrator to update.
      </p>
    </div>
  );
}
