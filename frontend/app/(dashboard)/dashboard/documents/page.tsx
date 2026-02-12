"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useDocumentViewer } from "@/components/DocumentViewer";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { SpreadsheetView } from "@/components/ui/SpreadsheetView";
import { KanbanView, type KanbanColumnConfig, type GenericCardData } from "@/components/ui/KanbanView";
import { TimelineView } from "@/components/ui/TimelineView";
import { Pill } from "@/components/ui/Pill";

interface Doc {
  id: string;
  org_id: string;
  file_name: string;
  category: string;
  status: string;
  file_size: number | null;
  mime_type: string | null;
  checksum: string | null;
  contact_id: string | null;
  task_id: string | null;
  project_id: string | null;
  purpose: string | null;
  folder: string | null;
  tags: string[] | null;
  description: string | null;
  archived_at: string | null;
  retention_until: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

interface RetentionItem {
  id: string;
  file_name: string;
  category: string;
  retention_until: string;
  days_overdue: number;
  contact_id: string | null;
  task_id: string | null;
  project_id: string | null;
}

interface DocumentTypeItem {
  slug: string;
  name: string;
  id?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h: Record<string, string> = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

const formatSize = (bytes: number | null) => {
  if (bytes == null) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const previewable = (doc: Doc) =>
  doc.mime_type?.startsWith("image/") || doc.mime_type === "application/pdf";

type Tab = "all" | "retention";

const DOC_STATUSES = ["active", "archived"];

const DOC_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "var(--success)", bg: "var(--success-light)" },
  archived: { label: "Archived", color: "#b45309", bg: "#fffbeb" },
};

const DOC_KANBAN_COLUMNS: KanbanColumnConfig[] = DOC_STATUSES.map((s) => ({
  id: s, label: DOC_STATUS_CFG[s].label, color: DOC_STATUS_CFG[s].color, bg: DOC_STATUS_CFG[s].bg,
}));

export default function DocumentsPage() {
  const { openViewer } = useDocumentViewer();
  const toast = useToast();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ category: [], status: [], contact_id: [] });
  const [groupBy, setGroupBy] = useState("");
  const [viewMode, setViewMode] = useState("spreadsheet");
  const [tab, setTab] = useState<Tab>("all");
  const [retentionItems, setRetentionItems] = useState<RetentionItem[]>([]);
  const [retentionLoading, setRetentionLoading] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [bulkFolderInput, setBulkFolderInput] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Detail modal
  const [detailDoc, setDetailDoc] = useState<Doc | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editForm, setEditForm] = useState({ category: "", description: "", folder: "", tags: "", retention_until: "" });

  const load = useCallback(() => {
    setLoading(true);
    api.get("/api/documents/").then((data: Doc[]) => { setDocuments(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/api/contacts/").then((data: { id: string; name: string }[]) => setContacts(data)).catch(() => {});
  }, []);
  useEffect(() => {
    api.get("/api/documents/document-types/").then((data: DocumentTypeItem[]) => setDocumentTypes(data)).catch(() => setDocumentTypes([]));
  }, []);

  const docFilterConfig: FilterFieldConfig[] = useMemo(() => [
    { key: "category", label: "Category", options: documentTypes.map((t) => ({ value: t.slug, label: t.name })) },
    { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }] },
    ...(contacts.length > 0 ? [{ key: "contact_id", label: "Contact", options: contacts.map((c) => ({ value: c.id, label: c.name })) }] : []),
  ], [documentTypes, contacts]);

  const docGroupOptions = [
    { value: "category", label: "Category" },
    { value: "status", label: "Status" },
  ];

  const filteredDocuments = useMemo(() => {
    let list = documents;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.file_name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q)));
    }
    if (filters.category?.length) list = list.filter((d) => filters.category.includes(d.category));
    if (filters.status?.length) list = list.filter((d) => filters.status.includes(d.status));
    if (filters.contact_id?.length) list = list.filter((d) => d.contact_id && filters.contact_id.includes(d.contact_id));
    return list;
  }, [documents, search, filters]);

  function loadRetention() {
    setRetentionLoading(true);
    api.get("/api/documents/retention-report").then((d: RetentionItem[]) => { setRetentionItems(d); setRetentionLoading(false); }).catch(() => setRetentionLoading(false));
  }

  useEffect(() => { if (tab === "retention") loadRetention(); }, [tab]);

  const openPreview = (d: Doc) => {
    openViewer({ apiPath: `/api/documents/${d.id}/preview`, fileName: d.file_name, mimeType: d.mime_type ?? undefined });
  };

  async function downloadDoc(d: Doc) {
    const res = await fetch(`${API_URL}/api/documents/${d.id}/download`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = d.file_name; a.click();
    URL.revokeObjectURL(url);
  }

  async function archiveDoc(id: string) {
    try { await api.post(`/api/documents/${id}/archive`, {}); toast.success("Archived"); load(); } catch { toast.error("Failed"); }
  }
  async function restoreDoc(id: string) {
    try { await api.post(`/api/documents/${id}/restore`, {}); toast.success("Restored"); load(); } catch { toast.error("Failed"); }
  }
  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return;
    try { await api.delete(`/api/documents/${id}`); toast.success("Deleted"); load(); if (detailDoc?.id === id) setDetailDoc(null); } catch { toast.error("Failed"); }
  }

  // Bulk operations
  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSelectAll() {
    if (selected.size === filteredDocuments.length) setSelected(new Set());
    else setSelected(new Set(filteredDocuments.map((d) => d.id)));
  }

  async function executeBulk() {
    if (selected.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selected);
    try {
      if (bulkAction === "archive") {
        await api.post("/api/documents/bulk-archive", { document_ids: ids });
        toast.success(`Archived ${ids.length} documents`);
      } else if (bulkAction === "restore") {
        await api.post("/api/documents/bulk-restore", { document_ids: ids });
        toast.success(`Restored ${ids.length} documents`);
      } else if (bulkAction === "tag" && bulkTagInput.trim()) {
        const tags = bulkTagInput.split(",").map((t) => t.trim()).filter(Boolean);
        await api.post("/api/documents/bulk-tag", { document_ids: ids, tags });
        toast.success(`Tagged ${ids.length} documents`);
      } else if (bulkAction === "move" && bulkFolderInput.trim()) {
        await api.post("/api/documents/bulk-move", { document_ids: ids, folder: bulkFolderInput.trim() });
        toast.success(`Moved ${ids.length} documents`);
      }
      setSelected(new Set()); setBulkAction(""); setBulkTagInput(""); setBulkFolderInput("");
      load();
    } catch { toast.error("Bulk operation failed"); }
    setBulkProcessing(false);
  }

  // Detail modal
  function openDetail(d: Doc) {
    setDetailDoc(d);
    setEditingMeta(false);
    setEditForm({
      category: d.category, description: d.description || "", folder: d.folder || "",
      tags: (d.tags || []).join(", "), retention_until: d.retention_until ? d.retention_until.slice(0, 10) : "",
    });
  }

  async function saveMetadata() {
    if (!detailDoc) return;
    const tags = editForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      const updated = await api.patch(`/api/documents/${detailDoc.id}`, {
        category: editForm.category, description: editForm.description || null,
        folder: editForm.folder || null, tags: tags.length > 0 ? tags : null,
        retention_until: editForm.retention_until || null,
      });
      setDetailDoc(updated);
      setEditingMeta(false);
      toast.success("Metadata saved");
      load();
    } catch { toast.error("Save failed"); }
  }

  const contactName = (id: string | null) => {
    if (!id) return null;
    return contacts.find((c) => c.id === id)?.name || id.slice(0, 8);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">Unified filing, storage, archiving, and viewing</p>
        </div>
        <div className="page-header-actions">
          <a href="/dashboard/documents/upload" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
            Upload Document
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg, 12px)", marginBottom: 20, maxWidth: 320 }}>
        {([["all", "All Documents"], ["retention", "Retention Report"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{
            flex: 1, padding: "8px 12px", borderRadius: "var(--radius-md, 8px)", fontSize: 13,
            fontWeight: tab === key ? 600 : 500, color: tab === key ? "var(--text-primary)" : "var(--text-tertiary)",
            background: tab === key ? "var(--bg-secondary)" : "transparent",
            boxShadow: tab === key ? "var(--shadow-sm)" : "none", border: "none", cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {/* ===== ALL DOCUMENTS TAB ===== */}
      {tab === "all" && (
        <>
          {/* Search / Filter / View bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={docFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={docGroupOptions} pageKey="documents" placeholder="Search documents..." />
            <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="card" style={{ marginBottom: 16, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "var(--accent-blue-light, #eff6ff)", border: "1px solid var(--accent-blue, #3b82f6)" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.size} selected</span>
              <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}>
                <option value="">Bulk action...</option>
                <option value="archive">Archive</option>
                <option value="restore">Restore</option>
                <option value="tag">Add tags</option>
                <option value="move">Move to folder</option>
              </select>
              {bulkAction === "tag" && (
                <input placeholder="tag1, tag2" value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, width: 160 }} />
              )}
              {bulkAction === "move" && (
                <input placeholder="Folder name" value={bulkFolderInput} onChange={(e) => setBulkFolderInput(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, width: 180 }} />
              )}
              <button type="button" className="btn-primary btn-sm" onClick={executeBulk} disabled={!bulkAction || bulkProcessing} style={{ fontSize: 12 }}>
                {bulkProcessing ? "Processing..." : "Apply"}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setSelected(new Set()); setBulkAction(""); }} style={{ fontSize: 12 }}>Clear</button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <p style={{ padding: 20, textAlign: "center", color: "var(--text-light)" }}>Loading...</p>
          )}

          {/* Spreadsheet View */}
          {!loading && viewMode === "spreadsheet" && (
            <SpreadsheetView<Doc>
              columns={[
                { key: "select", label: "", width: 36, renderHeader: () => (
                  <input type="checkbox" checked={selected.size === filteredDocuments.length && filteredDocuments.length > 0} onChange={toggleSelectAll} style={{ width: 16, height: 16, cursor: "pointer" }} />
                ), render: (d) => (
                  <span onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                  </span>
                ) },
                { key: "file_name", label: "File", render: (d) => (
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: 2, fontSize: 13 }}>{d.file_name}</p>
                    {d.description && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.description.slice(0, 50)}{d.description.length > 50 ? "..." : ""}</p>}
                    {d.folder && <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}><Icon path="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" size={11} /> {d.folder}</p>}
                  </div>
                ) },
                { key: "category", label: "Category", render: (d) => <span className="badge badge-info" style={{ textTransform: "capitalize", fontSize: 11 }}>{d.category.replace("_", " ")}</span> },
                { key: "linked", label: "Linked To", render: (d) => (
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {d.contact_id && contactName(d.contact_id)}
                    {d.project_id && "Project"}
                    {d.task_id && "Task"}
                    {!d.contact_id && !d.project_id && !d.task_id && "\u2014"}
                  </span>
                ) },
                { key: "file_size", label: "Size", render: (d) => <span style={{ fontSize: 12 }}>{formatSize(d.file_size)}</span> },
                { key: "status", label: "Status", render: (d) => { const sc = DOC_STATUS_CFG[d.status] || DOC_STATUS_CFG.active; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
                { key: "created_at", label: "Created", render: (d) => <span style={{ fontSize: 12, color: "var(--text-light)" }}>{fmtDate(d.created_at)}</span> },
                { key: "actions", label: "Actions", render: (d) => (
                  <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {previewable(d) && (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openPreview(d)} title="Preview" style={{ padding: "4px 6px" }}>
                        <Icon path="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} />
                      </button>
                    )}
                    <button type="button" className="btn-ghost btn-sm" onClick={() => downloadDoc(d)} title="Download" style={{ padding: "4px 6px" }}>
                      <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" size={14} />
                    </button>
                    {d.status === "active" ? (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => archiveDoc(d.id)} title="Archive" style={{ padding: "4px 6px", color: "var(--warning, #f59e0b)" }}>
                        <Icon path="M21 8v13H3V8 M1 3h22v5H1z M10 12h4" size={14} />
                      </button>
                    ) : (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => restoreDoc(d.id)} title="Restore" style={{ padding: "4px 6px", color: "var(--success, #10b981)" }}>
                        <Icon path="M1 4v6h6 M3.51 15a9 9 0 1 0 2.13-9.36L1 10" size={14} />
                      </button>
                    )}
                    <button type="button" className="btn-ghost btn-sm" onClick={() => deleteDoc(d.id)} title="Delete" style={{ padding: "4px 6px", color: "var(--danger)" }}>
                      <Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={14} />
                    </button>
                  </div>
                ) },
              ]}
              groups={DOC_STATUSES.map((s) => {
                const sc = DOC_STATUS_CFG[s];
                return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: filteredDocuments.filter((d) => d.status === s) };
              }).filter((g) => g.items.length > 0)}
              onRowClick={(d) => openDetail(d)}
              emptyIcon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z M11 3v6h6"
              emptyLabel="No documents yet"
              emptyDescription="Upload documents from Contacts, Tasks, or Projects."
            />
          )}

          {/* Timeline View */}
          {!loading && viewMode === "timeline" && (
            <TimelineView
              items={filteredDocuments.map((d) => {
                const sc = DOC_STATUS_CFG[d.status] || DOC_STATUS_CFG.active;
                return {
                  id: d.id,
                  title: d.file_name,
                  startDate: d.created_at,
                  endDate: d.retention_until || undefined,
                  color: sc.color,
                  bg: sc.bg,
                  onClick: () => openDetail(d),
                };
              })}
              emptyLabel="No documents to display on timeline"
            />
          )}

          {/* Kanban View */}
          {!loading && viewMode === "kanban" && (
            <KanbanView
              columns={DOC_KANBAN_COLUMNS}
              itemsByColumn={Object.fromEntries(DOC_STATUSES.map((s) => [
                s,
                filteredDocuments.filter((d) => d.status === s).map((d): GenericCardData => ({
                  id: d.id,
                  title: d.file_name,
                  subtitle: d.description || d.category.replace("_", " "),
                  meta: [
                    { label: "Size", value: formatSize(d.file_size) },
                    { label: "Created", value: fmtDate(d.created_at) },
                  ],
                })),
              ]))}
              onItemClick={(id) => { const d = filteredDocuments.find((x) => x.id === id); if (d) openDetail(d); }}
              emptyLabel="No documents"
            />
          )}
        </>
      )}

      {/* ===== RETENTION REPORT TAB ===== */}
      {tab === "retention" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Retention Report</h3>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Documents past their retention date that are still active</p>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={loadRetention}>Refresh</button>
          </div>
          {retentionLoading ? (
            <div style={{ padding: 40, textAlign: "center" }}><div className="loading-spinner" style={{ width: 24, height: 24, margin: "0 auto" }} /></div>
          ) : retentionItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
              <Icon path="M9 12l2 2 4-4 M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" size={40} />
              <p style={{ marginTop: 12, fontWeight: 500 }}>All clear! No documents past retention.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Category</th>
                  <th>Retention Until</th>
                  <th>Days Overdue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {retentionItems.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{r.file_name}</td>
                    <td><span className="badge badge-info" style={{ textTransform: "capitalize", fontSize: 11 }}>{r.category.replace("_", " ")}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{r.retention_until}</td>
                    <td><span className="badge badge-danger" style={{ fontSize: 11 }}>{r.days_overdue} days</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => archiveDoc(r.id)} style={{ fontSize: 11, color: "var(--warning, #f59e0b)" }}>Archive</button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => deleteDoc(r.id)} style={{ fontSize: 11, color: "var(--danger)" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== DOCUMENT DETAIL MODAL ===== */}
      {detailDoc && (
        <>
          <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998 }} onClick={() => setDetailDoc(null)} />
          <aside role="dialog" aria-label="Document details" style={{
            position: "fixed", top: 0, right: 0, width: "min(600px, 100vw)", height: "100vh",
            background: "var(--bg-primary)", boxShadow: "-4px 0 24px rgba(0,0,0,0.15)", zIndex: 9999,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <header style={{ flexShrink: 0, padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bg-secondary)" }}>
              <div style={{ minWidth: 0 }}>
                <h2 className="truncate" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }} title={detailDoc.file_name}>{detailDoc.file_name}</h2>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                  <span className={`badge badge-${detailDoc.status === "active" ? "success" : "warning"}`} style={{ fontSize: 10 }}>{detailDoc.status}</span>
                  <span style={{ marginLeft: 8 }}>{formatSize(detailDoc.file_size)}</span>
                  <span style={{ marginLeft: 8 }}>{fmtDateTime(detailDoc.created_at)}</span>
                </p>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setDetailDoc(null)} aria-label="Close">
                <Icon path="M18 6L6 18M6 6l12 12" size={18} />
              </button>
            </header>

            {/* Body */}
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              {/* Preview area */}
              {previewable(detailDoc) && (
                <div style={{ marginBottom: 20, textAlign: "center", background: "var(--bg-tertiary)", borderRadius: 8, padding: 16, border: "1px solid var(--border-primary, var(--border))" }}>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => openPreview(detailDoc)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon path="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} />
                    Open Preview
                  </button>
                </div>
              )}

              {/* Metadata */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-quaternary, var(--text-tertiary))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Metadata</h4>
                  {!editingMeta && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingMeta(true)} style={{ fontSize: 12 }}>
                      <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={12} /> Edit
                    </button>
                  )}
                </div>

                {editingMeta ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Category</label>
                        <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                          {editForm.category && !documentTypes.some((t) => t.slug === editForm.category) && (
                            <option value={editForm.category}>{editForm.category.replace(/_/g, " ")}</option>
                          )}
                          {documentTypes.map((t) => (
                            <option key={t.slug} value={t.slug}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Folder</label>
                        <input value={editForm.folder} onChange={(e) => setEditForm({ ...editForm, folder: e.target.value })} placeholder="Optional folder" />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Tags (comma-separated)</label>
                      <input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="tag1, tag2" />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Description</label>
                      <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Retention Until</label>
                      <input type="date" value={editForm.retention_until} onChange={(e) => setEditForm({ ...editForm, retention_until: e.target.value })} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn-primary btn-sm" onClick={saveMetadata}>Save</button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingMeta(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 12px", fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>Category</span>
                    <span className="badge badge-info" style={{ textTransform: "capitalize", fontSize: 11, width: "fit-content" }}>{detailDoc.category.replace("_", " ")}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>Folder</span>
                    <span>{detailDoc.folder || "\u2014"}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>Tags</span>
                    <span>{detailDoc.tags?.length ? detailDoc.tags.map((t) => <span key={t} className="badge badge-neutral" style={{ fontSize: 10, marginRight: 4 }}>{t}</span>) : "\u2014"}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>Description</span>
                    <span>{detailDoc.description || "\u2014"}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>MIME Type</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11 }}>{detailDoc.mime_type || "\u2014"}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>Checksum</span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, wordBreak: "break-all" }}>{detailDoc.checksum || "\u2014"}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>Retention</span>
                    <span>{detailDoc.retention_until ? detailDoc.retention_until.slice(0, 10) : "\u2014"}</span>
                    {detailDoc.contact_id && (<><span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>Contact</span><span>{contactName(detailDoc.contact_id)}</span></>)}
                    {detailDoc.archived_at && (<><span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>Archived</span><span>{fmtDateTime(detailDoc.archived_at)}</span></>)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ borderTop: "1px solid var(--border-primary, var(--border))", paddingTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {previewable(detailDoc) && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => openPreview(detailDoc)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon path="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} /> Preview
                  </button>
                )}
                <button type="button" className="btn-primary btn-sm" onClick={() => downloadDoc(detailDoc)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" size={14} /> Download
                </button>
                {detailDoc.status === "active" ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => { archiveDoc(detailDoc.id); setDetailDoc(null); }} style={{ color: "var(--warning, #f59e0b)" }}>Archive</button>
                ) : (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => { restoreDoc(detailDoc.id); setDetailDoc(null); }} style={{ color: "var(--success, #10b981)" }}>Restore</button>
                )}
                <button type="button" className="btn-ghost btn-sm" onClick={() => deleteDoc(detailDoc.id)} style={{ color: "var(--danger)" }}>Delete</button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
