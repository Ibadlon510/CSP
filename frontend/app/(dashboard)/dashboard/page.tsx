"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, type User } from "@/lib/auth";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";

/* ─── types ─── */
type DashSummary = { total_projects: number; total_tasks: number; in_progress_tasks: number; completed_tasks: number };
type TeamUser = { id: string; full_name: string; role: string };

const ACTIVITY_TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  call: { label: "Call", color: "#0369a1", bg: "#e0f2fe" },
  meeting: { label: "Meeting", color: "#7c3aed", bg: "#f5f3ff" },
  follow_up: { label: "Follow-up", color: "#b45309", bg: "#fffbeb" },
  visit: { label: "Visit", color: "#047857", bg: "#ecfdf5" },
  other: { label: "Other", color: "#64748b", bg: "#f1f5f9" },
};

const QUICK_ACTIONS = [
  { label: "New Contact", href: "/dashboard/contacts", icon: "M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2", iconBg: "#e0f2fe", iconColor: "#0369a1" },
  { label: "New Quotation", href: "/dashboard/quotations", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8", iconBg: "#f5f3ff", iconColor: "#7c3aed" },
  { label: "New Order", href: "/dashboard/orders", icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z", iconBg: "#ecfdf5", iconColor: "#047857" },
  { label: "New Project", href: "/dashboard/projects", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", iconBg: "#fffbeb", iconColor: "#b45309" },
];

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "var(--info)", bg: "var(--info-light)" },
  medium: { label: "Medium", color: "#7c3aed", bg: "#f5f3ff" },
  high: { label: "High", color: "#b45309", bg: "#fffbeb" },
  urgent: { label: "Urgent", color: "var(--danger)", bg: "var(--danger-light)" },
};

/* ─── helpers ─── */
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ─── Activity Map helpers ─── */
const MAP_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const MAP_LABELS = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"];

function getBarPosition(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const startHour = s.getHours() + s.getMinutes() / 60;
  const endHour = e.getHours() + e.getMinutes() / 60;
  const totalSpan = MAP_HOURS[MAP_HOURS.length - 1] + 1 - MAP_HOURS[0];
  const left = ((startHour - MAP_HOURS[0]) / totalSpan) * 100;
  const width = ((endHour - startHour) / totalSpan) * 100;
  return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - Math.max(0, left), Math.max(width, 3))}%` };
}

function getNowPosition() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const totalSpan = MAP_HOURS[MAP_HOURS.length - 1] + 1 - MAP_HOURS[0];
  return ((hour - MAP_HOURS[0]) / totalSpan) * 100;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<DashSummary | null>(null);
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [todayProjects, setTodayProjects] = useState<any[]>([]);
  const [actMapPeriod, setActMapPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/api/projects/dashboard/summary").then((d: any) => setSummary(d)).catch(() => {});
    api.get("/api/activities/today").then((d: any) => setTodayActivities(d as any[])).catch(() => {});
    api.get("/api/users/").then((d: any) => setTeamUsers(d as TeamUser[])).catch(() => {});
    api.get("/api/projects/?status=in_progress").then((d: any) => setTodayProjects((d as any[]).slice(0, 4))).catch(() => {});
  }, []);

  const nowPct = getNowPosition();
  const actByProject = todayActivities.reduce<Record<string, any[]>>((acc, a) => {
    const key = a.project_title || "General";
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});
  const upcomingMeetings = todayActivities.filter((a) => a.activity_type === "meeting").slice(0, 3);

  return (
    <div>
      {/* ═══════ Page Header ═══════ */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-quaternary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" size={13} />
            {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          {teamUsers.length > 0 && <AvatarStack names={teamUsers.slice(0, 4).map((u) => u.full_name)} max={4} size={28} />}
          <button className="btn-primary btn-sm" onClick={() => router.push("/dashboard/users")}>
            <Icon path="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" size={14} />
            Invite
          </button>
        </div>
      </div>

      {/* ═══════ Quick Actions ═══════ */}
      <div className="grid-4col" style={{ marginBottom: 20 }}>
        {QUICK_ACTIONS.map((qa) => (
          <a key={qa.label} href={qa.href} className="quick-action-card">
            <div className="quick-action-icon" style={{ background: qa.iconBg }}>
              <Icon path={qa.icon} size={18} color={qa.iconColor} />
            </div>
            <span className="quick-action-label">{qa.label}</span>
          </a>
        ))}
      </div>

      {/* ═══════ Stat Cards ═══════ */}
      <div className="grid-4col" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Projects</div>
          <div className="stat-value">{summary?.total_projects ?? "—"}</div>
          <span style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 4 }}>Active Projects</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{summary?.total_tasks ?? "—"}</div>
          <span style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 4 }}>Tasks Created</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{summary?.in_progress_tasks ?? "—"}</div>
          <span style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 4 }}>Tasks</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{summary?.completed_tasks ?? "—"}</div>
          <span style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 4 }}>Tasks</span>
        </div>
      </div>

      {/* ═══════ Main Grid: Activity Map + Sidebar ═══════ */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 320px)", gap: 20, alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Time-Based Activity Map */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border-secondary)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.014em" }}>Time-Based Activity Map</h3>
              <div style={{ display: "inline-flex", gap: 0, background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", padding: 2 }}>
                {(["daily", "weekly", "monthly"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setActMapPeriod(p)}
                    style={{
                      padding: "4px 12px", fontSize: 11, fontWeight: actMapPeriod === p ? 600 : 500, border: "none", cursor: "pointer",
                      background: actMapPeriod === p ? "var(--bg-secondary)" : "transparent",
                      color: actMapPeriod === p ? "var(--text-primary)" : "var(--text-tertiary)",
                      borderRadius: "var(--radius-sm)", boxShadow: actMapPeriod === p ? "var(--shadow-xs)" : "none",
                      textTransform: "capitalize", transition: "all var(--transition-fast)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: "12px 20px 20px", position: "relative" }}>
              {Object.keys(actByProject).length === 0 ? (
                <p style={{ textAlign: "center", padding: "32px 0", color: "var(--text-quaternary)", fontSize: 13 }}>
                  No activities scheduled for today
                </p>
              ) : (
                <div style={{ position: "relative" }}>
                  {Object.entries(actByProject).map(([projName, acts]) => (
                    <div key={projName} style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
                      <div style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", paddingRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {projName}
                      </div>
                      <div style={{ flex: 1, position: "relative", height: 36, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
                        {acts.map((act: any) => {
                          const pos = getBarPosition(act.start_datetime, act.end_datetime);
                          const tc = ACTIVITY_TYPE_CFG[act.activity_type] || ACTIVITY_TYPE_CFG.other;
                          return (
                            <div
                              key={act.id}
                              title={`${act.title} (${fmtTime(act.start_datetime)} – ${fmtTime(act.end_datetime)})`}
                              style={{
                                position: "absolute", top: 4, bottom: 4, left: pos.left, width: pos.width,
                                background: tc.bg, border: `1px solid ${tc.color}30`, borderRadius: "var(--radius-sm)",
                                display: "flex", alignItems: "center", gap: 4, padding: "0 8px", overflow: "hidden", cursor: "pointer",
                              }}
                            >
                              {act.assigned_to_name && <AvatarChip name={act.assigned_to_name} size={18} />}
                              <span style={{ fontSize: 10, fontWeight: 600, color: tc.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{act.title}</span>
                              {act.progress_pct !== undefined && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: tc.color, marginLeft: "auto", whiteSpace: "nowrap" }}>{Math.round(act.progress_pct)}%</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Time axis */}
                  <div style={{ display: "flex", marginLeft: 120 }}>
                    {MAP_LABELS.map((lbl, i) => (
                      <span key={i} style={{ flex: 1, fontSize: 10, color: "var(--text-quaternary)", fontWeight: 500 }}>{lbl}</span>
                    ))}
                  </div>

                  {/* Now indicator */}
                  {nowPct >= 0 && nowPct <= 100 && (
                    <div style={{ position: "absolute", top: 0, bottom: 24, left: `calc(120px + (100% - 120px) * ${nowPct / 100})`, width: 1, background: "var(--text-primary)", zIndex: 2, pointerEvents: "none" }}>
                      <div style={{ position: "absolute", top: -2, left: -3, width: 7, height: 7, borderRadius: "50%", background: "var(--text-primary)" }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Today Projects */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.014em" }}>Today Projects</h3>
              <button className="btn-primary btn-sm" onClick={() => router.push("/dashboard/projects")}>
                <Icon path="M12 5v14 M5 12h14" size={14} />
                New Project
              </button>
            </div>
            {todayProjects.length === 0 ? (
              <p style={{ textAlign: "center", padding: "24px 0", color: "var(--text-quaternary)", fontSize: 13 }}>No active projects</p>
            ) : (
              <div className="grid-2col">
                {todayProjects.map((proj: any) => {
                  const pc = PRIORITY_CFG[proj.priority] || PRIORITY_CFG.medium;
                  return (
                    <div
                      key={proj.id}
                      onClick={() => router.push(`/dashboard/projects/${proj.id}`)}
                      style={{
                        padding: "16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-secondary)", cursor: "pointer",
                        transition: "all var(--transition-fast)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-secondary)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-primary)" }}>
                          <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={16} color="var(--text-tertiary)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.title}</span>
                        </div>
                        {proj.priority && <Pill label={pc.label} color={pc.color} bg={pc.bg} />}
                      </div>
                      {proj.description && (
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 0 }}>
                          {proj.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Team card */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.014em" }}>Team</h3>
            {teamUsers.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-quaternary)" }}>No team members</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {teamUsers.slice(0, 6).map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <AvatarChip name={u.full_name} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-quaternary)", textTransform: "capitalize" }}>{u.role?.replace(/_/g, " ")}</div>
                    </div>
                  </div>
                ))}
                {teamUsers.length > 6 && (
                  <a href="/dashboard/users" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textDecoration: "none" }}>
                    View all ({teamUsers.length})
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Upcoming Meetings */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.014em" }}>Upcoming Meetings</h3>
            {upcomingMeetings.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-quaternary)" }}>No upcoming meetings</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {upcomingMeetings.map((m: any) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "12px 14px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-secondary)",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8 }}>
                      {fmtDate(m.start_datetime)} · {fmtTime(m.start_datetime)} – {fmtTime(m.end_datetime)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      {m.assigned_to_name ? <AvatarStack names={[m.assigned_to_name]} size={22} /> : <span />}
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 10, color: "var(--text-quaternary)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Icon path="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" size={11} />
                          {m.comment_count ?? 0}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-quaternary)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Icon path="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" size={11} />
                          {m.attachment_count ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
