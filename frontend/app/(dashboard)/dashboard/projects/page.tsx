"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { fmtDate } from "@/lib/format";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { SpreadsheetView } from "@/components/ui/SpreadsheetView";
import { KanbanView, type KanbanColumnConfig, type GenericCardData } from "@/components/ui/KanbanView";
import { TimelineView } from "@/components/ui/TimelineView";
import { Pill } from "@/components/ui/Pill";
import { exportToCsv } from "@/lib/export";

type Project = {
  id: string;
  title: string;
  description?: string;
  status: string;
  contact_name?: string;
  owner_name?: string;
  task_count?: number;
  completed_task_count?: number;
  due_date?: string;
  created_at: string;
  invoice_id?: string | null;
  sales_order_id?: string | null;
  project_number?: string | null;
};

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const fromContactQs = fromContactId && fromContactName ? `?from_contact=${encodeURIComponent(fromContactId)}&from_contact_name=${encodeURIComponent(fromContactName)}` : "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ status: [], owner: [], contact: [] });
  const [groupBy, setGroupBy] = useState("");
  const [viewMode, setViewMode] = useState("spreadsheet");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await api.get("/api/projects/");
      setProjects(data as Project[]);
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    planning: "info",
    in_progress: "accent",
    on_hold: "warning",
    completed: "success",
    cancelled: "danger",
  };

  const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "completed", "cancelled"];
  const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    planning: { label: "Planning", color: "var(--info)", bg: "var(--info-light)" },
    in_progress: { label: "In Progress", color: "#7c3aed", bg: "#f5f3ff" },
    on_hold: { label: "On Hold", color: "#b45309", bg: "#fffbeb" },
    completed: { label: "Completed", color: "var(--success)", bg: "var(--success-light)" },
    cancelled: { label: "Cancelled", color: "var(--danger)", bg: "var(--danger-light)" },
  };
  const KANBAN_COLUMNS: KanbanColumnConfig[] = PROJECT_STATUSES.map((s) => ({
    id: s, label: STATUS_CFG[s]?.label || s, color: STATUS_CFG[s]?.color || "var(--text-secondary)", bg: STATUS_CFG[s]?.bg || "var(--bg-tertiary)",
  }));

  const uniqueOwners = useMemo(() => [...new Set(projects.map((p) => p.owner_name).filter(Boolean))] as string[], [projects]);
  const uniqueContacts = useMemo(() => [...new Set(projects.map((p) => p.contact_name).filter(Boolean))] as string[], [projects]);

  const projectFilterConfig: FilterFieldConfig[] = useMemo(() => [
    { key: "status", label: "Status", options: ["planning", "in_progress", "on_hold", "completed", "cancelled"].map((s) => ({ value: s, label: s.replace("_", " ") })) },
    ...(uniqueOwners.length > 0 ? [{ key: "owner", label: "Owner", options: uniqueOwners.map((o) => ({ value: o, label: o })) }] : []),
    ...(uniqueContacts.length > 0 ? [{ key: "contact", label: "Contact", options: uniqueContacts.map((c) => ({ value: c, label: c })) }] : []),
  ], [uniqueOwners, uniqueContacts]);

  const projectGroupOptions = [
    { value: "status", label: "Status" },
    { value: "owner", label: "Owner" },
  ];

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)) || (p.contact_name && p.contact_name.toLowerCase().includes(q)) || (p.project_number && p.project_number.toLowerCase().includes(q)));
    }
    if (filters.status?.length) list = list.filter((p) => filters.status.includes(p.status));
    if (filters.owner?.length) list = list.filter((p) => p.owner_name && filters.owner.includes(p.owner_name));
    if (filters.contact?.length) list = list.filter((p) => p.contact_name && filters.contact.includes(p.contact_name));
    return list;
  }, [projects, search, filters]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Projects</h1>
            <p className="page-subtitle">Loading projects...</p>
          </div>
        </div>
        <div className="flex items-center justify-center" style={{ padding: 80 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {fromContactId && fromContactName && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/dashboard/contacts" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>Contacts</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <Link href={`/dashboard/contacts/${fromContactId}`} style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>{fromContactName}</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Projects</span>
        </div>
      )}
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage client projects and tasks</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary btn-sm" onClick={() => exportToCsv("projects", filteredProjects, [
            { key: "project_number", label: "Number" },
            { key: "title", label: "Title" },
            { key: "contact_name", label: "Contact" },
            { key: "status", label: "Status" },
            { key: "due_date", label: "Due Date" },
          ])}>
            <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
            Export
          </button>
          <a href="/dashboard/projects/new" className="btn-primary">
            <Icon path="M12 5v14 M5 12h14" size={16} />
            New Project
          </a>
        </div>
      </div>

      {/* Search / Filter / View bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          filterConfig={projectFilterConfig}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          groupOptions={projectGroupOptions}
          pageKey="projects"
          placeholder="Search projects..."
        />
        <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
      </div>

      {/* Spreadsheet View */}
      {viewMode === "spreadsheet" && (
        <SpreadsheetView<Project>
          columns={[
            { key: "title", label: "Project", render: (p) => (
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.title}</div>
                {p.project_number && <div style={{ fontSize: 11, color: "var(--text-quaternary)", fontFamily: "monospace" }}>{p.project_number}</div>}
              </div>
            ) },
            { key: "contact_name", label: "Contact", render: (p) => <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{p.contact_name || "\u2014"}</span> },
            { key: "owner_name", label: "Owner", render: (p) => <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{p.owner_name || "\u2014"}</span> },
            { key: "status", label: "Status", render: (p) => { const sc = STATUS_CFG[p.status] || STATUS_CFG.planning; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
            { key: "due_date", label: "Due Date", render: (p) => <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{fmtDate(p.due_date)}</span> },
            { key: "progress", label: "Progress", render: (p) => <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.completed_task_count || 0} / {p.task_count || 0}</span> },
            { key: "actions", label: "Actions", align: "right", render: (p) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Link href={`/dashboard/projects/${p.id}${fromContactQs}`} className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>View</Link>
              </span>
            ) },
          ]}
          groups={PROJECT_STATUSES.map((s) => {
            const sc = STATUS_CFG[s] || STATUS_CFG.planning;
            return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: filteredProjects.filter((p) => p.status === s) };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(p) => router.push(`/dashboard/projects/${p.id}${fromContactQs}`)}
          emptyIcon="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
          emptyLabel="No projects yet"
          emptyDescription="Create a project to organize tasks for your clients"
        />
      )}

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <TimelineView
          items={filteredProjects.map((p) => {
            const sc = STATUS_CFG[p.status] || STATUS_CFG.planning;
            return {
              id: p.id,
              title: p.title,
              startDate: p.created_at,
              endDate: p.due_date,
              color: sc.color,
              bg: sc.bg,
              onClick: () => router.push(`/dashboard/projects/${p.id}${fromContactQs}`),
            };
          })}
          emptyLabel="No projects to display on timeline"
        />
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <KanbanView
          columns={KANBAN_COLUMNS}
          itemsByColumn={Object.fromEntries(PROJECT_STATUSES.map((s) => [
            s,
            filteredProjects.filter((p) => p.status === s).map((p): GenericCardData => ({
              id: p.id,
              title: p.title,
              subtitle: p.contact_name || undefined,
              meta: [
                ...(p.due_date ? [{ label: "Due", value: fmtDate(p.due_date) }] : []),
                { label: "Progress", value: `${p.completed_task_count || 0}/${p.task_count || 0}` },
              ],
            })),
          ]))}
          onItemClick={(id) => router.push(`/dashboard/projects/${id}${fromContactQs}`)}
          emptyLabel="No projects"
        />
      )}

      {/* Results count */}
      {!loading && filteredProjects.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
          Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
