"use client";

import { useEffect, useCallback, useState } from "react";
import { Icon } from "./Icon";
import { Pill } from "./Pill";
import { AvatarChip } from "./AvatarChip";
import { AvatarStack } from "./AvatarStack";
import { FormField } from "./FormField";

/**
 * Shared TaskModal — centered modal for task create/view/edit.
 * Supports tabs: Description | Comment | Setting
 * Used from Kanban "+" button (create) and task card click (view/edit).
 */

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: "To Do", color: "var(--info)", bg: "var(--info-light)" },
  in_progress: { label: "In Progress", color: "#7c3aed", bg: "#f5f3ff" },
  review: { label: "In Review", color: "#b45309", bg: "#fffbeb" },
  blocked: { label: "Blocked", color: "var(--danger)", bg: "var(--danger-light)" },
  done: { label: "Completed", color: "var(--success)", bg: "var(--success-light)" },
};

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "var(--info)", bg: "var(--info-light)" },
  medium: { label: "Medium", color: "#7c3aed", bg: "#f5f3ff" },
  high: { label: "High", color: "#b45309", bg: "#fffbeb" },
  urgent: { label: "Urgent", color: "var(--danger)", bg: "var(--danger-light)" },
};

type TabKey = "description" | "comment" | "setting";

export interface TaskModalUser {
  id: string;
  full_name: string;
}

export interface TaskModalComment {
  id: string;
  user_name?: string;
  content: string;
  created_at: string;
}

export interface TaskModalData {
  id?: string;
  title?: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  due_date?: string;
  assignee_ids?: string[];
}

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initialData: TaskModalData;
  users: TaskModalUser[];
  comments?: TaskModalComment[];
  commentCount?: number;
  onSave: (data: TaskModalData) => void;
  onAddComment?: (content: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onDelete?: () => void;
  saving?: boolean;
}

function MetaRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: 120, flexShrink: 0 }}>
        <Icon path={icon} size={14} color="var(--text-quaternary)" />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-tertiary)" }}>{label}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function fmtRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function TaskModal({
  open,
  onClose,
  mode,
  initialData,
  users,
  comments = [],
  commentCount,
  onSave,
  onAddComment,
  onDeleteComment,
  onDelete,
  saving = false,
}: TaskModalProps) {
  const [form, setForm] = useState<TaskModalData>(initialData);
  const [activeTab, setActiveTab] = useState<TabKey>("description");
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    setForm(initialData);
    setActiveTab("description");
    setNewComment("");
  }, [open, initialData]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  function updateField(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleAssignee(userId: string) {
    const ids = form.assignee_ids || [];
    const next = ids.includes(userId) ? ids.filter((x) => x !== userId) : [...ids, userId];
    updateField("assignee_ids", next);
  }

  function handleSave() {
    onSave(form);
  }

  function handleAddComment() {
    if (!newComment.trim() || !onAddComment) return;
    onAddComment(newComment.trim());
    setNewComment("");
  }

  const assigneeNames = (form.assignee_ids || []).map((uid) => {
    const u = users.find((x) => x.id === uid);
    return u?.full_name || "?";
  });

  const sc = STATUS_CFG[form.status] || STATUS_CFG.todo;
  const pc = PRIORITY_CFG[form.priority] || PRIORITY_CFG.medium;

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: "description", label: "Description" },
    { key: "comment", label: "Comments", count: commentCount ?? comments.length },
    { key: "setting", label: "Setting" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          zIndex: 1040,
          animation: "fadeIn 0.2s ease-out",
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "var(--bg-secondary)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-xl)",
          zIndex: 1050,
          width: 640,
          maxWidth: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.014em" }}>
            {mode === "create" ? "Create Task" : (form.title || "Task")}
          </h2>
          <div style={{ display: "flex", gap: 6 }}>
            {mode === "edit" && (
              <>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-quaternary)", borderRadius: "var(--radius-sm)" }}
                  aria-label="Bookmark"
                >
                  <Icon path="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" size={16} />
                </button>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-quaternary)", borderRadius: "var(--radius-sm)" }}
                  aria-label="Copy link"
                >
                  <Icon path="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" size={16} />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-quaternary)", borderRadius: "var(--radius-sm)" }}
              aria-label="Close"
            >
              <Icon path="M18 6L6 18M6 6l12 12" size={16} />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {/* Title (create mode) */}
          {mode === "create" && (
            <div style={{ marginBottom: 16 }}>
              <input
                value={form.title || ""}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Task title"
                style={{ margin: 0, fontSize: 16, fontWeight: 600, padding: "8px 12px", width: "100%" }}
                autoFocus
              />
            </div>
          )}

          {/* Metadata rows */}
          <MetaRow icon="M22 11.08V12a10 10 0 11-5.93-9.14" label="Status">
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              style={{
                margin: 0, padding: "4px 10px", fontSize: 12, fontWeight: 600, width: "auto",
                background: sc.bg, color: sc.color, border: "none", borderRadius: "var(--radius-full)", cursor: "pointer",
              }}
            >
              {Object.entries(STATUS_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </MetaRow>

          <MetaRow icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" label="Due date">
            <input
              type="date"
              value={form.due_date ? String(form.due_date).slice(0, 10) : ""}
              onChange={(e) => updateField("due_date", e.target.value)}
              style={{ margin: 0, padding: "4px 10px", fontSize: 12, width: "auto", border: "1px solid var(--border-secondary)", borderRadius: "var(--radius-sm)" }}
            />
          </MetaRow>

          <MetaRow icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" label="Assignee">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {(form.assignee_ids || []).map((uid) => {
                const u = users.find((x) => x.id === uid);
                return (
                  <AvatarChip
                    key={uid}
                    name={u?.full_name || "?"}
                    size={22}
                    showName
                    removable
                    onRemove={() => toggleAssignee(uid)}
                  />
                );
              })}
              <div style={{ position: "relative" }}>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) toggleAssignee(e.target.value);
                  }}
                  style={{
                    margin: 0, padding: "2px 6px", fontSize: 14, width: 28, height: 28,
                    background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)",
                    borderRadius: "50%", cursor: "pointer", color: "var(--text-tertiary)",
                    appearance: "none", textAlign: "center",
                  }}
                  title="Add assignee"
                >
                  <option value="">+</option>
                  {users.filter((u) => !(form.assignee_ids || []).includes(u.id)).map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </MetaRow>

          <MetaRow icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" label="Tags">
            <input
              value={form.category || ""}
              onChange={(e) => updateField("category", e.target.value)}
              placeholder="Add tag..."
              style={{ margin: 0, padding: "4px 10px", fontSize: 12, border: "1px solid var(--border-secondary)", borderRadius: "var(--radius-sm)", width: 160 }}
            />
          </MetaRow>

          <MetaRow icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" label="Priority">
            <select
              value={form.priority}
              onChange={(e) => updateField("priority", e.target.value)}
              style={{
                margin: 0, padding: "4px 10px", fontSize: 12, fontWeight: 600, width: "auto",
                background: pc.bg, color: pc.color, border: "none", borderRadius: "var(--radius-full)", cursor: "pointer",
              }}
            >
              {Object.entries(PRIORITY_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </MetaRow>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-primary)", marginTop: 20, marginBottom: 16 }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: activeTab === tab.key ? 600 : 500,
                  color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-tertiary)",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab.key ? "2px solid var(--text-primary)" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, background: "var(--bg-tertiary)", color: "var(--text-tertiary)",
                    padding: "1px 6px", borderRadius: "var(--radius-full)",
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "description" && (
            <div>
              <textarea
                value={form.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Add a description..."
                rows={4}
                style={{ margin: 0, resize: "vertical", fontSize: 13 }}
              />
            </div>
          )}

          {activeTab === "comment" && (
            <div>
              {comments.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-quaternary)", textAlign: "center", padding: "20px 0" }}>
                  No comments yet
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                  {comments.map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: 10 }}>
                      <AvatarChip name={c.user_name || "?"} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.user_name || "Unknown"}</span>
                          <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>{fmtRelativeTime(c.created_at)}</span>
                        </div>
                        <div style={{
                          padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-secondary)", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5,
                        }}>
                          {c.content}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                          <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "var(--text-quaternary)", padding: 0 }}>Reply</button>
                          <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "var(--text-quaternary)", padding: 0 }}>Like</button>
                          {onDeleteComment && (
                            <button onClick={() => onDeleteComment(c.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "var(--text-quaternary)", padding: 0 }}>Delete</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment */}
              {onAddComment && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AvatarChip name="You" size={32} />
                  <div style={{ flex: 1 }}>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                      placeholder="Add a comment"
                      rows={2}
                      style={{ margin: 0, fontSize: 13, resize: "none" }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "setting" && (
            <div>
              <FormField label="Category">
                <input
                  value={form.category || ""}
                  onChange={(e) => updateField("category", e.target.value)}
                  placeholder="e.g. Design, Development"
                  style={{ margin: 0 }}
                />
              </FormField>
              {mode === "edit" && onDelete && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-secondary)" }}>
                  <button
                    onClick={onDelete}
                    className="btn-danger btn-sm"
                  >
                    <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={14} />
                    Delete Task
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-secondary)",
        }}>
          {/* Collaborators */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>Collaborators</span>
            {assigneeNames.length > 0 && <AvatarStack names={assigneeNames} max={3} size={24} />}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || (mode === "create" && !form.title?.trim())} className="btn-primary btn-sm">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
