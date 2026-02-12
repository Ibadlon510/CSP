"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtCurrency, fmtDate } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";

interface ProductTaskTemplate {
  id: string;
  task_name: string;
  sort_order: number;
  subtask_names: string[] | null;
  created_at: string;
}

interface ProductDocReq {
  id: string;
  document_name: string;
  document_category: string | null;
  sort_order: number;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_unit_price: number | null;
  is_active: boolean;
  creates_project: boolean;
  task_templates: ProductTaskTemplate[];
  document_requirements?: ProductDocReq[];
  created_at: string;
  updated_at: string;
}

type TabKey = "overview" | "tasks" | "documents";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Overview form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [createsProject, setCreatesProject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Task template add form
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskOrder, setNewTaskOrder] = useState(0);
  const [newSubtaskNames, setNewSubtaskNames] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Document requirement add form
  const [newDocName, setNewDocName] = useState("");
  const [newDocCategory, setNewDocCategory] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);

  // Deletion state
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/products/${id}`) as Product;
      setProduct(data);
      setName(data.name);
      setCode(data.code || "");
      setDescription(data.description || "");
      setDefaultUnitPrice(data.default_unit_price != null ? String(data.default_unit_price) : "");
      setIsActive(data.is_active);
      setCreatesProject(data.creates_project);
      setDirty(false);
    } catch {
      setError("Product not found");
    } finally {
      setLoading(false);
    }
  }

  function markDirty() { if (!dirty) setDirty(true); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (createsProject && (!product?.task_templates || product.task_templates.length === 0)) {
      setError("When 'Creates project' is enabled, add at least one task template first.");
      return;
    }
    setSaving(true);
    try {
      const data = await api.patch(`/api/products/${id}`, {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        default_unit_price: defaultUnitPrice ? parseFloat(defaultUnitPrice) : null,
        is_active: isActive,
        creates_project: createsProject,
      }) as Product;
      setProduct(data);
      setDirty(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/api/products/${id}`);
      router.push("/dashboard/products");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  function parseSubtaskNames(s: string): string[] {
    return s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  }

  async function addTaskTemplate() {
    if (!newTaskName.trim()) return;
    setAddingTask(true);
    setError("");
    try {
      await api.post(`/api/products/${id}/task-templates`, {
        task_name: newTaskName.trim(),
        sort_order: newTaskOrder,
        subtask_names: parseSubtaskNames(newSubtaskNames).length ? parseSubtaskNames(newSubtaskNames) : undefined,
      });
      setNewTaskName("");
      setNewSubtaskNames("");
      setNewTaskOrder((product?.task_templates?.length ?? 0));
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add task template");
    } finally {
      setAddingTask(false);
    }
  }

  async function deleteTaskTemplate(templateId: string) {
    if (!window.confirm("Remove this task template?")) return;
    setError("");
    try {
      await api.delete(`/api/products/${id}/task-templates/${templateId}`);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function addDocRequirement() {
    if (!newDocName.trim()) return;
    setAddingDoc(true);
    setError("");
    try {
      await api.post(`/api/products/${id}/document-requirements`, {
        document_name: newDocName.trim(),
        document_category: newDocCategory.trim() || undefined,
        sort_order: (product?.document_requirements?.length ?? 0),
      });
      setNewDocName("");
      setNewDocCategory("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAddingDoc(false);
    }
  }

  async function deleteDocRequirement(reqId: string) {
    if (!window.confirm("Remove this document requirement?")) return;
    try {
      await api.delete(`/api/products/${id}/document-requirements/${reqId}`);
      await load();
    } catch {}
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: "center" }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }} />
        <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading product...</p>
      </div>
    );
  }

  // ── Not Found ──
  if (!product) {
    return (
      <div>
        <div className="breadcrumb">
          <Link href="/dashboard/products">Products</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <span className="current">Not Found</span>
        </div>
        <div className="empty-state">
          <div style={{ opacity: 0.4, marginBottom: 16 }}>
            <Icon path="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={48} />
          </div>
          <div className="empty-state-title">Product not found</div>
          <div className="empty-state-description">This product may have been deleted or you don&apos;t have permission to view it.</div>
          <Link href="/dashboard/products" className="btn-primary" style={{ marginTop: 8 }}>
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "tasks", label: "Task Templates", count: product.task_templates?.length ?? 0 },
    { key: "documents", label: "Documents", count: product.document_requirements?.length ?? 0 },
  ];

  const totalSubtasks = product.task_templates?.reduce((sum, t) => sum + (t.subtask_names?.length ?? 0), 0) ?? 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/dashboard/products">Products</Link>
        <Icon path="M9 18l6-6-6-6" size={14} />
        <span className="current">{product.name}</span>
      </div>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-content" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{product.name}</h1>
          {product.code && (
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", background: "var(--bg-tertiary)", padding: "4px 10px", borderRadius: "var(--radius-sm)", marginTop: 4 }}>{product.code}</span>
          )}
          {product.is_active ? (
            <span className="badge badge-success badge-dot">Active</span>
          ) : (
            <span className="badge badge-neutral badge-dot">Inactive</span>
          )}
          {product.creates_project && (
            <span className="badge badge-accent">Creates Project</span>
          )}
        </div>
        <div className="page-header-actions">
          <button className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={handleDelete} disabled={deleting}>
            <Icon path="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" size={14} />
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="card" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <div>
            <div className="meta-label">Default Price</div>
            <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {product.default_unit_price != null ? fmtCurrency(product.default_unit_price) : "—"}
            </div>
          </div>
          <div>
            <div className="meta-label">Task Templates</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {product.task_templates?.length ?? 0}
              {totalSubtasks > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 4 }}>({totalSubtasks} subtasks)</span>}
            </div>
          </div>
          <div>
            <div className="meta-label">Required Documents</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{product.document_requirements?.length ?? 0}</div>
          </div>
          <div>
            <div className="meta-label">Created</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{fmtDate(product.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingLeft: 16 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-bar-btn${activeTab === t.key ? " active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.count !== undefined && (
              <span style={{
                fontSize: 11, fontWeight: 700, borderRadius: "var(--radius-full)", padding: "1px 7px", lineHeight: "16px", marginLeft: 4,
                background: activeTab === t.key ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: activeTab === t.key ? "var(--text-inverse)" : "var(--text-tertiary)",
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && <div className="alert alert-danger" style={{ marginTop: 20 }}>{error}</div>}

      {/* Tab content */}
      <div className="card" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" }}>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <form onSubmit={handleSave}>
            {/* Save bar */}
            {dirty && (
              <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-secondary)", padding: "8px 0", display: "flex", justifyContent: "flex-end", marginBottom: 16, borderBottom: "1px solid var(--border-secondary)" }}>
                <button type="submit" className="btn-primary" disabled={saving}>
                  <Icon path="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" size={14} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label>Name *</label>
                <input type="text" value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} required />
              </div>
              <div>
                <label>Product Code</label>
                <input type="text" maxLength={20} value={code} onChange={(e) => { setCode(e.target.value); markDirty(); }} placeholder="e.g. CF, LR" />
                <span style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 2, display: "block" }}>Short code used in project naming</span>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <textarea rows={3} value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} placeholder="Describe the product or service..." />
              </div>
              <div>
                <label>Default Unit Price (AED)</label>
                <input type="number" step="0.01" min="0" value={defaultUnitPrice} onChange={(e) => { setDefaultUnitPrice(e.target.value); markDirty(); }} placeholder="0.00" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, paddingTop: 24 }}>
                <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  onClick={() => { setIsActive(!isActive); markDirty(); }}>
                  <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => { setIsActive(e.target.checked); markDirty(); }} />
                  <label htmlFor="isActive" style={{ margin: 0, cursor: "pointer", fontWeight: 600 }}>Active</label>
                </div>
                <div style={{ padding: "12px 16px", background: createsProject ? "var(--accent-teal-light)" : "var(--bg-tertiary)", border: createsProject ? "1px solid rgba(13,148,136,0.3)" : "1px solid transparent", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  onClick={() => { setCreatesProject(!createsProject); markDirty(); }}>
                  <input type="checkbox" id="createsProject" checked={createsProject} onChange={(e) => { setCreatesProject(e.target.checked); markDirty(); }} />
                  <label htmlFor="createsProject" style={{ margin: 0, cursor: "pointer", fontWeight: 600, color: createsProject ? "var(--accent-teal)" : "var(--text-primary)" }}>Creates Project on Confirm</label>
                </div>
              </div>
            </div>
            {!dirty && (
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn-primary" disabled={saving}>
                  <Icon path="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" size={14} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </form>
        )}

        {/* ── Task Templates Tab ── */}
        {activeTab === "tasks" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Task Templates</h4>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  Tasks auto-created on the project when this product is on a confirmed sales order.
                  {product.creates_project ? "" : " Enable \"Creates Project\" in Overview to use these."}
                </p>
              </div>
            </div>

            {!product.creates_project && (
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                <Icon path="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={16} />
                Task templates will only be used when &quot;Creates Project&quot; is enabled in the Overview tab.
              </div>
            )}

            {/* Task template list */}
            {(product.task_templates?.length ?? 0) > 0 ? (
              <div className="table-container" style={{ marginBottom: 20 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>Order</th>
                      <th>Task Name</th>
                      <th>Subtasks</th>
                      <th style={{ width: 80, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.task_templates
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((t) => (
                        <tr key={t.id}>
                          <td>
                            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>{t.sort_order}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{t.task_name}</span>
                          </td>
                          <td>
                            {t.subtask_names?.length ? (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {t.subtask_names.map((s, i) => (
                                  <span key={i} style={{ fontSize: 12, background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)" }}>{s}</span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-quaternary)", fontSize: 13 }}>No subtasks</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn-ghost btn-sm" style={{ padding: 4, color: "var(--danger)" }} onClick={() => deleteTaskTemplate(t.id)} aria-label="Delete task template">
                              <Icon path="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-quaternary)", border: "1px dashed var(--border-primary)", borderRadius: "var(--radius-lg)", marginBottom: 20 }}>
                <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={32} />
                <p style={{ marginTop: 8, fontSize: 14, fontWeight: 500 }}>No task templates yet</p>
                <p style={{ fontSize: 13 }}>Add templates below to auto-create tasks on projects.</p>
              </div>
            )}

            {/* Add task template form */}
            <div style={{ padding: 20, background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)" }}>
              <h5 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add Task Template</h5>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12 }}>Task Name *</label>
                  <input type="text" placeholder="e.g. Document Collection" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} style={{ margin: 0 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12 }}>Order</label>
                  <input type="number" value={newTaskOrder} onChange={(e) => setNewTaskOrder(parseInt(e.target.value, 10) || 0)} style={{ margin: 0 }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12 }}>Subtask Names (comma-separated)</label>
                <input type="text" placeholder="e.g. Passport Copy, Emirates ID, Proof of Address" value={newSubtaskNames} onChange={(e) => setNewSubtaskNames(e.target.value)} style={{ margin: 0 }} />
              </div>
              <button type="button" className="btn-primary btn-sm" onClick={addTaskTemplate} disabled={addingTask || !newTaskName.trim()}>
                <Icon path="M12 4v16m8-8H4" size={14} />
                {addingTask ? "Adding..." : "Add Task Template"}
              </button>
            </div>
          </div>
        )}

        {/* ── Documents Tab ── */}
        {activeTab === "documents" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Required Documents</h4>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Documents that should be collected when this product is associated with a project.</p>
            </div>

            {/* Document requirements list */}
            {(product.document_requirements?.length ?? 0) > 0 ? (
              <div className="table-container" style={{ marginBottom: 20 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>Order</th>
                      <th>Document Name</th>
                      <th>Category</th>
                      <th style={{ width: 80, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.document_requirements!
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((d) => (
                        <tr key={d.id}>
                          <td>
                            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>{d.sort_order}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{d.document_name}</span>
                          </td>
                          <td>
                            {d.document_category ? (
                              <span className="badge badge-neutral">{d.document_category}</span>
                            ) : (
                              <span style={{ color: "var(--text-quaternary)" }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn-ghost btn-sm" style={{ padding: 4, color: "var(--danger)" }} onClick={() => deleteDocRequirement(d.id)} aria-label="Delete document requirement">
                              <Icon path="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-quaternary)", border: "1px dashed var(--border-primary)", borderRadius: "var(--radius-lg)", marginBottom: 20 }}>
                <Icon path="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" size={32} />
                <p style={{ marginTop: 8, fontSize: 14, fontWeight: 500 }}>No document requirements yet</p>
                <p style={{ fontSize: 13 }}>Add required documents that must be collected for this product.</p>
              </div>
            )}

            {/* Add document form */}
            <div style={{ padding: 20, background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)" }}>
              <h5 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add Document Requirement</h5>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12 }}>Document Name *</label>
                  <input type="text" placeholder="e.g. Trade License" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} style={{ margin: 0 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12 }}>Category</label>
                  <input type="text" placeholder="e.g. trade_license" value={newDocCategory} onChange={(e) => setNewDocCategory(e.target.value)} style={{ margin: 0 }} />
                </div>
              </div>
              <button type="button" className="btn-primary btn-sm" onClick={addDocRequirement} disabled={addingDoc || !newDocName.trim()}>
                <Icon path="M12 4v16m8-8H4" size={14} />
                {addingDoc ? "Adding..." : "Add Document"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
