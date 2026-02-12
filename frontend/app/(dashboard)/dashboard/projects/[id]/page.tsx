"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import DonutChart from "./components/DonutChart";
import TasksTab from "./components/TasksTab";
import HandoverTab from "./components/HandoverTab";
import DocumentsTab from "./components/DocumentsTab";
import ProductsTab from "./components/ProductsTab";
import ComplianceTab from "./components/ComplianceTab";
import RelatedFieldsTab from "./components/RelatedFieldsTab";
import SettingsTab from "./components/SettingsTab";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { FormField } from "@/components/ui/FormField";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fmtDate, fmtCurrency } from "@/lib/format";

type Project = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  project_number?: string;
  contact_id?: string;
  contact_name?: string;
  owner_id?: string;
  owner_name?: string;
  task_count?: number;
  completed_task_count?: number;
  category_progress?: Record<string, { total: number; completed: number }>;
  start_date?: string;
  due_date?: string;
  estimated_govt_fee?: number;
  invoice_id?: string;
  sales_order_id?: string;
  sales_order_ids?: string[];
  created_at: string;
  updated_at: string;
};

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  due_date?: string;
  date_assigned?: string;
  assigned_to?: string;
  assignee_name?: string;
  parent_id?: string;
  subtask_count?: number;
  progress_pct?: number;
  subtasks?: Task[];
  created_at: string;
};

