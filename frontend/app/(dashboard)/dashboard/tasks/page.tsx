"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getMe, type User } from "@/lib/auth";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Pill } from "@/components/ui/Pill";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { TaskCard, type TaskCardData } from "@/components/ui/TaskCard";
import { KanbanBoard, type KanbanColumn } from "@/components/ui/KanbanBoard";
import { TaskModal, type TaskModalData, type TaskModalUser, type TaskModalComment } from "@/components/ui/TaskModal";
import { TimelineView } from "@/components/ui/TimelineView";
import { SpreadsheetView } from "@/components/ui/SpreadsheetView";

/* ─── types ─── */
type Task = {
  id: string; project_id: string; title: string; description?: string; status: string;
  priority: string; category?: string; due_date?: string; start_date?: string;
  assignee_name?: string; assignees?: { user_id: string; user_name?: string }[];
  subtask_count?: number; progress_pct?: number; comment_count?: number;
  project_title?: string; created_at: string;
};

const STATUS_ORDER = ["todo", "in_progress", "review", "done"];
const KANBAN_COLUMNS: KanbanColumn[] = STATUS_ORDER.map((s) => ({
  id: s,
  label: ({ todo: "To-do", in_progress: "In Progress", review: "In Review", done: "Completed" } as Record<string, string>)[s] || s,
  color: ({ todo: "var(--text-secondary)", in_progress: "#7c3aed", review: "#b45309", done: "var(--success)" } as Record<string, string>)[s] || "var(--text-secondary)",
  bg: ({ todo: "var(--bg-tertiary)", in_progress: "#f5f3ff", review: "#fffbeb", done: "var(--success-light)" } as Record<string, string>)[s] || "var(--bg-tertiary)",
}));
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: "To-do", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
  in_progress: { label: "In Progress", color: "#7c3aed", bg: "#f5f3ff" },
  review: { label: "In Review", color: "#b45309", bg: "#fffbeb" },
  done: { label: "Completed", color: "var(--success)", bg: "var(--success-light)" },
};
const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "var(--info)", bg: "var(--info-light)" },
  medium: { label: "Medium", color: "#7c3aed", bg: "#f5f3ff" },
  high: { label: "High", color: "#b45309", bg: "#fffbeb" },
  urgent: { label: "Urgent", color: "var(--danger)", bg: "var(--danger-light)" },
};

/* ─── helpers ─── */
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function taskToCard(t: Task): TaskCardData {
  return {
    id: t.id, title: t.title, description: t.description, priority: t.priority,
    due_date: t.due_date, progress_pct: t.progress_pct,
    assignee_names: t.assignees?.map((a) => a.user_name || "?") || [],
    comment_count: t.comment_count, attachment_count: 0,
  };
}

