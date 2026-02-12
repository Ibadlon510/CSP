"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { fmtDate } from "@/lib/format";

type ChecklistItem = {
  id: string;
  requirement_name: string;
  document_category?: string;
  document_id?: string;
  is_verified: boolean;
  sort_order: number;
  document_file_name?: string;
  document_file_path?: string;
};

type Doc = {
  id: string;
  file_name: string;
  file_path: string;
  category: string;
  purpose?: string;
  created_at: string;
};

export default function DocumentsTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [deliverables, setDeliverables] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [cl, docs] = await Promise.all([
        api.get(`/api/projects/${projectId}/document-checklist`) as Promise<ChecklistItem[]>,
        api.get(`/api/projects/${projectId}/documents?purpose=deliverable`) as Promise<Doc[]>,
      ]);
      setChecklist(cl);
      setDeliverables(docs);
    } catch {
      // Deliverables endpoint may not exist yet; fallback
      try {
        const cl = await api.get(`/api/projects/${projectId}/document-checklist`) as ChecklistItem[];
        setChecklist(cl);
      } catch {}
    }
    setLoading(false);
  }

  async function addChecklistItem() {
    if (!newItem.trim()) return;
    try {
      await api.post(`/api/projects/${projectId}/document-checklist`, {
        requirement_name: newItem.trim(),
        sort_order: checklist.length,
      });
      setNewItem("");
      setShowAddItem(false);
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function toggleVerified(item: ChecklistItem) {
    try {
      await api.patch(`/api/projects/${projectId}/document-checklist/${item.id}`, {
        is_verified: !item.is_verified,
      });
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function deleteChecklistItem(id: string) {
    try {
      await api.delete(`/api/projects/${projectId}/document-checklist/${id}`);
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><div className="loading-spinner" style={{ width: 24, height: 24, margin: "0 auto" }} /></div>;

  return (
    <div>
      {/* Required Documents */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 0 }}>Required Documents</h4>
          <button onClick={() => setShowAddItem(true)} style={{
            background: "var(--brand-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
            padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16m8-8H4" /></svg> Add Item</button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>Status</th>
                <th>Document Name</th>
                <th>Attachment</th>
                <th style={{ width: 80 }}>Verified</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {checklist.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 24 }}>No required documents configured</td></tr>
              ) : checklist.map((item) => (
                <tr key={item.id}>
                  <td style={{ textAlign: "center" }}>
                    {item.document_id && item.is_verified ? (
                      <span style={{ color: "var(--success)", fontSize: 16 }}>✓</span>
                    ) : item.document_id ? (
                      <span style={{ color: "var(--warning)", fontSize: 16 }}>⏳</span>
                    ) : (
                      <span style={{ color: "var(--text-quaternary)", fontSize: 16 }}>○</span>
                    )}
                  </td>
                  <td style={{ fontSize: 14, fontWeight: 500 }}>{item.requirement_name}</td>
                  <td style={{ fontSize: 13 }}>
                    {item.document_file_name ? (
                      <span style={{ color: "var(--accent-blue)" }}>{item.document_file_name}</span>
                    ) : (
                      <span style={{ color: "var(--text-quaternary)" }}>Not uploaded</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={item.is_verified}
                      onChange={() => toggleVerified(item)}
                      disabled={!item.document_id}
                    />
                  </td>
                  <td>
                    <button className="btn-ghost btn-sm" onClick={() => deleteChecklistItem(item.id)} style={{ color: "var(--danger)", padding: "2px 6px" }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deliverables */}
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Deliverables</h4>
        {deliverables.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 32, background: "var(--bg-tertiary)", borderRadius: 8 }}>
            No deliverables uploaded yet
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>File Name</th><th>Category</th><th>Uploaded</th></tr></thead>
              <tbody>
                {deliverables.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontSize: 14 }}>{d.file_name}</td>
                    <td style={{ fontSize: 13 }}>{d.category}</td>
                    <td style={{ fontSize: 13 }}>{fmtDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ═══════ Add Checklist Item Panel ═══════ */}
      {showAddItem && (
        <>
          <div onClick={() => setShowAddItem(false)}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: "var(--z-modal-backdrop)" as any, transition: "opacity var(--transition-base)" }} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 540,
            background: "var(--bg-secondary)", boxShadow: "var(--shadow-xl)",
            zIndex: "var(--z-modal)" as any, overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 28px", borderBottom: "1px solid var(--border-primary)",
              position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1,
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add Checklist Item</h3>
                <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2 }}>Add a required document to the checklist</p>
              </div>
              <button onClick={() => setShowAddItem(false)} style={{
                background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)",
                padding: 6, cursor: "pointer", color: "var(--text-tertiary)", transition: "all var(--transition-fast)",
              }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px 28px" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Document Name *</label>
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                placeholder="Enter required document name"
                autoFocus
                style={{ margin: 0 }}
              />
            </div>
            <div style={{
              padding: "16px 28px", borderTop: "1px solid var(--border-primary)",
              display: "flex", gap: 12, background: "var(--bg-secondary)",
              position: "sticky", bottom: 0,
            }}>
              <button onClick={addChecklistItem} disabled={!newItem.trim()} style={{
                flex: 1, background: newItem.trim() ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: newItem.trim() ? "#fff" : "var(--text-quaternary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600,
                cursor: newItem.trim() ? "pointer" : "default", transition: "all var(--transition-fast)",
              }}>Add Item</button>
              <button onClick={() => setShowAddItem(false)} style={{
                background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
