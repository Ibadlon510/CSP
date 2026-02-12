"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";

type Contact = {
  id: string;
  name: string;
};

export default function NewProjectPage() {
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState("");
  const [estimatedGovtFee, setEstimatedGovtFee] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    api.get("/api/contacts/").then((data: unknown) => {
      setContacts(data as Contact[]);
    }).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/projects/", {
        title,
        description,
        contact_id: contactId || undefined,
        estimated_govt_fee: estimatedGovtFee ? parseFloat(estimatedGovtFee) : undefined,
      });

      toast.success("Project created successfully");
      router.push(`/dashboard/projects/${(response as { id: string }).id}`);
    } catch (err: any) {
      const msg = err.message || "Failed to create project";
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
          <a href="/dashboard/projects" style={{ fontSize: 14, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12, fontWeight: 500 }}>
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
            Back to Projects
          </a>
          <h1 className="page-title">New Project</h1>
          <p className="page-subtitle">Organize tasks and workflows for client contacts</p>
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label>Project Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Company Formation for ABC Ltd"
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label>Description</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the project scope and objectives..."
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label>Linked Contact (Optional)</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">-- None (general project) --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Link this project to a specific client contact
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label>Estimated Govt Fee AED (Optional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 3200"
                value={estimatedGovtFee}
                onChange={(e) => setEstimatedGovtFee(e.target.value)}
              />
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Used for Red Alert: warn when assigning task if wallet balance is below this
              </p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={18} />
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className="btn-ghost" onClick={() => router.back()} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? (
                  <>
                    <div className="loading-spinner" style={{ width: 16, height: 16 }}></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={16} />
                    Create Project
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
