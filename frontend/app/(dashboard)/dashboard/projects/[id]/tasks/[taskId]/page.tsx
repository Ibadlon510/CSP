"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { FormField } from "@/components/ui/FormField";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fmtDate, fmtDateTime } from "@/lib/format";

type Assignee = { user_id: string; user_name?: string };
type Task = {
  id: string; project_id: string; title: string; description?: string; status: string;
  priority: string; category?: string; due_date?: string; date_assigned?: string;
  assigned_to?: string; assignee_name?: string; assignees?: Assignee[];
  parent_id?: string; subtask_count?: number; progress_pct?: number;
  subtasks?: Task[]; created_at: string; updated_at?: string;
  project_title?: string;
};
type UserOption = { id: string; full_name: string };
type Reaction = { emoji: string; count: number; user_ids: string[] };
type Comment = { id: string; user_id?: string; user_name?: string; content: string; parent_id?: string; reactions?: Reaction[]; reply_count?: number; created_at: string };

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: "To Do", color: "var(--info)", bg: "var(--info-light)" },
  in_progress: { label: "In Progress", color: "#7c3aed", bg: "#f5f3ff" },
  blocked: { label: "Blocked", color: "var(--danger)", bg: "var(--danger-light)" },
  review: { label: "Review", color: "#b45309", bg: "#fffbeb" },
  done: { label: "Done", color: "var(--success)", bg: "var(--success-light)" },
};
const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "var(--info)", bg: "var(--info-light)" },
  medium: { label: "Medium", color: "#7c3aed", bg: "#f5f3ff" },
  high: { label: "High", color: "#b45309", bg: "#fffbeb" },
  urgent: { label: "Urgent", color: "var(--danger)", bg: "var(--danger-light)" },
};

const TABS = ["details", "comments", "attachments", "settings"] as const;
type TabId = typeof TABS[number];

