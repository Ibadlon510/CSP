"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";

interface SelectOption { id: string; name?: string; title?: string; }
interface DocumentTypeItem { slug: string; name: string; id?: string | null; }

type LinkType = "contact" | "task" | "project";

export default function DocumentUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preContact = searchParams.get("contact_id") || "";
  const preTask = searchParams.get("task_id") || "";
  const preProject = searchParams.get("project_id") || "";

  const initialLink: LinkType = preTask ? "task" : preProject ? "project" : "contact";

  const [linkType, setLinkType] = useState<LinkType>(initialLink);
  const [contacts, setContacts] = useState<SelectOption[]>([]);
  const [tasks, setTasks] = useState<SelectOption[]>([]);
  const [projects, setProjects] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contactId, setContactId] = useState(preContact);
  const [taskId, setTaskId] = useState(preTask);
  const [projectId, setProjectId] = useState(preProject);
  const [category, setCategory] = useState("other");
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeItem[]>([]);
  const [description, setDescription] = useState("");
  const [folder, setFolder] = useState("");
  const [retentionUntil, setRetentionUntil] = useState("");
  const toast = useToast();

  useEffect(() => {
    api.get("/api/contacts/").then((d: SelectOption[]) => setContacts(d)).catch(() => {});
    api.get("/api/projects/").then((d: SelectOption[]) => setProjects(d)).catch(() => {});
    api.get("/api/documents/document-types/").then((d: DocumentTypeItem[]) => setDocumentTypes(d)).catch(() => setDocumentTypes([]));
  }, []);

  useEffect(() => {
    if (linkType === "task" && projectId) {
      api.get(`/api/projects/${projectId}/tasks`).then((d: SelectOption[]) => setTasks(d)).catch(() => setTasks([]));
    }
  }, [linkType, projectId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    if (!fileInput?.files?.length) { setError("Please select a file"); return; }

    if (linkType === "contact" && !contactId) { setError("Please select a contact"); return; }
    if (linkType === "task" && !taskId) { setError("Please select a task"); return; }
    if (linkType === "project" && !projectId) { setError("Please select a project"); return; }

    setLoading(true);
    const fd = new FormData();
    fd.append("file", fileInput.files[0]);
    if (linkType === "contact") fd.append("contact_id", contactId);
    if (linkType === "task") fd.append("task_id", taskId);
    if (linkType === "project") fd.append("project_id", projectId);
    fd.append("category", category);
    if (description) fd.append("description", description);
    if (folder) fd.append("folder", folder);
    if (retentionUntil) fd.append("retention_until", retentionUntil);
    try {
      await api.postForm("/api/documents/", fd);
      toast.success("Document uploaded");
      router.push("/dashboard/documents");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <a href="/dashboard/documents" style={{ fontSize: 14, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12, fontWeight: 500 }}>
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
            Back to Documents
          </a>
          <h1 className="page-title">Upload Document</h1>
          <p className="page-subtitle">Add a document to a contact, task, or project</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 20 }}>
              <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={18} />
              {error}
            </div>
          )}

          {/* Link type selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ marginBottom: 8, display: "block", fontWeight: 600 }}>Link to *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["contact", "task", "project"] as LinkType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLinkType(t)}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: "var(--radius-md, 8px)",
                    border: linkType === t ? "2px solid var(--brand-primary, #2563eb)" : "1px solid var(--border, #e5e7eb)",
                    background: linkType === t ? "var(--accent-blue-light, #eff6ff)" : "var(--bg-secondary, #fff)",
                    fontWeight: linkType === t ? 600 : 500, fontSize: 13, cursor: "pointer",
                    color: linkType === t ? "var(--brand-primary, #2563eb)" : "var(--text-secondary, #6b7280)",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Contact picker */}
          {linkType === "contact" && (
            <div style={{ marginBottom: 20 }}>
              <label>Contact *</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} required>
                <option value="">Select contact</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Task picker (project first, then task) */}
          {linkType === "task" && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label>Project (to filter tasks)</label>
                <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }}>
                  <option value="">Select project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title || p.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label>Task *</label>
                <select value={taskId} onChange={(e) => setTaskId(e.target.value)} required>
                  <option value="">Select task</option>
                  {tasks.map((t) => <option key={t.id} value={t.id}>{t.title || t.name}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Project picker */}
          {linkType === "project" && (
            <div style={{ marginBottom: 20 }}>
              <label>Project *</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title || p.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {documentTypes.length === 0 && <option value="other">Other</option>}
                {documentTypes.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Folder (optional)</label>
              <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="e.g. License Renewal 2026" />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional description" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label>File *</label>
              <input name="file" type="file" required />
            </div>
            <div>
              <label>Retention until (optional)</label>
              <input type="date" value={retentionUntil} onChange={(e) => setRetentionUntil(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <div className="loading-spinner" style={{ width: 16, height: 16 }}></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
                  Upload
                </>
              )}
            </button>
            <a href="/dashboard/documents" className="btn-ghost">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
