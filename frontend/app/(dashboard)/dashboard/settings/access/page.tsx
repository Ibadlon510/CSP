"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  can_view_system: boolean;
  can_edit_system: boolean;
  can_view_technical: boolean;
  can_view_defaults: boolean;
  can_edit_defaults: boolean;
  can_view_access_rights: boolean;
  can_edit_access_rights: boolean;
  can_view_module_settings: boolean;
  can_edit_module_settings: boolean;
}

export default function AccessRightsPage() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/settings/roles")
      .then(setRoles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return <p className="error">{error}</p>;
  }
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  const capabilityLabels: Record<string, string> = {
    can_view_system: "View System",
    can_edit_system: "Edit System",
    can_view_technical: "View Technical",
    can_view_defaults: "View Defaults",
    can_edit_defaults: "Edit Defaults",
    can_view_access_rights: "View Access Rights",
    can_edit_access_rights: "Edit Access Rights",
    can_view_module_settings: "View Module Settings",
    can_edit_module_settings: "Edit Module Settings",
  };

  const capabilities = Object.keys(capabilityLabels);

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Role Capabilities</h3>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 20 }}>
          Each role has different access to settings. Admins can assign roles to users and delegate module-specific permissions.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Role
                </th>
                {capabilities.map((cap) => (
                  <th
                    key={cap}
                    style={{
                      padding: "12px 10px",
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {capabilityLabels[cap]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div>
                      <strong style={{ color: "var(--text-primary)" }}>{role.label}</strong>
                      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{role.description}</p>
                    </div>
                  </td>
                  {capabilities.map((cap) => (
                    <td key={cap} style={{ padding: "12px 10px", textAlign: "center" }}>
                      {(role as unknown as Record<string, boolean>)[cap] ? (
                        <span style={{ color: "var(--success)", fontWeight: 600 }}>Yes</span>
                      ) : (
                        <span style={{ color: "var(--text-quaternary)" }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Manage Users</h3>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 16 }}>
          Assign roles and delegate module settings to users from the Users page.
        </p>
        <Link href="/dashboard/users" className="btn-secondary">
          Go to Users
        </Link>
      </div>
    </div>
  );
}
