"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { fmtDateTime } from "@/lib/format";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";

interface EntitySummary {
  contact_id: string;
  name: string;
  contact_type: string;
  jurisdiction: string | null;
  status: string;
  ubo_count: number;
  ownership_sum_valid: boolean | null;
  has_cycles: boolean;
  dead_ends_count: number;
  warnings: string[];
}

interface Snapshot {
  id: string;
  entity_contact_id: string;
  register_type: string;
  file_path: string | null;
  generated_at: string;
}

export default function ComplianceDashboardPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ health: [] });
  const [groupBy, setGroupBy] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [generateEntity, setGenerateEntity] = useState("");
  const [generateType, setGenerateType] = useState<"ubo" | "partners" | "directors">("ubo");
  const [generateFormat, setGenerateFormat] = useState<"pdf" | "excel">("pdf");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api
      .get("/api/compliance/dashboard-summary")
      .then((data: { entities: EntitySummary[] }) => {
        setEntities(data.entities || []);
        if (!generateEntity && (data.entities || []).length > 0) setGenerateEntity((data.entities as EntitySummary[])[0].contact_id);
      })
      .catch(() => setEntities([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get("/api/compliance/snapshots").then((data: Snapshot[]) => setSnapshots(Array.isArray(data) ? data : [])).catch(() => setSnapshots([]));
  }, [generating]);

  function handleGenerate() {
    if (!generateEntity) return;
    setGenerating(true);
    api
      .post("/api/compliance/registers/generate", {
        entity_contact_id: generateEntity,
        register_type: generateType,
        format: generateFormat,
      })
      .then((res: { snapshot_id: string }) => {
        setSnapshots((prev) => [{ id: res.snapshot_id, entity_contact_id: generateEntity, register_type: generateType, file_path: "", generated_at: new Date().toISOString() }, ...prev]);
        downloadSnapshot(res.snapshot_id, generateType, generateFormat);
      })
      .catch(() => {})
      .finally(() => setGenerating(false));
  }

  function downloadSnapshot(snapshotId: string, regType: string, fmt: string) {
    api.getBlob(`/api/compliance/snapshots/${snapshotId}/download`).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `register_${regType}_${snapshotId.slice(0, 8)}.${fmt === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => {});
  }

  const complianceFilterConfig: FilterFieldConfig[] = [
    { key: "health", label: "Health", options: [{ value: "issues", label: "With Issues" }, { value: "healthy", label: "Healthy" }] },
  ];
  const complianceGroupOptions = [{ value: "status", label: "Status" }];

  const filteredEntities = useMemo(() => {
    let list = entities;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q) || (e.jurisdiction && e.jurisdiction.toLowerCase().includes(q)));
    }
    if (filters.health?.includes("issues")) list = list.filter((e) => !e.ownership_sum_valid || e.has_cycles || e.dead_ends_count > 0 || e.warnings.length > 0);
    if (filters.health?.includes("healthy")) list = list.filter((e) => e.ownership_sum_valid !== false && !e.has_cycles && e.dead_ends_count === 0 && e.warnings.length === 0);
    return list;
  }, [entities, search, filters]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Compliance</h1>
          <p className="page-subtitle">UBO structures, registers, and compliance health</p>
        </div>
        <div className="page-header-actions">
          <Link href="/dashboard/compliance/map" className="btn-primary">
            <Icon path="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" size={16} />
            Ownership Map
          </Link>
        </div>
      </div>

      {/* Search / Filter bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={complianceFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={complianceGroupOptions} pageKey="compliance" placeholder="Search entities..." />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text-primary)" }}>
          Entities (health overview)
        </h2>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</div>
        ) : filteredEntities.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
            {search || filters.health?.length
              ? "No matching entities. Try adjusting your filters."
              : "No companies found. Add contacts and open the Ownership Map to build structures."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Jurisdiction</th>
                  <th>Status</th>
                  <th>UBOs</th>
                  <th>Ownership 100%</th>
                  <th>Cycles</th>
                  <th>Dead ends</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntities.map((e) => (
                  <tr key={e.contact_id}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{e.name}</span>
                    </td>
                    <td>{e.jurisdiction ?? "—"}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          background: e.status === "active" ? "var(--success-light)" : "var(--bg-tertiary)",
                          color: e.status === "active" ? "var(--success)" : "var(--text-secondary)",
                        }}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td>{e.ubo_count}</td>
                    <td>
                      {e.ownership_sum_valid === null ? (
                        "—"
                      ) : e.ownership_sum_valid ? (
                        <span style={{ color: "var(--success)" }}>Yes</span>
                      ) : (
                        <span style={{ color: "var(--danger)" }}>No</span>
                      )}
                    </td>
                    <td>
                      {e.has_cycles ? (
                        <span style={{ color: "var(--danger)" }}>Yes</span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>No</span>
                      )}
                    </td>
                    <td>{e.dead_ends_count}</td>
                    <td>
                      <Link
                        href={`/dashboard/compliance/map?root=${e.contact_id}`}
                        className="btn-ghost btn-sm"
                        style={{ fontSize: 13 }}
                      >
                        View structure
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text-primary)" }}>
          Generate registers
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-tertiary)" }}>Entity</label>
            <select
              value={generateEntity}
              onChange={(e) => setGenerateEntity(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", minWidth: 200 }}
            >
              {entities.length === 0 && <option value="">Select entity</option>}
              {entities.map((e) => (
                <option key={e.contact_id} value={e.contact_id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-tertiary)" }}>Register</label>
            <select
              value={generateType}
              onChange={(e) => setGenerateType(e.target.value as "ubo" | "partners" | "directors")}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-primary)" }}
            >
              <option value="ubo">Register of UBOs</option>
              <option value="partners">Register of Partners</option>
              <option value="directors">Register of Directors</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-tertiary)" }}>Format</label>
            <select
              value={generateFormat}
              onChange={(e) => setGenerateFormat(e.target.value as "pdf" | "excel")}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-primary)" }}
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
          </div>
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={generating || !generateEntity}>
            {generating ? "Generating…" : "Generate & download"}
          </button>
        </div>
        {snapshots.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Recent exports</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {snapshots.slice(0, 10).map((s) => (
                <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{s.register_type} · {fmtDateTime(s.generated_at)}</span>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    style={{ fontSize: 12 }}
                    onClick={() => downloadSnapshot(s.id, s.register_type, s.file_path?.endsWith(".xlsx") ? "excel" : "pdf")}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
