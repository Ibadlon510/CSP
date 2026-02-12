"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { TaskCard, type TaskCardData } from "@/components/ui/TaskCard";
import { KanbanBoard, type KanbanColumn } from "@/components/ui/KanbanBoard";
import { TaskModal, type TaskModalData, type TaskModalUser, type TaskModalComment } from "@/components/ui/TaskModal";
import { SlideOverPanel } from "@/components/ui/SlideOverPanel";
import { FormField } from "@/components/ui/FormField";
import { fmtDate } from "@/lib/format";

type Assignee = { user_id: string; user_name?: string };
type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  start_date?: string;
  due_date?: string;
  date_assigned?: string;
  assigned_to?: string;
  assignee_name?: string;
  assignees?: Assignee[];
  parent_id?: string;
  subtask_count?: number;
  progress_pct?: number;
  comment_count?: number;
  subtasks?: Task[];
  created_at: string;
};

type ActivityItem = {
  id: string;
  title: string;
  description?: string;
  activity_type: string;
  contact_id?: string;
  contact_name?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  created_by?: string;
  created_by_name?: string;
  project_title?: string;
  start_datetime: string;
  end_datetime: string;
  location?: string;
  status: string;
  reminder: string;
  recurrence: string;
  completion_notes?: string;
  is_overdue: boolean;
};

type UserOption = { id: string; full_name: string };

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: "To Do",       color: "var(--info)",    bg: "var(--info-light)" },
  in_progress: { label: "In Progress", color: "#7c3aed",       bg: "#f5f3ff" },
  blocked:     { label: "Blocked",     color: "var(--danger)",  bg: "var(--danger-light)" },
  review:      { label: "Review",      color: "#b45309",       bg: "#fffbeb" },
  done:        { label: "Done",        color: "var(--success)", bg: "var(--success-light)" },
};
const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: "Low",    color: "var(--info)",    bg: "var(--info-light)" },
  medium: { label: "Medium", color: "#7c3aed",        bg: "#f5f3ff" },
  high:   { label: "High",   color: "#b45309",        bg: "#fffbeb" },
  urgent: { label: "Urgent", color: "var(--danger)",   bg: "var(--danger-light)" },
};

const ACTIVITY_TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  call:      { label: "Call",      color: "#0369a1", bg: "#e0f2fe" },
  meeting:   { label: "Meeting",   color: "#7c3aed", bg: "#f5f3ff" },
  follow_up: { label: "Follow-up", color: "#b45309", bg: "#fffbeb" },
  visit:     { label: "Visit",     color: "#047857", bg: "#ecfdf5" },
  other:     { label: "Other",     color: "var(--text-tertiary)", bg: "var(--bg-tertiary)" },
};
const RECURRENCE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const REMINDER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "15min", label: "15 min before" },
  { value: "30min", label: "30 min before" },
  { value: "1hr", label: "1 hour before" },
  { value: "1day", label: "1 day before" },
];

const STATUS_ORDER = ["todo", "in_progress", "review", "done"];

const KANBAN_COLUMNS: KanbanColumn[] = STATUS_ORDER.map((s) => ({
  id: s,
  label: (STATUS_CFG[s] || STATUS_CFG.todo).label,
  color: (STATUS_CFG[s] || STATUS_CFG.todo).color,
  bg: (STATUS_CFG[s] || STATUS_CFG.todo).bg,
}));