const TABS = [
  { key: "tasks", label: "Tasks" },
  { key: "handover", label: "Sales Notes" },
  { key: "compliance", label: "Compliance" },
  { key: "documents", label: "Documents" },
  { key: "products", label: "Products" },
  { key: "related_fields", label: "Related Fields" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = typeof TABS[number]["key"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  planning: { label: "Planning", color: "var(--info)", bg: "var(--info-light)" },
  in_progress: { label: "In Progress", color: "#7c3aed", bg: "#f5f3ff" },
  on_hold: { label: "On Hold", color: "var(--warning)", bg: "var(--warning-light)" },
  completed: { label: "Completed", color: "var(--success)", bg: "var(--success-light)" },
  cancelled: { label: "Cancelled", color: "var(--danger)", bg: "var(--danger-light)" },
};

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "var(--info)", bg: "var(--info-light)" },
  medium: { label: "Medium", color: "#7c3aed", bg: "#f5f3ff" },
  high: { label: "High", color: "#b45309", bg: "#fffbeb" },
  urgent: { label: "Urgent", color: "var(--danger)", bg: "var(--danger-light)" },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;
  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const toast = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => { loadData(); checkFavorite(); }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [projectData, tasksData] = await Promise.all([
        api.get(`/api/projects/${projectId}`),
        api.get(`/api/projects/${projectId}/tasks`),
      ]);
      setProject(projectData as Project);
      setTasks(tasksData as Task[]);
    } catch (err) {
      console.error("Failed to load project", err);
    } finally {
      setLoading(false);
    }
  }

  async function checkFavorite() {
    try {
      const favs = await api.get("/api/projects/favorites") as any[];
      setIsFavorite(favs.some((f: any) => f.project_id === projectId));
    } catch {}
  }

  async function toggleFavorite() {
    try {
      if (isFavorite) {
        await api.delete(`/api/projects/favorites/${projectId}`);
        setIsFavorite(false);
        toast.success("Unpinned from sidebar");
      } else {
        await api.post(`/api/projects/favorites/${projectId}`, {});
        setIsFavorite(true);
        toast.success("Pinned to sidebar");
      }
    } catch (err: any) { toast.error(err.message || "Failed"); }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Project Details</h1>
            <p className="page-subtitle">Loading project information...</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Project Not Found</h1>
          </div>
        </div>
        <div className="empty-state" style={{ minHeight: 400 }}>
          <div className="empty-state-title">Project not found</div>
          <div className="empty-state-description">This project may have been deleted or you don&apos;t have permission to view it</div>
          <a href="/dashboard/projects" className="btn-primary" style={{ textDecoration: "none", marginTop: 16 }}>
            ← Back to Projects
          </a>
        </div>
      </div>
    );
  }

  const overallPct = (project.task_count ?? 0) > 0
    ? Math.round(((project.completed_task_count ?? 0) / (project.task_count ?? 1)) * 100)
    : 0;

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-content">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {fromContactId && fromContactName ? (
              <>
                <a href="/dashboard/contacts" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>Contacts</a>
                <Icon path="M9 18l6-6-6-6" size={14} color="var(--text-quaternary)" />
                <a href={`/dashboard/contacts/${fromContactId}`} style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>{fromContactName}</a>
                <Icon path="M9 18l6-6-6-6" size={14} color="var(--text-quaternary)" />
                <a href={`/dashboard/projects?from_contact=${encodeURIComponent(fromContactId)}&from_contact_name=${encodeURIComponent(fromContactName)}`} style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>Projects</a>
                <Icon path="M9 18l6-6-6-6" size={14} color="var(--text-quaternary)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{project.title}</span>
              </>
            ) : (
              <a
                href="/dashboard/projects"
                style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}
              >
                <Icon path="M19 12H5 M12 19l-7-7 7-7" size={14} />
                Projects
              </a>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {project.project_number && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
                  background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-full)",
                  letterSpacing: "0.03em", display: "inline-block", marginBottom: 6,
                }}>
                  {project.project_number}
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <h1 className="page-title" style={{ marginBottom: 0 }}>{project.title}</h1>
                {STATUS_CFG[project.status] && (
                  <Pill label={STATUS_CFG[project.status].label} color={STATUS_CFG[project.status].color} bg={STATUS_CFG[project.status].bg} size="md" />
                )}
                {project.priority && PRIORITY_CFG[project.priority] && (
                  <Pill label={PRIORITY_CFG[project.priority].label} color={PRIORITY_CFG[project.priority].color} bg={PRIORITY_CFG[project.priority].bg} size="md" />
                )}
              </div>
              {project.description && (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.5, marginTop: 4, maxWidth: 600 }}>
                  {project.description}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={toggleFavorite}
                title={isFavorite ? "Unpin from sidebar" : "Pin to sidebar"}
                style={{
                  display: "flex", alignItems: "center", gap: 6, background: isFavorite ? "var(--accent-amber-light)" : "var(--bg-tertiary)",
                  border: `1px solid ${isFavorite ? "var(--accent-amber)" : "var(--border-primary)"}`, borderRadius: "var(--radius-sm)",
                  padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  color: isFavorite ? "var(--accent-amber)" : "var(--text-secondary)", whiteSpace: "nowrap",
                  transition: "all var(--transition-fast)",
                }}
              >
                <Icon path={isFavorite
                  ? "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  : "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                } size={14} />
                {isFavorite ? "Pinned" : "Pin"}
              </button>
              {(project.sales_order_ids && project.sales_order_ids.length > 0) && (
                <button
                  onClick={() => {
                    if (project.sales_order_ids!.length === 1) {
                      router.push(`/dashboard/orders/${project.sales_order_ids![0]}`);
                    } else {
                      router.push(`/dashboard/orders`);
                    }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)",
                    padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    color: "var(--text-secondary)", whiteSpace: "nowrap",
                  }}
                >
                  <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" size={14} />
                  Sales Order{project.sales_order_ids!.length > 1 ? `s (${project.sales_order_ids!.length})` : ""}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Split Info Row ── */}
      <div className="card" style={{ marginBottom: 0, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {/* Left: Meta info */}
          <div style={{ flex: 1, minWidth: 280, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {project.contact_name && (
              <FormField label="Customer">
                {project.contact_id ? (
                  <a
                    href={`/dashboard/contacts/${project.contact_id}`}
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-blue)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    {project.contact_name}
                    <Icon path="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={12} />
                  </a>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{project.contact_name}</span>
                )}
              </FormField>
            )}
            {project.owner_name && (
              <FormField label="Owner">
                <AvatarChip name={project.owner_name} size={24} showName />
              </FormField>
            )}
            <FormField label="Timeline">
              <span style={{ fontSize: 13, color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={14} color="var(--text-quaternary)" />
                {fmtDate(project.start_date)} → {fmtDate(project.due_date)}
              </span>
            </FormField>
            {project.estimated_govt_fee != null && (
              <FormField label="Est. Govt Fee">
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--success)" }}>
                  {fmtCurrency(project.estimated_govt_fee)}
                </span>
              </FormField>
            )}
          </div>

          {/* Right: Progress donut + category breakdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 24, minWidth: 260 }}>
            {project.category_progress && Object.keys(project.category_progress).length > 0 ? (
              <DonutChart categories={project.category_progress} size={130} strokeWidth={16} />
            ) : (
              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{overallPct}%</span>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>
                    {project.completed_task_count}/{project.task_count} tasks done
                  </span>
                </div>
                <ProgressBar value={overallPct} height={6} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        display: "flex",
        gap: 0,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-primary)",
        borderLeft: "1px solid var(--border-primary)",
        borderRight: "1px solid var(--border-primary)",
        paddingLeft: 16,
        overflowX: "auto",
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 500,
              color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-tertiary)",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid var(--brand-primary)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              whiteSpace: "nowrap",
              textTransform: "capitalize",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="card" style={{ borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", marginTop: 0, borderTop: "none" }}>
        {activeTab === "tasks" && <TasksTab projectId={projectId} tasks={tasks} onReload={loadData} />}
        {activeTab === "handover" && <HandoverTab projectId={projectId} />}
        {activeTab === "compliance" && <ComplianceTab projectId={projectId} />}
        {activeTab === "documents" && <DocumentsTab projectId={projectId} />}
        {activeTab === "products" && <ProductsTab projectId={projectId} />}
        {activeTab === "related_fields" && <RelatedFieldsTab projectId={projectId} />}
        {activeTab === "settings" && <SettingsTab projectId={projectId} project={project} />}
      </div>
    </div>
  );
}
