"use client";

import { Icon } from "./Icon";
import { Pill } from "./Pill";
import { AvatarStack } from "./AvatarStack";
import { ProgressBar } from "./ProgressBar";

/**
 * Shared TaskCard — Kanban board card showing task summary.
 * Used in My Task Kanban and Project Kanban views.
 */

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "var(--info)", bg: "var(--info-light)" },
  medium: { label: "Medium", color: "#7c3aed", bg: "#f5f3ff" },
  high: { label: "High", color: "#b45309", bg: "#fffbeb" },
  urgent: { label: "Urgent", color: "var(--danger)", bg: "var(--danger-light)" },
};

export interface TaskCardData {
  id: string;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  progress_pct?: number;
  assignee_names?: string[];
  comment_count?: number;
  attachment_count?: number;
}

interface TaskCardProps {
  task: TaskCardData;
  onClick?: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
}

function fmtCardDate(d?: string) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TaskCard({ task, onClick, onMenuClick }: TaskCardProps) {
  const pc = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium;

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all var(--transition-fast)",
        boxShadow: "var(--shadow-xs)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-hover)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-primary)";
        e.currentTarget.style.boxShadow = "var(--shadow-xs)";
      }}
    >
      {/* Header: title + menu */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </span>
        {onMenuClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-quaternary)", flexShrink: 0, marginLeft: 4 }}
            aria-label="Task menu"
          >
            <Icon path="M12 5v.01M12 12v.01M12 19v.01" size={16} />
          </button>
        )}
      </div>

      {/* Priority + Due date */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Pill label={pc.label} color={pc.color} bg={pc.bg} />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
          {fmtCardDate(task.due_date)}
        </span>
      </div>

      {/* Description */}
      {task.description && (
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.4, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.description}
        </p>
      )}

      {/* Progress */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-quaternary)", fontWeight: 500 }}>Progress</span>
          <span style={{ fontSize: 11, color: "var(--text-quaternary)", fontWeight: 500 }}>:</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>{Math.round(task.progress_pct ?? 0)}%</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <ProgressBar value={task.progress_pct ?? 0} height={4} />
        </div>
      </div>

      {/* Footer: avatars + comment/attachment counts */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {task.assignee_names && task.assignee_names.length > 0 ? (
          <AvatarStack names={task.assignee_names} max={3} size={22} />
        ) : (
          <span />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(task.comment_count ?? 0) > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-quaternary)" }}>
              <Icon path="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" size={12} />
              {task.comment_count}
            </span>
          )}
          {(task.attachment_count ?? 0) > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-quaternary)" }}>
              <Icon path="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" size={12} />
              {task.attachment_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