/* ─── Calendar bar helpers ─── */
function getWeekDates() {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function MyTaskPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<TaskModalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("kanban");

  // Search / filter / group state
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ status: [], priority: [], category: [], project: [] });
  const [groupBy, setGroupBy] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalData, setModalData] = useState<TaskModalData>({ status: "todo", priority: "medium" });
  const [modalComments, setModalComments] = useState<TaskModalComment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
    api.get("/api/users/").then((d: any) => setUsers(d as TaskModalUser[])).catch(() => {});
    loadTasks();
  }, []);

  function loadTasks() {
    setLoading(true);
    api.get("/api/projects/tasks/my").then((d: any) => setTasks(d as Task[])).catch(() => {}).finally(() => setLoading(false));
  }

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
    // Load comments
    api.get(`/api/projects/tasks/${task.id}/comments`).then((d: any) => setModalComments(d as TaskModalComment[])).catch(() => setModalComments([]));
    setModalOpen(true);
  }

  async function handleSave(data: TaskModalData) {
    setSaving(true);
    try {
      if (modalMode === "create" && data.title) {
        // Need a project_id — use first available project
        const projects: any[] = await api.get("/api/projects/?status=in_progress");
        if (projects.length === 0) { alert("No active projects to create task in."); return; }
        await api.post(`/api/projects/${projects[0].id}/tasks`, {
          project_id: projects[0].id, title: data.title, description: data.description,
          status: data.status, priority: data.priority, category: data.category,
          due_date: data.due_date || null, assignee_ids: data.assignee_ids || [],
        });
      } else if (data.id) {
        await api.patch(`/api/projects/tasks/${data.id}`, {
          title: data.title, description: data.description, status: data.status,
          priority: data.priority, category: data.category,
          due_date: data.due_date || null, assignee_ids: data.assignee_ids || [],
        });
      }
      setModalOpen(false);
      loadTasks();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleAddComment(content: string) {
    if (!modalData.id) return;
    try {
      const c: any = await api.post(`/api/projects/tasks/${modalData.id}/comments`, { content });
      setModalComments((prev) => [...prev, c]);
    } catch (e) { console.error(e); }
  }

  async function handleDeleteComment(commentId: string) {
    if (!modalData.id) return;
    try {
      await api.delete(`/api/projects/tasks/${modalData.id}/comments/${commentId}`);
      setModalComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) { console.error(e); }
  }

  async function handleDeleteTask() {
    if (!modalData.id || !confirm("Delete this task?")) return;
    try {
      await api.delete(`/api/projects/tasks/${modalData.id}`);
      setModalOpen(false);
      loadTasks();
    } catch (e) { console.error(e); }
  }

  // Derive unique categories and projects for filter config
  const uniqueCategories = useMemo(() => [...new Set(tasks.map((t) => t.category).filter(Boolean))] as string[], [tasks]);
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => { if (t.project_id && t.project_title) map.set(t.project_id, t.project_title); });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [tasks]);

  const taskFilterConfig: FilterFieldConfig[] = useMemo(() => [
    { key: "status", label: "Status", options: STATUS_ORDER.map((s) => ({ value: s, label: STATUS_CFG[s]?.label || s })) },
    { key: "priority", label: "Priority", options: ["low", "medium", "high", "urgent"].map((p) => ({ value: p, label: PRIORITY_CFG[p]?.label || p })) },
    ...(uniqueCategories.length > 0 ? [{ key: "category", label: "Category", options: uniqueCategories.map((c) => ({ value: c, label: c })) }] : []),
    ...(uniqueProjects.length > 0 ? [{ key: "project", label: "Project", options: uniqueProjects }] : []),
  ], [uniqueCategories, uniqueProjects]);

  const taskGroupOptions = useMemo(() => [
    { value: "status", label: "Status" },
    { value: "priority", label: "Priority" },
    ...(uniqueCategories.length > 0 ? [{ value: "category", label: "Category" }] : []),
    ...(uniqueProjects.length > 0 ? [{ value: "project", label: "Project" }] : []),
  ], [uniqueCategories, uniqueProjects]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    if (filters.status?.length) list = list.filter((t) => filters.status.includes(t.status));
    if (filters.priority?.length) list = list.filter((t) => filters.priority.includes(t.priority));
    if (filters.category?.length) list = list.filter((t) => t.category && filters.category.includes(t.category));
    if (filters.project?.length) list = list.filter((t) => filters.project.includes(t.project_id));
    return list;
  }, [tasks, search, filters]);

  // Group tasks by status for Kanban
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    STATUS_ORDER.forEach((s) => { groups[s] = []; });
    filteredTasks.forEach((t) => {
      const key = STATUS_ORDER.includes(t.status) ? t.status : "todo";
      groups[key].push(t);
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

  const weekDates = useMemo(() => getWeekDates(), []);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><div className="loading-spinner" style={{ width: 32, height: 32 }} /></div>;
  }

  return (
    <div>
      {/* ═══════ Page Header ═══════ */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">My Task</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && <AvatarStack names={[user.full_name]} size={28} />}
          <button className="btn-primary btn-sm" onClick={() => openCreateModal()}>
            <Icon path="M12 5v14 M5 12h14" size={14} />
            Create Task
          </button>
        </div>
      </div>

      {/* ═══════ Task Calendar (weekly strip) ═══════ */}
      <div className="card" style={{ marginBottom: 20, padding: "12px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Task Calendar</h3>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {weekDates.map((date, i) => {
            const isToday = isSameDay(date, new Date());
            const dayTasks = tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), date));
            return (
              <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < 6 ? "1px solid var(--border-secondary)" : "none", padding: "8px 4px", position: "relative" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase", marginBottom: 4 }}>
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: isToday ? 700 : 500,
                  color: isToday ? "#fff" : "var(--text-primary)",
                  background: isToday ? "var(--brand-primary)" : "transparent",
                  width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 6,
                }}>
                  {date.getDate()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {dayTasks.slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openEditModal(t)}
                      style={{
                        fontSize: 9, fontWeight: 600, padding: "2px 4px", borderRadius: "var(--radius-sm)",
                        background: (STATUS_CFG[t.status] || STATUS_CFG.todo).bg,
                        color: (STATUS_CFG[t.status] || STATUS_CFG.todo).color,
                        cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <span style={{ fontSize: 9, color: "var(--text-quaternary)" }}>+{dayTasks.length - 2} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════ All Task header + search/filter + view toggle ═══════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>All Task</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <SearchFilterBar
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onFiltersChange={setFilters}
            filterConfig={taskFilterConfig}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            groupOptions={taskGroupOptions}
            pageKey="my_tasks"
            placeholder="Search tasks..."
          />
          <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
        </div>
      </div>

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
              loadTasks();
            } catch (e) { console.error(e); }
          }}
        />
      )}

      {/* ═══════ Spreadsheet View ═══════ */}
      {viewMode === "spreadsheet" && (
        <SpreadsheetView<Task>
          columns={[
            { key: "title", label: "Task", render: (t) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.title}</span> },
            { key: "description", label: "Description", render: (t) => <span style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>{t.description || "—"}</span> },
            { key: "assignees", label: "Assignee", render: (t) => t.assignees && t.assignees.length > 0 ? <AvatarStack names={t.assignees.map((a) => a.user_name || "?")} max={3} size={22} /> : <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>—</span> },
            { key: "due_date", label: "Due Date", render: (t) => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtDate(t.due_date)}</span> },
            { key: "priority", label: "Priority", render: (t) => { const pc = PRIORITY_CFG[t.priority] || PRIORITY_CFG.medium; return <Pill label={pc.label} color={pc.color} bg={pc.bg} />; } },
          ]}
          groups={STATUS_ORDER.map((s) => {
            const sc = STATUS_CFG[s] || STATUS_CFG.todo;
            return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: tasksByStatus[s] || [] };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(t) => openEditModal(t)}
          emptyIcon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          emptyLabel="No tasks found"
          emptyDescription="Create a task or adjust your filters"
        />
      )}

      {/* ═══════ Timeline View ═══════ */}
      {viewMode === "timeline" && (
        <TimelineView
          items={filteredTasks.map((t) => {
            const sc = STATUS_CFG[t.status] || STATUS_CFG.todo;
            return {
              id: t.id,
              title: t.title,
              startDate: t.start_date || t.created_at,
              endDate: t.due_date,
              color: sc.color,
              bg: sc.bg,
              onClick: () => openEditModal(t),
            };
          })}
          emptyLabel="No tasks to display on timeline"
        />
      )}

      {/* ═══════ Task Modal ═══════ */}
      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        initialData={modalData}
        users={users}
        comments={modalComments}
        onSave={handleSave}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onDelete={modalMode === "edit" ? handleDeleteTask : undefined}
        saving={saving}
      />
    </div>
  );
}
