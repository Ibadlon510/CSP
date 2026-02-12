"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";

interface TaskTemplateRow {
  task_name: string;
  sort_order: number;
  subtask_names: string[];
}

function parseSubtaskNames(s: string): string[] {
  const raw = s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  return [...new Set(raw)];
}

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [createsProject, setCreatesProject] = useState(false);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplateRow[]>([{ task_name: "", sort_order: 0, subtask_names: [] }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addTaskTemplate() {
    setTaskTemplates((prev) => [...prev, { task_name: "", sort_order: prev.length, subtask_names: [] }]);
  }

  function updateTaskTemplate(index: number, field: keyof TaskTemplateRow, value: string | number | string[]) {
    setTaskTemplates((prev) => {
      const next = [...prev];
      (next[index] as unknown as Record<string, unknown>)[field] = value;
      return next;
    });
  }

  function removeTaskTemplate(index: number) {
    setTaskTemplates((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (createsProject) {
      const valid = taskTemplates.filter((t) => t.task_name.trim());
      if (valid.length === 0) {
        setError("When 'Creates project' is enabled, add at least one task template with a task name.");
        return;
      }
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        default_unit_price: defaultUnitPrice ? parseFloat(defaultUnitPrice) : null,
        is_active: isActive,
        creates_project: createsProject,
        task_templates: (createsProject ? taskTemplates : [])
          .filter((t) => t.task_name.trim())
          .map((t) => ({
            task_name: t.task_name.trim(),
            sort_order: t.sort_order,
            subtask_names: t.subtask_names?.length ? t.subtask_names : undefined,
          })),
      };
      const res = await api.post("/api/products", payload) as { id: string };
      router.push(`/dashboard/products/${res.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create product";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/dashboard/products">Products</Link>
        <Icon path="M9 18l6-6-6-6" size={14} />
        <span className="current">New Product</span>
      </div>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-content">
          <h1 className="page-title">New Product</h1>
          <p className="page-subtitle">Define a product or service. Optionally configure project creation and task templates.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

        {/* Product details card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h5 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Product Details</h5>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label>Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Company Formation" required />
            </div>
            <div>
              <label>Product Code</label>
              <input type="text" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CF, LR" />
              <span style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 2, display: "block" }}>Short code used in project naming</span>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the product or service..." />
            </div>
            <div>
              <label>Default Unit Price (AED)</label>
              <input type="number" step="0.01" min="0" value={defaultUnitPrice} onChange={(e) => setDefaultUnitPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, paddingTop: 24 }}>
              <div
                style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                onClick={() => setIsActive(!isActive)}
              >
                <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <label htmlFor="isActive" style={{ margin: 0, cursor: "pointer", fontWeight: 600 }}>Active</label>
              </div>
            </div>
          </div>
        </div>

        {/* Project configuration card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div
            style={{
              padding: "12px 16px",
              background: createsProject ? "var(--accent-teal-light)" : "var(--bg-tertiary)",
              border: createsProject ? "1px solid rgba(13,148,136,0.3)" : "1px solid transparent",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              marginBottom: createsProject ? 20 : 0,
            }}
            onClick={() => setCreatesProject(!createsProject)}
          >
            <input type="checkbox" id="createsProject" checked={createsProject} onChange={(e) => setCreatesProject(e.target.checked)} />
            <label htmlFor="createsProject" style={{ margin: 0, cursor: "pointer", fontWeight: 600, color: createsProject ? "var(--accent-teal)" : "var(--text-primary)" }}>
              Creates Project on Sales Order Confirmation
            </label>
          </div>

          {createsProject && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h5 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Task Templates</h5>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  Define tasks that will be auto-created on the project. At least one required. Same task names from different products are merged with combined subtasks.
                </p>
              </div>

              {taskTemplates.map((t, i) => (
                <div key={i} style={{ marginBottom: 12, padding: 16, background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 12 }}>Task Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Document Collection"
                        value={t.task_name}
                        onChange={(e) => updateTaskTemplate(i, "task_name", e.target.value)}
                        style={{ margin: 0 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12 }}>Order</label>
                      <input
                        type="number"
                        value={t.sort_order}
                        onChange={(e) => updateTaskTemplate(i, "sort_order", parseInt(e.target.value, 10) || 0)}
                        style={{ margin: 0 }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button type="button" className="btn-ghost btn-sm" style={{ padding: 4, color: "var(--danger)" }} onClick={() => removeTaskTemplate(i)} aria-label="Remove task template">
                        <Icon path="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12 }}>Subtask Names (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Passport Copy, Emirates ID, Proof of Address"
                      value={Array.isArray(t.subtask_names) ? t.subtask_names.join(", ") : ""}
                      onChange={(e) => updateTaskTemplate(i, "subtask_names", parseSubtaskNames(e.target.value))}
                      style={{ margin: 0 }}
                    />
                  </div>
                </div>
              ))}

              <button type="button" className="btn-ghost btn-sm" onClick={addTaskTemplate}>
                <Icon path="M12 4v16m8-8H4" size={14} />
                Add Task Template
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" className="btn-primary" disabled={loading}>
            <Icon path="M12 4v16m8-8H4" size={14} />
            {loading ? "Creating..." : "Create Product"}
          </button>
          <Link href="/dashboard/products" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
