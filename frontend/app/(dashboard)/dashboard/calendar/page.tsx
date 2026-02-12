"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";
import { fmtDateTime } from "@/lib/format";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";

type Activity = {
  id: string; org_id: string; project_id: string; contact_id?: string;
  title: string; description?: string; activity_type: string; location?: string;
  start_datetime: string; end_datetime: string; reminder: string; recurrence: string;
  status: string; completion_notes?: string; completed_at?: string;
  assigned_to?: string; created_by?: string;
  assigned_to_name?: string; created_by_name?: string; project_title?: string; contact_name?: string;
  is_overdue: boolean; created_at: string; updated_at: string;
};
type UserOption = { id: string; full_name: string };
type ProjectOption = { id: string; title: string };

const ACTIVITY_TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  call: { label: "Call", color: "#0369a1", bg: "#e0f2fe" },
  meeting: { label: "Meeting", color: "#7c3aed", bg: "#f5f3ff" },
  follow_up: { label: "Follow-up", color: "#b45309", bg: "#fffbeb" },
  visit: { label: "Visit", color: "#047857", bg: "#ecfdf5" },
  other: { label: "Other", color: "#64748b", bg: "#f1f5f9" },
};
const ASSIGNEE_COLORS = [
  { color: "#0369a1", bg: "#e0f2fe", border: "#bae6fd" },
  { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  { color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { color: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
  { color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
  { color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  { color: "#a16207", bg: "#fefce8", border: "#fef08a" },
];
const REMINDER_OPTIONS = [
  { value: "none", label: "None" }, { value: "15min", label: "15 min before" },
  { value: "30min", label: "30 min before" }, { value: "1hr", label: "1 hour before" },
  { value: "1day", label: "1 day before" },
];
const RECURRENCE_OPTIONS = [
  { value: "none", label: "None" }, { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" },
];

const Pill = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, color, background: bg, whiteSpace: "nowrap", textTransform: "capitalize" }}>{label}</span>
);
const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "block" }}>{children}</label>
);

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfWeek(d: Date) { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); return s; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatMonth(d: Date) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
function formatWeekRange(d: Date) {
  const s = startOfWeek(d); const e = addDays(s, 6);
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}
function formatDayHeader(d: Date) { return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }

export default function CalendarPage() {
  const toast = useToast();
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ activity_type: [], status: [], assigned_to: [], project_id: [] });
  const [groupBy, setGroupBy] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [newAct, setNewAct] = useState({ title: "", description: "", activity_type: "call", assigned_to: "", project_id: "", start_datetime: "", end_datetime: "", location: "", reminder: "none", recurrence: "none" });
  const [completionModal, setCompletionModal] = useState<Activity | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  const assigneeColorMap = useMemo(() => {
    const map: Record<string, typeof ASSIGNEE_COLORS[0]> = {};
    [...new Set(activities.map(a => a.assigned_to).filter(Boolean))].forEach((uid, i) => { map[uid!] = ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length]; });
    return map;
  }, [activities]);

  useEffect(() => {
    api.get("/api/users/").then((r: any) => setUsers((r as any[]).map(u => ({ id: u.id, full_name: u.full_name })))).catch(() => {});
    api.get("/api/projects/").then((r: any) => setProjects((r as any[]).map(p => ({ id: p.id, title: p.title })))).catch(() => {});
  }, []);

  useEffect(() => { loadActivities(); }, [currentDate, view]);

  function getDateRange(): [string, string] {
    if (view === "month") {
      const s = startOfWeek(startOfMonth(currentDate));
      const e = addDays(startOfWeek(addDays(endOfMonth(currentDate), 1)), 6);
      return [s.toISOString(), e.toISOString()];
    } else if (view === "week") {
      const s = startOfWeek(currentDate);
      return [s.toISOString(), addDays(s, 7).toISOString()];
    }
    const s = new Date(currentDate); s.setHours(0, 0, 0, 0);
    return [s.toISOString(), addDays(s, 1).toISOString()];
  }

  async function loadActivities() {
    const [start_date, end_date] = getDateRange();
    const params = new URLSearchParams({ start_date, end_date });
    try {
      const res = await api.get(`/api/activities/?${params}`) as Activity[];
      setActivities(res);
    } catch { setActivities([]); }
  }

  const calFilterConfig: FilterFieldConfig[] = useMemo(() => [
    { key: "activity_type", label: "Type", options: Object.entries(ACTIVITY_TYPE_CFG).map(([k, v]) => ({ value: k, label: v.label })) },
    { key: "status", label: "Status", options: [{ value: "pending", label: "Pending" }, { value: "completed", label: "Completed" }] },
    ...(users.length > 0 ? [{ key: "assigned_to", label: "Assignee", options: users.map(u => ({ value: u.id, label: u.full_name })) }] : []),
    ...(projects.length > 0 ? [{ key: "project_id", label: "Project", options: projects.map(p => ({ value: p.id, label: p.title })) }] : []),
  ], [users, projects]);

  const calGroupOptions = [
    { value: "activity_type", label: "Type" },
    { value: "status", label: "Status" },
  ];

  const filteredActivities = useMemo(() => {
    let list = activities;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q)) || (a.project_title && a.project_title.toLowerCase().includes(q)));
    }
    if (filters.activity_type?.length) list = list.filter(a => filters.activity_type.includes(a.activity_type));
    if (filters.status?.length) list = list.filter(a => filters.status.includes(a.status));
    if (filters.assigned_to?.length) list = list.filter(a => a.assigned_to && filters.assigned_to.includes(a.assigned_to));
    if (filters.project_id?.length) list = list.filter(a => filters.project_id.includes(a.project_id));
    return list;
  }, [activities, search, filters]);

  function navigate(dir: -1 | 1) {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }

  function actsForDay(date: Date) { return filteredActivities.filter(a => isSameDay(new Date(a.start_datetime), date)); }
  function getColor(uid?: string) { return uid && assigneeColorMap[uid] ? assigneeColorMap[uid] : { color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0" }; }

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!newAct.project_id) { toast.error("Select a project"); return; }
    try {
      await api.post(`/api/activities/project/${newAct.project_id}`, {
        title: newAct.title, description: newAct.description || undefined,
        activity_type: newAct.activity_type, assigned_to: newAct.assigned_to || undefined,
        start_datetime: newAct.start_datetime, end_datetime: newAct.end_datetime,
        location: newAct.location || undefined, reminder: newAct.reminder, recurrence: newAct.recurrence,
      });
      setNewAct({ title: "", description: "", activity_type: "call", assigned_to: "", project_id: "", start_datetime: "", end_datetime: "", location: "", reminder: "none", recurrence: "none" });
      setShowNewActivity(false); loadActivities(); toast.success("Activity created");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function deleteActivity(id: string) {
    if (!confirm("Delete this activity?")) return;
    try { await api.delete(`/api/activities/${id}`); setSelectedActivity(null); loadActivities(); toast.success("Deleted"); } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function submitCompletion() {
    if (!completionModal) return;
    try {
      await api.patch(`/api/activities/${completionModal.id}`, { status: "completed", completion_notes: completionNotes || undefined });
      setCompletionModal(null); setCompletionNotes(""); setSelectedActivity(null); loadActivities(); toast.success("Completed");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  async function reopenActivity(id: string) {
    try { await api.patch(`/api/activities/${id}`, { status: "pending" }); setSelectedActivity(null); loadActivities(); } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  const today = new Date();
  const headerLabel = view === "month" ? formatMonth(currentDate) : view === "week" ? formatWeekRange(currentDate) : formatDayHeader(currentDate);

  // ─── Month View ───
  function renderMonthView() {
    const first = startOfMonth(currentDate);
    const gridStart = startOfWeek(first);
    const weeks: Date[][] = [];
    let d = new Date(gridStart);
    for (let w = 0; w < 6; w++) { const wk: Date[] = []; for (let i = 0; i < 7; i++) { wk.push(new Date(d)); d = addDays(d, 1); } weeks.push(wk); }
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border-primary)" }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => (
            <div key={day} style={{ padding: "8px 4px", fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>{day}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: 100 }}>
            {week.map((day, di) => {
              const dayActs = actsForDay(day);
              const isCurMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, today);
              return (
                <div key={di} onClick={() => { setCurrentDate(new Date(day)); setView("day"); }}
                  style={{ padding: "4px 6px", cursor: "pointer", border: "1px solid var(--border-secondary)", borderTop: "none", borderLeft: di === 0 ? "none" : undefined, borderRight: "none", background: isToday ? "var(--accent-blue-light)" : isCurMonth ? "var(--bg-secondary)" : "var(--bg-tertiary)", minHeight: 90 }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                  onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = isToday ? "var(--accent-blue-light)" : isCurMonth ? "var(--bg-secondary)" : "var(--bg-tertiary)"; }}>
                  <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--brand-primary)" : isCurMonth ? "var(--text-primary)" : "var(--text-quaternary)", marginBottom: 4 }}>{day.getDate()}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {dayActs.slice(0, 3).map(a => {
                      const ac = getColor(a.assigned_to);
                      return (
                        <div key={a.id} onClick={e => { e.stopPropagation(); setSelectedActivity(a); }}
                          style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: ac.bg, color: ac.color, borderLeft: `3px solid ${a.is_overdue ? "var(--danger)" : ac.border}`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: a.status === "completed" ? "line-through" : "none", opacity: a.status === "completed" ? 0.6 : 1 }}>
                          {a.title}
                        </div>
                      );
                    })}
                    {dayActs.length > 3 && <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-tertiary)", paddingLeft: 4 }}>+{dayActs.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ─── Week View ───
  function renderWeekView() {
    const weekStart = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 16 }, (_, i) => i + 6);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
        <div style={{ borderBottom: "2px solid var(--border-primary)", padding: 4 }} />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} onClick={() => { setCurrentDate(new Date(day)); setView("day"); }}
              style={{ borderBottom: "2px solid var(--border-primary)", padding: "6px 4px", textAlign: "center", cursor: "pointer", background: isToday ? "var(--accent-blue-light)" : "transparent" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase" }}>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
              <div style={{ fontSize: 16, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--brand-primary)" : "var(--text-primary)" }}>{day.getDate()}</div>
            </div>
          );
        })}
        {hours.map(hour => (
          <div key={`row-${hour}`} style={{ display: "contents" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-quaternary)", padding: "4px 6px", textAlign: "right", borderRight: "1px solid var(--border-secondary)", borderBottom: "1px solid var(--border-secondary)" }}>
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
            {days.map((day, di) => {
              const slotActs = filteredActivities.filter(a => { const s = new Date(a.start_datetime); return isSameDay(s, day) && s.getHours() === hour; });
              return (
                <div key={`${hour}-${di}`} style={{ borderBottom: "1px solid var(--border-secondary)", borderRight: di < 6 ? "1px solid var(--border-secondary)" : "none", minHeight: 48, padding: 2 }}>
                  {slotActs.map(a => {
                    const ac = getColor(a.assigned_to);
                    return (
                      <div key={a.id} onClick={() => setSelectedActivity(a)}
                        style={{ fontSize: 10, fontWeight: 600, padding: "2px 5px", borderRadius: 4, cursor: "pointer", background: ac.bg, color: ac.color, borderLeft: `3px solid ${a.is_overdue ? "var(--danger)" : ac.border}`, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: a.status === "completed" ? "line-through" : "none", opacity: a.status === "completed" ? 0.6 : 1 }}>
                        {new Date(a.start_datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} {a.title}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ─── Day View ───
  function renderDayView() {
    const hours = Array.from({ length: 18 }, (_, i) => i + 6);
    const dayActs = actsForDay(currentDate);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
        {hours.map(hour => {
          const slotActs = dayActs.filter(a => new Date(a.start_datetime).getHours() === hour);
          return (
            <div key={`row-${hour}`} style={{ display: "contents" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-quaternary)", padding: "8px 8px", textAlign: "right", borderRight: "1px solid var(--border-secondary)", borderBottom: "1px solid var(--border-secondary)" }}>
                {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
              </div>
              <div style={{ minHeight: 56, padding: "4px 8px", borderBottom: "1px solid var(--border-secondary)" }}>
                {slotActs.map(a => {
                  const ac = getColor(a.assigned_to);
                  const tc = ACTIVITY_TYPE_CFG[a.activity_type] || ACTIVITY_TYPE_CFG.other;
                  const st = new Date(a.start_datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                  const et = new Date(a.end_datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                  return (
                    <div key={a.id} onClick={() => setSelectedActivity(a)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 4, background: ac.bg, borderRadius: "var(--radius-md)", cursor: "pointer", borderLeft: `4px solid ${a.is_overdue ? "var(--danger)" : ac.color}`, opacity: a.status === "completed" ? 0.6 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: ac.color, textDecoration: a.status === "completed" ? "line-through" : "none" }}>{a.title}</span>
                          <Pill label={tc.label} color={tc.color} bg={tc.bg} />
                          {a.recurrence !== "none" && <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-quaternary)" }}>↻ {a.recurrence}</span>}
                          {a.is_overdue && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--danger)" }}>OVERDUE</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {st} – {et}{a.location && <><span> · </span><Icon path="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" size={12} /><span> {a.location}</span></>}{a.project_title && ` · ${a.project_title}`}
                        </div>
                      </div>
                      {a.assigned_to_name && <span style={{ fontSize: 11, fontWeight: 600, color: ac.color }}>{a.assigned_to_name}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">All scheduled activities across projects</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-primary" onClick={() => setShowNewActivity(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon path="M12 4v16m8-8H4" size={16} color="#fff" /> Add Activity
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate(-1)} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", padding: "6px 10px", cursor: "pointer", color: "var(--text-secondary)" }}><Icon path="M15 18l-6-6 6-6" size={16} /></button>
          <button onClick={() => setCurrentDate(new Date())} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>Today</button>
          <button onClick={() => navigate(1)} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", padding: "6px 10px", cursor: "pointer", color: "var(--text-secondary)" }}><Icon path="M9 18l6-6-6-6" size={16} /></button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginLeft: 8 }}>{headerLabel}</h2>
        </div>
        <div style={{ display: "flex", gap: 2, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", padding: 2 }}>
          {(["month", "week", "day"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: "var(--radius-sm)", border: "none", background: view === v ? "var(--bg-secondary)" : "transparent", color: view === v ? "var(--text-primary)" : "var(--text-tertiary)", boxShadow: view === v ? "var(--shadow-xs)" : "none", textTransform: "capitalize" }}>{v}</button>
          ))}
        </div>
      </div>

      {/* Search / Filter bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={calFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={calGroupOptions} pageKey="calendar" placeholder="Search activities..." />
      </div>

      {/* Calendar Body */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        {view === "month" && renderMonthView()}
        {view === "week" && renderWeekView()}
        {view === "day" && renderDayView()}
      </div>

      {/* Detail Side Panel */}
      {selectedActivity && (
        <>
          <div onClick={() => setSelectedActivity(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 1040 }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, background: "var(--bg-secondary)", boxShadow: "var(--shadow-xl)", zIndex: 1050, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--border-primary)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{selectedActivity.title}</h3>
              <button onClick={() => setSelectedActivity(null)} style={{ background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)", padding: 6, cursor: "pointer", color: "var(--text-tertiary)", marginLeft: 8 }}><Icon path="M18 6L6 18M6 6l12 12" size={15} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div><FieldLabel>Type</FieldLabel><Pill {...(ACTIVITY_TYPE_CFG[selectedActivity.activity_type] || ACTIVITY_TYPE_CFG.other)} /></div>
                <div><FieldLabel>Status</FieldLabel>
                  <Pill label={selectedActivity.status === "completed" ? "Completed" : selectedActivity.is_overdue ? "Overdue" : "Pending"}
                    color={selectedActivity.status === "completed" ? "var(--success)" : selectedActivity.is_overdue ? "var(--danger)" : "var(--info)"}
                    bg={selectedActivity.status === "completed" ? "var(--success-light)" : selectedActivity.is_overdue ? "var(--danger-light)" : "var(--info-light)"} />
                </div>
                <div><FieldLabel>Start</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtDateTime(selectedActivity.start_datetime)}</span></div>
                <div><FieldLabel>End</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtDateTime(selectedActivity.end_datetime)}</span></div>
                <div><FieldLabel>Assignee</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{selectedActivity.assigned_to_name || "—"}</span></div>
                <div><FieldLabel>Created By</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{selectedActivity.created_by_name || "—"}</span></div>
                <div><FieldLabel>Project</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{selectedActivity.project_title || "—"}</span></div>
                <div><FieldLabel>Contact</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{selectedActivity.contact_name || "—"}</span></div>
                {selectedActivity.location && <div style={{ gridColumn: "1 / -1" }}><FieldLabel>Location</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><Icon path="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" size={14} /> {selectedActivity.location}</span></div>}
                <div><FieldLabel>Reminder</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{REMINDER_OPTIONS.find(o => o.value === selectedActivity.reminder)?.label || "—"}</span></div>
                <div><FieldLabel>Recurrence</FieldLabel><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{selectedActivity.recurrence !== "none" ? `↻ ${selectedActivity.recurrence}` : "—"}</span></div>
              </div>
              {selectedActivity.description && <div style={{ marginBottom: 20 }}><FieldLabel>Description</FieldLabel><p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{selectedActivity.description}</p></div>}
              {selectedActivity.completion_notes && <div style={{ marginBottom: 20 }}><FieldLabel>Completion Notes</FieldLabel><p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, fontStyle: "italic" }}>{selectedActivity.completion_notes}</p></div>}
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-primary)", display: "flex", gap: 10 }}>
              {selectedActivity.status === "pending" ? (
                <button onClick={() => { setCompletionModal(selectedActivity); setCompletionNotes(""); }} style={{ flex: 1, background: "var(--success)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Mark Complete</button>
              ) : (
                <button onClick={() => reopenActivity(selectedActivity.id)} style={{ flex: 1, background: "var(--info)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Reopen</button>
              )}
              <button onClick={() => deleteActivity(selectedActivity.id)} style={{ background: "var(--danger-light)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </>
      )}

      {/* New Activity Modal */}
      {showNewActivity && (
        <>
          <div onClick={() => setShowNewActivity(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 1060 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", padding: "24px 28px", boxShadow: "var(--shadow-xl)", zIndex: 1070, width: 560, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>New Activity</h3>
            <form onSubmit={handleCreateActivity}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}><FieldLabel>Title *</FieldLabel><input type="text" value={newAct.title} onChange={e => setNewAct({ ...newAct, title: e.target.value })} required placeholder="Activity title" style={{ margin: 0 }} /></div>
                <div><FieldLabel>Project *</FieldLabel>
                  <select value={newAct.project_id} onChange={e => setNewAct({ ...newAct, project_id: e.target.value })} required style={{ margin: 0 }}>
                    <option value="">— Select Project —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div><FieldLabel>Type</FieldLabel>
                  <select value={newAct.activity_type} onChange={e => setNewAct({ ...newAct, activity_type: e.target.value })} style={{ margin: 0 }}>
                    {Object.entries(ACTIVITY_TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div><FieldLabel>Start *</FieldLabel><input type="datetime-local" value={newAct.start_datetime} onChange={e => setNewAct({ ...newAct, start_datetime: e.target.value })} required style={{ margin: 0 }} /></div>
                <div><FieldLabel>End *</FieldLabel><input type="datetime-local" value={newAct.end_datetime} onChange={e => setNewAct({ ...newAct, end_datetime: e.target.value })} required style={{ margin: 0 }} /></div>
                <div><FieldLabel>Assign To</FieldLabel>
                  <select value={newAct.assigned_to} onChange={e => setNewAct({ ...newAct, assigned_to: e.target.value })} style={{ margin: 0 }}>
                    <option value="">— Select —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div><FieldLabel>Location</FieldLabel><input type="text" value={newAct.location} onChange={e => setNewAct({ ...newAct, location: e.target.value })} placeholder="Optional" style={{ margin: 0 }} /></div>
                <div><FieldLabel>Reminder</FieldLabel>
                  <select value={newAct.reminder} onChange={e => setNewAct({ ...newAct, reminder: e.target.value })} style={{ margin: 0 }}>
                    {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div><FieldLabel>Recurrence</FieldLabel>
                  <select value={newAct.recurrence} onChange={e => setNewAct({ ...newAct, recurrence: e.target.value })} style={{ margin: 0 }}>
                    {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}><FieldLabel>Description</FieldLabel><textarea rows={2} value={newAct.description} onChange={e => setNewAct({ ...newAct, description: e.target.value })} placeholder="Optional" style={{ margin: 0 }} /></div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" style={{ flex: 1, background: "var(--brand-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Create Activity</button>
                <button type="button" onClick={() => setShowNewActivity(false)} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Completion Modal */}
      {completionModal && (
        <>
          <div onClick={() => setCompletionModal(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 1080 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", padding: "24px 28px", boxShadow: "var(--shadow-xl)", zIndex: 1090, width: 420, maxWidth: "90vw" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Complete Activity</h3>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>{completionModal.title}</p>
            <FieldLabel>Outcome / Notes (optional)</FieldLabel>
            <textarea rows={3} value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} placeholder="What was the outcome?" style={{ margin: 0, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitCompletion} style={{ flex: 1, background: "var(--success)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Mark Complete</button>
              <button onClick={() => setCompletionModal(null)} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