const SectionCard = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-primary)",
    padding: "20px 24px", marginBottom: 16, boxShadow: "var(--shadow-xs)", ...style,
  }}>{children}</div>
);

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const projectId = params.id as string;
  const taskId = params.taskId as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [replyTo, setReplyTo] = useState<{ id: string; user_name?: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [attachments, setAttachments] = useState<{ id: string; filename: string; file_size: number; mime_type?: string; user_name?: string; created_at: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const EMOJI_OPTIONS = [
    { emoji: "thumbsup", label: "👍" },
    { emoji: "heart", label: "❤️" },
    { emoji: "rocket", label: "🚀" },
    { emoji: "eyes", label: "👀" },
    { emoji: "fire", label: "🔥" },
  ];
  const emojiLabel = (key: string) => EMOJI_OPTIONS.find((e) => e.emoji === key)?.label || key;

  useEffect(() => { loadTask(); loadUsers(); loadComments(); loadAttachments(); }, [taskId]);

  async function loadTask() {
    setLoading(true);
    try {
      const all = await api.get(`/api/projects/${projectId}/tasks`) as Task[];
      const found = all.find((t) => t.id === taskId);
      if (found) {
        setTask(found);
        setEditForm({ title: found.title, description: found.description || "", status: found.status, priority: found.priority, category: found.category || "", due_date: found.due_date ? found.due_date.slice(0, 10) : "" });
        setEditAssigneeIds((found.assignees || []).map((a) => a.user_id));
      }
    } catch {}
    setLoading(false);
  }
  async function loadUsers() {
    try { const res = await api.get("/api/users/") as any[]; setUsers(res.map((u: any) => ({ id: u.id, full_name: u.full_name }))); } catch {}
  }
  async function loadComments() {
    try { setComments(await api.get(`/api/projects/tasks/${taskId}/comments`) as Comment[]); } catch {}
  }
  async function addComment() {
    if (!newComment.trim()) return;
    try { await api.post(`/api/projects/tasks/${taskId}/comments`, { content: newComment.trim() }); setNewComment(""); loadComments(); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  async function addReply() {
    if (!replyText.trim() || !replyTo) return;
    try { await api.post(`/api/projects/tasks/${taskId}/comments`, { content: replyText.trim(), parent_id: replyTo.id }); setReplyText(""); setReplyTo(null); loadComments(); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  async function deleteComment(commentId: string) {
    try { await api.delete(`/api/projects/tasks/${taskId}/comments/${commentId}`); loadComments(); toast.success("Comment deleted"); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  async function toggleReaction(commentId: string, emoji: string) {
    try { await api.post(`/api/projects/tasks/${taskId}/comments/${commentId}/reactions`, { emoji }); loadComments(); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  async function loadAttachments() {
    try { setAttachments(await api.get(`/api/projects/tasks/${taskId}/attachments`) as any[]); } catch {}
  }
  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.postForm(`/api/projects/tasks/${taskId}/attachments`, formData);
      toast.success("File uploaded");
      loadAttachments();
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    setUploading(false);
  }
  async function deleteAttachment(attId: string) {
    try { await api.delete(`/api/projects/tasks/${taskId}/attachments/${attId}`); loadAttachments(); toast.success("Attachment deleted"); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  function fmtFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  async function saveEdit() {
    if (!task) return;
    setSaving(true);
    try {
      await api.patch(`/api/projects/tasks/${task.id}`, {
        title: editForm.title, description: editForm.description || undefined,
        status: editForm.status, priority: editForm.priority,
        category: editForm.category || undefined,
        due_date: editForm.due_date || undefined,
        assignee_ids: editAssigneeIds,
      });
      toast.success("Task updated"); setEditing(false); loadTask();
    } catch (err: any) { toast.error(err.message || "Failed to update"); }
    setSaving(false);
  }
  async function handleDelete() {
    if (!confirm("Delete this task permanently?")) return;
    try { await api.delete(`/api/projects/tasks/${taskId}`); router.push(`/dashboard/projects/${projectId}`); toast.success("Task deleted"); } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  function toggleAssignee(uid: string) {
    setEditAssigneeIds((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]);
  }

  function daysDelayed(dueDate?: string) {
    if (!dueDate) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000));
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}><div className="loading-spinner" style={{ width: 28, height: 28 }} /></div>;
  if (!task) return <div style={{ padding: 60, textAlign: "center", color: "var(--text-tertiary)" }}>Task not found</div>;

  const sc = STATUS_CFG[task.status] || STATUS_CFG.todo;
  const pc = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium;
  const delayed = daysDelayed(task.due_date);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 12, color: "var(--text-quaternary)" }}>
        <button onClick={() => router.push(`/dashboard/projects/${projectId}`)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-blue)", fontSize: 12, fontWeight: 500, padding: 0 }}>Project</button>
        <span>/</span>
        <span>Tasks</span>
        <span>/</span>
        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{task.title}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} style={{ margin: 0, fontSize: 22, fontWeight: 700, padding: "6px 10px", width: "100%" }} />
          ) : (
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{task.title}</h1>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill {...sc} />
            <Pill {...pc} />
            {task.category && <Pill label={task.category} color="var(--accent-blue)" bg="var(--accent-blue-light)" />}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
          {editing ? (
            <>
              <button onClick={saveEdit} disabled={saving} className="btn-primary btn-sm">{saving ? "Saving..." : "Save"}</button>
              <button onClick={() => { setEditing(false); setEditForm({ title: task.title, description: task.description || "", status: task.status, priority: task.priority, category: task.category || "", due_date: task.due_date ? task.due_date.slice(0, 10) : "" }); setEditAssigneeIds((task.assignees || []).map((a) => a.user_id)); }} className="btn-secondary btn-sm">Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">
              <Icon path="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--border-primary)" }}>
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "10px 20px", fontSize: 13, fontWeight: activeTab === tab ? 600 : 500, cursor: "pointer",
            background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid var(--brand-primary)" : "2px solid transparent",
            color: activeTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
            textTransform: "capitalize", transition: "all var(--transition-fast)",
          }}>{tab === "details" ? "Details" : tab === "comments" ? `Comments (${comments.length})` : tab === "attachments" ? `Files (${attachments.length})` : "Settings"}</button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <>
          <SectionCard>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div>
                <FormField label="Status">
                  {editing ? (
                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={{ margin: 0 }}>
                      {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  ) : <Pill {...sc} />}
                </FormField>
              </div>
              <div>
                <FormField label="Priority">
                  {editing ? (
                    <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} style={{ margin: 0 }}>
                      {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  ) : <Pill {...pc} />}
                </FormField>
              </div>
              <div>
                <FormField label="Due Date">
                  {editing ? (
                    <input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} style={{ margin: 0 }} />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 500, color: delayed > 0 ? "var(--danger)" : "var(--text-secondary)" }}>
                      {fmtDate(task.due_date)}
                      {delayed > 0 && <span style={{ fontWeight: 700 }}> ({delayed}d late)</span>}
                    </span>
                  )}
                </FormField>
              </div>
              <div>
                <FormField label="Category">
                  {editing ? (
                    <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} placeholder="e.g. Sales" style={{ margin: 0 }} />
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{task.category || "—"}</span>
                  )}
                </FormField>
              </div>
              <div>
                <FormField label="Date Assigned">
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtDate(task.date_assigned)}</span>
                </FormField>
              </div>
              <div>
                <FormField label="Progress">
                  <ProgressBar value={task.progress_pct ?? 0} showLabel height={6} />
                </FormField>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <FormField label="Assignees">
              {editing ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {users.map((u) => (
                    <button key={u.id} type="button" onClick={() => toggleAssignee(u.id)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 14px 5px 6px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                      background: editAssigneeIds.includes(u.id) ? "var(--brand-primary)" : "var(--bg-tertiary)",
                      color: editAssigneeIds.includes(u.id) ? "#fff" : "var(--text-secondary)",
                      border: editAssigneeIds.includes(u.id) ? "none" : "1px solid var(--border-primary)",
                      transition: "all var(--transition-fast)",
                    }}>
                      <AvatarChip name={u.full_name} size={22} />
                      {u.full_name}
                    </button>
                  ))}
                </div>
              ) : (
                (task.assignees && task.assignees.length > 0) ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {task.assignees.map((a) => <AvatarChip key={a.user_id} name={a.user_name || "?"} size={28} showName />)}
                  </div>
                ) : <span style={{ fontSize: 13, color: "var(--text-quaternary)" }}>Unassigned</span>
              )}
            </FormField>
          </SectionCard>

          <SectionCard>
            <FormField label="Description">
              {editing ? (
                <textarea rows={4} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Add details..." style={{ margin: 0 }} />
              ) : (
                <p style={{ fontSize: 13, color: task.description ? "var(--text-secondary)" : "var(--text-quaternary)", lineHeight: 1.7 }}>{task.description || "No description provided."}</p>
              )}
            </FormField>
          </SectionCard>
        </>
      )}

      {/* Comments Tab */}
      {activeTab === "comments" && (() => {
        const topLevel = comments.filter((c) => !c.parent_id);
        const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

        const renderComment = (c: Comment, isReply = false) => (
          <div key={c.id} style={{ display: "flex", gap: 10, padding: isReply ? "10px 12px" : "12px 14px", background: isReply ? "var(--bg-secondary)" : "var(--bg-tertiary)", borderRadius: "var(--radius-md)", border: `1px solid var(--border-secondary)`, marginLeft: isReply ? 36 : 0 }}>
            <AvatarChip name={c.user_name || "?"} size={isReply ? 24 : 28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{c.user_name || "Unknown"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--text-quaternary)" }}>{fmtDateTime(c.created_at)}</span>
                  <button onClick={() => deleteComment(c.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-quaternary)", display: "flex" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-quaternary)"; }}>
                    <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={12} />
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{c.content}</p>
              {/* Reactions row */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                {(c.reactions || []).map((r) => (
                  <button key={r.emoji} onClick={() => toggleReaction(c.id, r.emoji)} style={{
                    display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", fontSize: 12,
                    borderRadius: "var(--radius-full)", cursor: "pointer", transition: "all var(--transition-fast)",
                    background: "var(--bg-tertiary)", border: "1px solid var(--border-secondary)",
                  }}>{emojiLabel(r.emoji)} <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>{r.count}</span></button>
                ))}
                {/* Add reaction picker */}
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <button title="Add reaction" style={{ background: "none", border: "1px dashed var(--border-primary)", borderRadius: "var(--radius-full)", padding: "2px 6px", cursor: "pointer", fontSize: 12, color: "var(--text-quaternary)", display: "flex", alignItems: "center" }}
                    onClick={(e) => {
                      const picker = e.currentTarget.nextElementSibling as HTMLElement;
                      if (picker) picker.style.display = picker.style.display === "flex" ? "none" : "flex";
                    }}>+</button>
                  <div style={{ display: "none", position: "absolute", bottom: "100%", left: 0, marginBottom: 4, background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", padding: 4, gap: 2, boxShadow: "var(--shadow-md)", zIndex: 10 }}>
                    {EMOJI_OPTIONS.map((eo) => (
                      <button key={eo.emoji} onClick={() => toggleReaction(c.id, eo.emoji)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 4px", borderRadius: "var(--radius-sm)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>{eo.label}</button>
                    ))}
                  </div>
                </div>
                {!isReply && (
                  <button onClick={() => setReplyTo({ id: c.id, user_name: c.user_name })} style={{
                    background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "var(--text-quaternary)", marginLeft: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-blue)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-quaternary)"; }}>Reply</button>
                )}
              </div>
            </div>
          </div>
        );

        return (
          <SectionCard>
            {topLevel.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {topLevel.map((c) => (
                  <div key={c.id}>
                    {renderComment(c)}
                    {getReplies(c.id).map((r) => renderComment(r, true))}
                    {replyTo?.id === c.id && (
                      <div style={{ marginLeft: 36, marginTop: 6, display: "flex", gap: 6 }}>
                        <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Reply to ${replyTo.user_name || "comment"}...`}
                          onKeyDown={(e) => e.key === "Enter" && addReply()} autoFocus
                          style={{ margin: 0, flex: 1, fontSize: 12, padding: "6px 10px" }} />
                        <button onClick={addReply} disabled={!replyText.trim()} className={replyText.trim() ? "btn-primary btn-sm" : "btn-secondary btn-sm"} style={{ fontSize: 11 }}>Reply</button>
                        <button onClick={() => { setReplyTo(null); setReplyText(""); }} className="btn-secondary btn-sm" style={{ fontSize: 11 }}>Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-quaternary)", marginBottom: 16, textAlign: "center", padding: "20px 0" }}>No comments yet</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..."
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                style={{ margin: 0, flex: 1, fontSize: 13, padding: "8px 12px" }} />
              <button onClick={addComment} disabled={!newComment.trim()} className={newComment.trim() ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Post</button>
            </div>
          </SectionCard>
        );
      })()}

      {/* Attachments Tab */}
      {activeTab === "attachments" && (
        <SectionCard>
          {/* Upload area */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent-blue)"; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-primary)"; }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border-primary)"; if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]); }}
            style={{
              border: "2px dashed var(--border-primary)", borderRadius: "var(--radius-lg)",
              padding: "24px 16px", textAlign: "center", marginBottom: 16,
              background: "var(--bg-tertiary)", transition: "border-color var(--transition-fast)", cursor: "pointer",
            }}
            onClick={() => {
              const inp = document.createElement("input");
              inp.type = "file"; inp.onchange = () => { if (inp.files?.[0]) uploadFile(inp.files[0]); };
              inp.click();
            }}
          >
            <Icon path="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={28} color="var(--text-quaternary)" />
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>
              {uploading ? "Uploading..." : "Drop file here or click to browse"}
            </p>
          </div>

          {/* File list */}
          {attachments.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {attachments.map((a) => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-secondary)",
                }}>
                  <Icon path="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6" size={18} color="var(--text-quaternary)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.filename}</div>
                    <div style={{ fontSize: 11, color: "var(--text-quaternary)" }}>{fmtFileSize(a.file_size)} · {a.user_name || "Unknown"} · {fmtDateTime(a.created_at)}</div>
                  </div>
                  <button onClick={async () => {
                    try {
                      const blob = await api.getBlob(`/api/projects/tasks/${taskId}/attachments/${a.id}/download`);
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url; link.download = a.filename; link.click();
                      URL.revokeObjectURL(url);
                    } catch (err: any) { toast.error(err.message || "Download failed"); }
                  }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-blue)", fontSize: 12, fontWeight: 500, padding: 0 }}>Download</button>
                  <button onClick={() => deleteAttachment(a.id)} title="Delete" style={{
                    background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-quaternary)", display: "flex",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-quaternary)"; }}>
                    <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-quaternary)", textAlign: "center", padding: "12px 0" }}>No attachments yet</p>
          )}
        </SectionCard>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <SectionCard>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <FormField label="Created">
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtDateTime(task.created_at)}</span>
              </FormField>
            </div>
            {task.updated_at && (
              <div>
                <FormField label="Last Updated">
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtDateTime(task.updated_at)}</span>
                </FormField>
              </div>
            )}
            <div style={{ height: 1, background: "var(--border-secondary)" }} />
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)", marginBottom: 8 }}>Danger Zone</h4>
              <button onClick={handleDelete} style={{
                background: "var(--danger-light)", color: "var(--danger)", border: "1px solid var(--danger)",
                borderRadius: "var(--radius-md)", padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, transition: "all var(--transition-fast)",
              }}>
                <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={14} />
                Delete Task
              </button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