export default function TasksTab({
  projectId,
  tasks,
  onReload,
}: {
  projectId: string;
  tasks: Task[];
  onReload: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Activity state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [newAct, setNewAct] = useState({ title: "", description: "", activity_type: "call", assigned_to_ids: [] as string[], start_datetime: "", end_datetime: "", location: "", reminder: "none", recurrence: "none" });
  const [completionModal, setCompletionModal] = useState<{ id: string; title: string } | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  useEffect(() => {
    loadUsers(); loadActivities();
    getMe().then((u) => setCurrentUserId(u.id)).catch(() => {});
  }, []);

  async function loadUsers() {
    try { const res = await api.get("/api/users/") as any[]; setUsers(res.map((u: any) => ({ id: u.id, full_name: u.full_name }))); } catch {}
  }

  async function loadActivities() {
    try { const res = await api.get(`/api/activities/project/${projectId}`) as ActivityItem[]; setActivities(res); } catch {}
  }

  function openNewActivityForm() {
    const now = new Date();
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const endISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000 + 3600000).toISOString().slice(0, 16);
    setNewAct({ title: "", description: "", activity_type: "call", assigned_to_ids: currentUserId ? [currentUserId] : [], start_datetime: localISO, end_datetime: endISO, location: "", reminder: "none", recurrence: "none" });
    setShowNewActivity(true);
  }

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/api/activities/project/${projectId}`, {
        title: newAct.title,
        description: newAct.description || undefined,
        activity_type: newAct.activity_type,
        assigned_to_ids: newAct.assigned_to_ids,
        start_datetime: newAct.start_datetime,
        end_datetime: newAct.end_datetime,
        location: newAct.location || undefined,
        reminder: newAct.reminder,
        recurrence: newAct.recurrence,
      });
      setNewAct({ title: "", description: "", activity_type: "call", assigned_to_ids: [], start_datetime: "", end_datetime: "", location: "", reminder: "none", recurrence: "none" });
      setShowNewActivity(false);
      loadActivities();
      toast.success("Activity created");
    } catch (err: any) { toast.error(err.message || "Failed to create activity"); }
  }

  async function toggleActivityStatus(act: ActivityItem) {
    if (act.status === "pending") {
      setCompletionModal({ id: act.id, title: act.title });
      setCompletionNotes("");
    } else {
      try {
        await api.patch(`/api/activities/${act.id}`, { status: "pending", completion_notes: "" });
        loadActivities();
      } catch (err: any) { toast.error(err.message || "Failed"); }
    }
  }

  async function submitCompletion() {
    if (!completionModal) return;
    try {
      await api.patch(`/api/activities/${completionModal.id}`, { status: "completed", completion_notes: completionNotes || undefined });
      setCompletionModal(null);
      setCompletionNotes("");
      loadActivities();
      toast.success("Activity completed");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function deleteActivity(id: string) {
    if (!confirm("Delete this activity?")) return;
    try { await api.delete(`/api/activities/${id}`); loadActivities(); toast.success("Activity deleted"); } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  // Group activities by date for display
  function groupActivitiesByDate(acts: ActivityItem[]) {
    const groups: Record<string, ActivityItem[]> = {};
    for (const a of acts) {
      const dateKey = new Date(a.start_datetime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(a);
    }
    return groups;
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    try { await api.delete(`/api/projects/tasks/${taskId}`); onReload(); toast.success("Task deleted"); } catch (err: any) { toast.error(err.message || "Failed"); }
  }
  function daysDelayed(dueDate?: string) {
    if (!dueDate) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000));
  }

  // ─── View mode + search/filter ───
  const [viewMode, setViewMode] = useState("spreadsheet");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ status: [], priority: [] });
  const [groupBy, setGroupBy] = useState("");

  const taskFilterConfig: FilterFieldConfig[] = useMemo(() => [
    { key: "status", label: "Status", options: STATUS_ORDER.map((s) => ({ value: s, label: (STATUS_CFG[s] || STATUS_CFG.todo).label })) },
    { key: "priority", label: "Priority", options: ["low", "medium", "high", "urgent"].map((p) => ({ value: p, label: (PRIORITY_CFG[p] || PRIORITY_CFG.medium).label })) },
  ], []);
  const taskGroupOptions = useMemo(() => [
    { value: "status", label: "Status" },
    { value: "priority", label: "Priority" },
  ], []);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    if (filters.status?.length) list = list.filter((t) => filters.status.includes(t.status));
    if (filters.priority?.length) list = list.filter((t) => filters.priority.includes(t.priority));
    return list;
  }, [tasks, search, filters]);

  const parentTasks = filteredTasks.filter((t) => !t.parent_id);

  // ─── Task Modal ───
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalData, setModalData] = useState<TaskModalData>({ status: "todo", priority: "medium" });
  const [modalComments, setModalComments] = useState<TaskModalComment[]>([]);

  function openCreateModal(status = "todo") {
    setModalMode("create");
    setModalData({ status, priority: "medium" });
    setModalComments([]);
    setModalOpen(true);
  }

  function openEditModal(task: Task) {
    setModalMode("edit");
    setModalData({
      id: task.id, title: task.title, description: task.description,
      status: task.status, priority: task.priority, category: task.category,
      due_date: task.due_date, assignee_ids: task.assignees?.map((a) => a.user_id) || [],
    });
    api.get(`/api/projects/tasks/${task.id}/comments`).then((d: any) => setModalComments(d as TaskModalComment[])).catch(() => setModalComments([]));
    setModalOpen(true);
  }

  async function handleModalSave(data: TaskModalData) {
    setSaving(true);
    try {
      if (modalMode === "create" && data.title) {
        await api.post(`/api/projects/${projectId}/tasks`, {
          project_id: projectId, title: data.title, description: data.description,
          status: data.status, priority: data.priority, category: data.category,
          due_date: data.due_date || null, assignee_ids: data.assignee_ids || [],
        });
        toast.success("Task created");
      } else if (data.id) {
        await api.patch(`/api/projects/tasks/${data.id}`, {
          title: data.title, description: data.description, status: data.status,
          priority: data.priority, category: data.category,
          due_date: data.due_date || null, assignee_ids: data.assignee_ids || [],
        });
        toast.success("Task updated");
      }
      setModalOpen(false);
      onReload();
    } catch (err: any) { toast.error(err.message || "Failed"); }
    setSaving(false);
  }

  async function handleAddComment(content: string) {
    if (!modalData.id) return;
    try {
      const c: any = await api.post(`/api/projects/tasks/${modalData.id}/comments`, { content });
      setModalComments((prev) => [...prev, c]);
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function handleDeleteComment(commentId: string) {
    if (!modalData.id) return;
    try {
      await api.delete(`/api/projects/tasks/${modalData.id}/comments/${commentId}`);
      setModalComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  function toggleAssignee(list: string[], setList: (v: string[]) => void, uid: string) {
    setList(list.includes(uid) ? list.filter((x) => x !== uid) : [...list, uid]);
  }

  // ─── Derived data ───
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    STATUS_ORDER.forEach((s) => { groups[s] = []; });
    filteredTasks.forEach((t) => {
      if (!t.parent_id) {
        const key = STATUS_ORDER.includes(t.status) ? t.status : "todo";
        groups[key].push(t);
      }
    });
    return groups;
  }, [filteredTasks]);

  const kanbanCards = useMemo(() => {
    const result: Record<string, TaskCardData[]> = {};
    for (const [status, list] of Object.entries(tasksByStatus)) {
      result[status] = list.map(taskToCard);
    }
    return result;
  }, [tasksByStatus]);

  function taskToCard(t: Task): TaskCardData {
    return {
      id: t.id, title: t.title, description: t.description, priority: t.priority,
      due_date: t.due_date, progress_pct: t.progress_pct,
      assignee_names: t.assignees?.map((a) => a.user_name || "?") || [],
      comment_count: t.comment_count, attachment_count: 0,
    };
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      {/* ═══════ Header ═══════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-quaternary)" }}>Tasks</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-full)" }}>{parentTasks.length}</span>
        </div>
        <button className="btn-primary btn-sm" onClick={() => openCreateModal()}>
          <Icon path="M12 4v16m8-8H4" size={14} /> Add Task
        </button>
      </div>

      {/* ═══════ Search + View Toggle ═══════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={taskFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={taskGroupOptions} pageKey={`project_tasks_${projectId}`} placeholder="Search tasks..." />
        <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
      </div>

      {/* ═══════ Spreadsheet View ═══════ */}
      {viewMode === "spreadsheet" && (
        parentTasks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-quaternary)", border: "2px dashed var(--border-primary)", borderRadius: "var(--radius-lg)", background: "var(--bg-tertiary)" }}>
            <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={36} color="var(--border-primary)" />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 500 }}>No tasks yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click &quot;Add Task&quot; to get started</div>
          </div>
        ) : (
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
            {STATUS_ORDER.map((status) => {
              const sc = STATUS_CFG[status] || STATUS_CFG.todo;
              const colTasks = tasksByStatus[status] || [];
              if (colTasks.length === 0) return null;
              return (
                <div key={status}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-primary)" }}>
                    <Pill label={sc.label} color={sc.color} bg={sc.bg} size="md" />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)" }}>{colTasks.length}</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                        <th style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>Task</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>Assignees</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>Due Date</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>Priority</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>Progress</th>
                        <th style={{ width: 60, padding: "8px 8px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {colTasks.map((task) => {
                        const pc = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium;
                        const delayed = daysDelayed(task.due_date);
                        return (
                          <tr key={task.id} onClick={() => openEditModal(task)}
                            style={{ cursor: "pointer", borderBottom: "1px solid var(--border-secondary)", transition: "background var(--transition-fast)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                            <td style={{ padding: "10px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{task.title}</span>
                                {task.category && <Pill label={task.category} color="var(--accent-blue)" bg="var(--accent-blue-light)" />}
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {task.assignees && task.assignees.length > 0
                                ? <AvatarStack names={task.assignees.map((a) => a.user_name || "?")} max={3} size={22} />
                                : <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: 12, color: delayed > 0 ? "var(--danger)" : "var(--text-secondary)" }}>
                              {fmtDate(task.due_date)}
                              {delayed > 0 && <span style={{ fontWeight: 700, marginLeft: 4 }}>({delayed}d)</span>}
                            </td>
                            <td style={{ padding: "10px 12px" }}><Pill label={pc.label} color={pc.color} bg={pc.bg} /></td>
                            <td style={{ padding: "10px 12px", minWidth: 80 }}><ProgressBar value={task.progress_pct ?? 0} showLabel /></td>
                            <td style={{ padding: "10px 8px" }} onClick={(e) => e.stopPropagation()}>
                              <button title="Open full page" onClick={() => router.push(`/dashboard/projects/${projectId}/tasks/${task.id}`)} style={{
                                background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 4, color: "var(--text-quaternary)",
                              }}>
                                <Icon path="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ═══════ Kanban View (Drag & Drop) ═══════ */}
      {viewMode === "kanban" && (
        <KanbanBoard
          columns={KANBAN_COLUMNS}
          tasksByColumn={kanbanCards}
          onTaskClick={(id) => { const t = tasks.find((x) => x.id === id); if (t) openEditModal(t); }}
          onAddTask={(colId) => openCreateModal(colId)}
          onDragEnd={async (taskId, _src, dest, destIdx) => {
            try {
              await api.patch(`/api/projects/tasks/${taskId}`, { status: dest, sort_order: destIdx });
              onReload();
            } catch (err: any) { toast.error(err.message || "Failed to move task"); }
          }}
        />
      )}

      {/* ═══════ Timeline / Gantt View ═══════ */}
      {viewMode === "timeline" && (() => {
        const ROW_H = 36;
        const LABEL_W = 180;
        const DAY_W = 40;

        // Compute date range from tasks
        const allDates = parentTasks.flatMap((t) => {
          const d: number[] = [];
          if (t.due_date) d.push(new Date(t.due_date).getTime());
          if (t.start_date) d.push(new Date(t.start_date).getTime());
          if (t.created_at) d.push(new Date(t.created_at).getTime());
          return d;
        });
        const now = Date.now();
        const rangeStart = allDates.length > 0 ? Math.min(...allDates, now) : now;
        const rangeEnd = allDates.length > 0 ? Math.max(...allDates, now + 14 * 86400000) : now + 30 * 86400000;
        const startDate = new Date(rangeStart - 2 * 86400000);
        startDate.setHours(0, 0, 0, 0);
        const totalDays = Math.max(14, Math.ceil((rangeEnd - startDate.getTime()) / 86400000) + 4);
        const days = Array.from({ length: totalDays }, (_, i) => new Date(startDate.getTime() + i * 86400000));

        const dayToX = (d: Date) => ((d.getTime() - startDate.getTime()) / 86400000) * DAY_W;

        return (
          <div className="card" style={{ padding: "16px 20px" }}>
            {parentTasks.length === 0 ? (
              <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-quaternary)", fontSize: 13 }}>No tasks to display on timeline</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "flex", minWidth: LABEL_W + totalDays * DAY_W }}>
                  {/* Task label column */}
                  <div style={{ width: LABEL_W, flexShrink: 0, borderRight: "1px solid var(--border-primary)" }}>
                    <div style={{ height: 28, borderBottom: "1px solid var(--border-primary)" }} />
                    {parentTasks.map((t) => (
                      <div key={t.id} onClick={() => openEditModal(t)} style={{
                        height: ROW_H, display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
                        fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", cursor: "pointer",
                        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                        borderBottom: "1px solid var(--border-secondary)",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: (STATUS_CFG[t.status] || STATUS_CFG.todo).color, flexShrink: 0 }} />
                        {t.title}
                      </div>
                    ))}
                  </div>
                  {/* Chart area */}
                  <div style={{ flex: 1, position: "relative" }}>
                    {/* Day header */}
                    <div style={{ display: "flex", height: 28, borderBottom: "1px solid var(--border-primary)" }}>
                      {days.map((d, i) => {
                        const isToday = d.toDateString() === new Date().toDateString();
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div key={i} style={{
                            width: DAY_W, flexShrink: 0, textAlign: "center", fontSize: 9, fontWeight: isToday ? 700 : 500,
                            color: isToday ? "var(--accent-blue)" : isWeekend ? "var(--text-quaternary)" : "var(--text-tertiary)",
                            lineHeight: "28px", borderRight: "1px solid var(--border-secondary)",
                          }}>{d.getDate()}</div>
                        );
                      })}
                    </div>
                    {/* Task rows with bars */}
                    {parentTasks.map((t, idx) => {
                      const sc = STATUS_CFG[t.status] || STATUS_CFG.todo;
                      const tStart = t.start_date ? new Date(t.start_date) : t.created_at ? new Date(t.created_at) : new Date();
                      const tEnd = t.due_date ? new Date(t.due_date) : new Date(tStart.getTime() + 3 * 86400000);
                      const left = dayToX(tStart);
                      const width = Math.max(DAY_W, dayToX(tEnd) - left);
                      return (
                        <div key={t.id} style={{ height: ROW_H, position: "relative", borderBottom: "1px solid var(--border-secondary)" }}>
                          {/* Grid lines */}
                          {days.map((d, i) => (
                            <div key={i} style={{
                              position: "absolute", left: i * DAY_W, top: 0, bottom: 0, width: DAY_W,
                              borderRight: "1px solid var(--border-secondary)",
                              background: d.toDateString() === new Date().toDateString() ? "var(--accent-blue-light)" : (d.getDay() === 0 || d.getDay() === 6) ? "var(--bg-tertiary)" : "transparent",
                              opacity: 0.5,
                            }} />
                          ))}
                          {/* Bar */}
                          <div onClick={() => openEditModal(t)} style={{
                            position: "absolute", top: 8, height: ROW_H - 16, left, width,
                            background: sc.bg, border: `1px solid ${sc.color}40`, borderRadius: "var(--radius-sm)",
                            cursor: "pointer", display: "flex", alignItems: "center", padding: "0 6px", overflow: "hidden", zIndex: 2,
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: sc.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════ Scheduled Activities Section ═══════ */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-quaternary)" }}>Scheduled Activities</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-full)" }}>{activities.length}</span>
          </div>
          <button className="btn-primary btn-sm" onClick={openNewActivityForm}>
            <Icon path="M12 4v16m8-8H4" size={14} /> Add Activity
          </button>
        </div>

        {activities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-quaternary)", border: "2px dashed var(--border-primary)", borderRadius: "var(--radius-lg)", background: "var(--bg-tertiary)" }}>
            <Icon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={36} color="var(--border-primary)" />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 500 }}>No activities scheduled</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click &quot;Add Activity&quot; to schedule one</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(groupActivitiesByDate(activities)).map(([dateLabel, acts]) => (
              <div key={dateLabel}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, paddingLeft: 4 }}>{dateLabel}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {acts.map((act) => {
                    const typeCfg = ACTIVITY_TYPE_CFG[act.activity_type] || ACTIVITY_TYPE_CFG.other;
                    const startTime = new Date(act.start_datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                    const endTime = new Date(act.end_datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                    return (
                      <div key={act.id} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                        background: "var(--bg-secondary)", borderRadius: "var(--radius-md)",
                        border: `1px solid ${act.is_overdue ? "var(--danger)" : "var(--border-primary)"}`,
                        boxShadow: "var(--shadow-xs)", opacity: act.status === "completed" ? 0.65 : 1,
                      }}>
                        <input type="checkbox" checked={act.status === "completed"} onChange={() => toggleActivityStatus(act)} style={{ cursor: "pointer", width: 16, height: 16, flexShrink: 0 }} />
                        <div style={{ width: 110, flexShrink: 0, fontSize: 12, fontWeight: 600, color: act.is_overdue ? "var(--danger)" : "var(--text-secondary)" }}>{startTime} – {endTime}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", textDecoration: act.status === "completed" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{act.title}</span>
                            <Pill label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />
                            {act.recurrence !== "none" && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-quaternary)", background: "var(--bg-tertiary)", padding: "1px 6px", borderRadius: "var(--radius-full)" }}>↻ {act.recurrence}</span>}
                            {act.is_overdue && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--danger)" }}>OVERDUE</span>}
                          </div>
                          {act.location && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Icon path="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" size={12} /> {act.location}</div>}
                          {act.completion_notes && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontStyle: "italic" }}>Notes: {act.completion_notes}</div>}
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {act.assigned_to_name ? <AvatarChip name={act.assigned_to_name} size={22} /> : <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>—</span>}
                        </div>
                        {act.contact_name && <Pill label={act.contact_name} color="#0369a1" bg="#e0f2fe" />}
                        <button title="Delete" onClick={() => deleteActivity(act.id)} style={{
                          background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 4, color: "var(--text-quaternary)", flexShrink: 0,
                        }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                           onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-quaternary)"; }}>
                          <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ Completion Notes Modal ═══════ */}
      {completionModal && (
        <>
          <div onClick={() => setCompletionModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1060 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", padding: "24px 28px", boxShadow: "var(--shadow-xl)", zIndex: 1070, width: 420, maxWidth: "90vw" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Complete Activity</h3>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>{completionModal.title}</p>
            <FormField label="Outcome / Notes (optional)">
              <textarea rows={3} value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="What was the outcome?" style={{ margin: 0 }} />
            </FormField>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={submitCompletion} className="btn-primary" style={{ flex: 1 }}>Mark Complete</button>
              <button onClick={() => setCompletionModal(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ═══════ Task Modal (Create / Edit) ═══════ */}
      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        initialData={modalData}
        users={users}
        comments={modalComments}
        onSave={handleModalSave}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onDelete={modalMode === "edit" && modalData.id ? () => deleteTask(modalData.id!) : undefined}
        saving={saving}
      />

      {/* ═══════ Add Activity SlideOver ═══════ */}
      <SlideOverPanel open={showNewActivity} onClose={() => setShowNewActivity(false)} title="New Activity" subtitle="Schedule a new activity for this project">
        <form onSubmit={handleCreateActivity} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, padding: "20px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
              <FormField label="Title" required><input type="text" value={newAct.title} onChange={(e) => setNewAct({ ...newAct, title: e.target.value })} required placeholder="Activity title" style={{ margin: 0 }} /></FormField>
              <FormField label="Type">
                <select value={newAct.activity_type} onChange={(e) => setNewAct({ ...newAct, activity_type: e.target.value })} style={{ margin: 0 }}>
                  {Object.entries(ACTIVITY_TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <FormField label="Start" required><input type="datetime-local" value={newAct.start_datetime} onChange={(e) => setNewAct({ ...newAct, start_datetime: e.target.value })} required style={{ margin: 0 }} /></FormField>
              <FormField label="End" required><input type="datetime-local" value={newAct.end_datetime} onChange={(e) => setNewAct({ ...newAct, end_datetime: e.target.value })} required style={{ margin: 0 }} /></FormField>
            </div>
            <div style={{ marginBottom: 14 }}><FormField label="Location"><input type="text" value={newAct.location} onChange={(e) => setNewAct({ ...newAct, location: e.target.value })} placeholder="Optional" style={{ margin: 0 }} /></FormField></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <FormField label="Assign To">
                <div style={{ border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", padding: "6px 8px", maxHeight: 120, overflowY: "auto", background: "var(--bg-secondary)" }}>
                  {users.map((u) => (
                    <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px", cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={newAct.assigned_to_ids.includes(u.id)} onChange={(e) => {
                        const ids = e.target.checked ? [...newAct.assigned_to_ids, u.id] : newAct.assigned_to_ids.filter((id) => id !== u.id);
                        setNewAct({ ...newAct, assigned_to_ids: ids });
                      }} />
                      {u.full_name}
                    </label>
                  ))}
                  {users.length === 0 && <span style={{ fontSize: 12, color: "var(--text-quaternary)" }}>No users available</span>}
                </div>
              </FormField>
              <FormField label="Reminder">
                <select value={newAct.reminder} onChange={(e) => setNewAct({ ...newAct, reminder: e.target.value })} style={{ margin: 0 }}>
                  {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormField>
            </div>
            <div style={{ marginBottom: 14 }}>
              <FormField label="Recurrence">
                <select value={newAct.recurrence} onChange={(e) => setNewAct({ ...newAct, recurrence: e.target.value })} style={{ margin: 0 }}>
                  {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Description"><textarea rows={2} value={newAct.description} onChange={(e) => setNewAct({ ...newAct, description: e.target.value })} placeholder="Optional notes" style={{ margin: 0 }} /></FormField>
          </div>
          <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Create Activity</button>
            <button type="button" className="btn-secondary" onClick={() => setShowNewActivity(false)}>Cancel</button>
          </div>
        </form>
      </SlideOverPanel>
    </div>
  );
}
