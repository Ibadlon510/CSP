"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface TechnicalInfo {
  api_version: string;
  service: string;
  environment: string;
  debug: boolean;
  database_status: string;
  jwt_expire_minutes: number;
}

export default function TechnicalSettingsPage() {
  const [data, setData] = useState<TechnicalInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/settings/technical")
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

  const items = [
    { label: "API Version", value: data.api_version },
    { label: "Service", value: data.service },
    { label: "Environment", value: data.environment },
    { label: "Debug Mode", value: data.debug ? "Enabled" : "Disabled" },
    { label: "Database", value: data.database_status },
    { label: "JWT Expiry", value: `${data.jwt_expire_minutes} minutes` },
  ];

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Technical Information</h3>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 20 }}>
        Read-only system and environment details. Contact your administrator for configuration changes.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              background: "var(--bg-tertiary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>{item.label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
