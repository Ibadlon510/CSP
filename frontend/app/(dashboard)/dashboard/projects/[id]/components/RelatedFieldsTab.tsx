"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

type RelatedField = {
  id: string;
  field_name: string;
  field_value?: string;
  field_type: string;
  created_at: string;
  updated_at: string;
};

export default function RelatedFieldsTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [fields, setFields] = useState<RelatedField[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState("text");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAddField, setShowAddField] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get(`/api/projects/${projectId}/related-fields`) as RelatedField[];
      setFields(res);
    } catch {}
    setLoading(false);
  }

  async function addField() {
    if (!newName.trim()) return;
    try {
      await api.post(`/api/projects/${projectId}/related-fields`, {
        field_name: newName.trim(),
        field_value: newValue,
        field_type: newType,
      });
      setNewName("");
      setNewValue("");
      setNewType("text");
      setShowAddField(false);
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function saveEdit(id: string) {
    try {
      await api.patch(`/api/projects/${projectId}/related-fields/${id}`, {
        field_value: editValue,
      });
      setEditingId(null);
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function deleteField(id: string) {
    try {
      await api.delete(`/api/projects/${projectId}/related-fields/${id}`);
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><div className="loading-spinner" style={{ width: 24, height: 24, margin: "0 auto" }} /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 0 }}>Related Fields</h4>
        <button onClick={() => setShowAddField(true)} style={{
          background: "var(--brand-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
          padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16m8-8H4" /></svg> Add Field</button>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Field Name</th>
              <th>Value</th>
              <th style={{ width: 100 }}>Type</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id}>
                <td style={{ fontWeight: 500, fontSize: 14 }}>{f.field_name}</td>
                <td>
                  {editingId === f.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(f.id)}
                        style={{ margin: 0, flex: 1 }}
                        autoFocus
                      />
                      <button className="btn-ghost btn-sm" onClick={() => saveEdit(f.id)} style={{ color: "var(--success)" }}>✓</button>
                      <button className="btn-ghost btn-sm" onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => { setEditingId(f.id); setEditValue(f.field_value || ""); }}
                      style={{ fontSize: 14, cursor: "pointer", color: f.field_value ? "var(--text-primary)" : "var(--text-quaternary)" }}
                    >
                      {f.field_value || "Click to set value..."}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{f.field_type}</td>
                <td>
                  <button className="btn-ghost btn-sm" onClick={() => deleteField(f.id)} style={{ color: "var(--danger)", padding: "2px 6px" }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════ Add Field Panel ═══════ */}
      {showAddField && (
        <>
          <div onClick={() => setShowAddField(false)}
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
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add Related Field</h3>
                <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2 }}>Add a custom field to this project</p>
              </div>
              <button onClick={() => setShowAddField(false)} style={{
                background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)",
                padding: 6, cursor: "pointer", color: "var(--text-tertiary)", transition: "all var(--transition-fast)",
              }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px 28px" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Field Name *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Field name" autoFocus style={{ margin: 0 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Value</label>
                  <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value" style={{ margin: 0 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Type</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ margin: 0 }}>
                    <option value="text">Text</option>
                    <option value="date">Date</option>
                    <option value="number">Number</option>
                    <option value="link">Link</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{
              padding: "16px 28px", borderTop: "1px solid var(--border-primary)",
              display: "flex", gap: 12, background: "var(--bg-secondary)",
              position: "sticky", bottom: 0,
            }}>
              <button onClick={addField} disabled={!newName.trim()} style={{
                flex: 1, background: newName.trim() ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: newName.trim() ? "#fff" : "var(--text-quaternary)", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600,
                cursor: newName.trim() ? "pointer" : "default", transition: "all var(--transition-fast)",
              }}>Add Field</button>
              <button onClick={() => setShowAddField(false)} style={{
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
