"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber, fmtDate } from "@/lib/format";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { SpreadsheetView } from "@/components/ui/SpreadsheetView";
import { KanbanView, type KanbanColumnConfig, type GenericCardData } from "@/components/ui/KanbanView";
import { TimelineView } from "@/components/ui/TimelineView";
import { Pill } from "@/components/ui/Pill";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  assigned_to: string | null;
  notes?: string | null;
}

interface Opportunity {
  id: string;
  name: string;
  amount: number | null;
  stage: string;
  probability: number | null;
  expected_close_date: string | null;
  lead_id?: string | null;
  contact_id?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  contact_name?: string | null;
}

interface SimpleUser {
  id: string;
  full_name: string;
}

interface SimpleContact {
  id: string;
  name: string;
  email: string | null;
  phone_primary: string | null;
  contact_type: string;
}

const LEAD_SOURCES = ["Website", "Referral", "LinkedIn", "Cold Call", "Event", "Other"];
const LEAD_STATUSES = ["new", "contacted", "lost"];
const STAGES = [
  { id: "lead", label: "Lead", icon: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M12.5 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { id: "quote_sent", label: "Quote Sent", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" },
  { id: "negotiation", label: "Negotiation", icon: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" },
  { id: "won", label: "Won", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" },
  { id: "lost", label: "Lost", icon: "M18 6L6 18 M6 6l12 12" },
];

const LEAD_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: "var(--info)", bg: "var(--info-light)" },
  contacted: { label: "Contacted", color: "#7c3aed", bg: "#f5f3ff" },
  lost: { label: "Lost", color: "var(--danger)", bg: "var(--danger-light)" },
};

const LEAD_KANBAN_COLUMNS: KanbanColumnConfig[] = LEAD_STATUSES.map((s) => ({
  id: s, label: LEAD_STATUS_CFG[s]?.label || s, color: LEAD_STATUS_CFG[s]?.color || "var(--text-secondary)", bg: LEAD_STATUS_CFG[s]?.bg || "var(--bg-tertiary)",
}));

const STAGE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  lead: { label: "Lead", color: "var(--info)", bg: "var(--info-light)" },
  quote_sent: { label: "Quote Sent", color: "#7c3aed", bg: "#f5f3ff" },
  negotiation: { label: "Negotiation", color: "#b45309", bg: "#fffbeb" },
  won: { label: "Won", color: "var(--success)", bg: "var(--success-light)" },
  lost: { label: "Lost", color: "var(--danger)", bg: "var(--danger-light)" },
};

const PIPELINE_KANBAN_COLUMNS: KanbanColumnConfig[] = STAGES.map((s) => ({
  id: s.id, label: STAGE_CFG[s.id]?.label || s.label, color: STAGE_CFG[s.id]?.color || "var(--text-secondary)", bg: STAGE_CFG[s.id]?.bg || "var(--bg-tertiary)",
}));

function SlidePanel({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: "var(--z-modal-backdrop)" as any, transition: "opacity var(--transition-base)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 540, background: "var(--bg-secondary)", boxShadow: "var(--shadow-xl)", zIndex: "var(--z-modal)" as any, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderBottom: "1px solid var(--border-primary)", position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)", padding: 6, cursor: "pointer", color: "var(--text-tertiary)", transition: "all var(--transition-fast)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
            <Icon path="M18 6L6 18M6 6l12 12" size={16} />
          </button>
        </div>
        <div style={{ flex: 1, padding: "24px 28px" }}>{children}</div>
        {footer && (
          <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border-primary)", display: "flex", gap: 12, background: "var(--bg-secondary)", position: "sticky", bottom: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

export default function CRMPage() {
  const searchParams = useSearchParams();
  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"leads" | "pipeline">("leads");
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [oppModalOpen, setOppModalOpen] = useState(false);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);
  const [editOppId, setEditOppId] = useState<string | null>(null);
  const [convertLeadId, setConvertLeadId] = useState<string | null>(null);
  const [convertPanelOpen, setConvertPanelOpen] = useState(false);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stageMenuOppId, setStageMenuOppId] = useState<string | null>(null);
  const [detailOppId, setDetailOppId] = useState<string | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ status: [], source: [], stage: [] });
  const [groupBy, setGroupBy] = useState("");
  const [viewMode, setViewMode] = useState("spreadsheet");

  useEffect(() => {
    loadData();
    api.get("/api/users/").then((r: any) => setUsers((r as any[]).map((u: any) => ({ id: u.id, full_name: u.full_name })))).catch(() => {});
  }, []);

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/crm/leads/${id}`);
      loadData();
    } catch (err) {
      console.error("Failed to delete lead", err);
      setError((err as { message?: string })?.message || "Failed to delete lead");
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteOpportunity(id: string) {
    if (!confirm("Delete this opportunity?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/crm/opportunities/${id}`);
      loadData();
    } catch (err) {
      console.error("Failed to delete opportunity", err);
      setError((err as { message?: string })?.message || "Failed to delete opportunity");
    } finally {
      setDeletingId(null);
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [leadsData, oppsData] = await Promise.all([
        api.get("/api/crm/leads"),
        api.get("/api/crm/opportunities"),
      ]);
      setLeads(Array.isArray(leadsData) ? (leadsData as Lead[]).filter((l) => l.status !== "qualified") : []);
      setOpportunities(Array.isArray(oppsData) ? (oppsData as Opportunity[]) : []);
    } catch (err) {
      console.error("Failed to load CRM data", err);
      setError((err as Error)?.message || "Failed to load CRM data");
    } finally {
      setLoading(false);
    }
  }

  const leadFilterConfig: FilterFieldConfig[] = useMemo(() => [
    { key: "status", label: "Status", options: LEAD_STATUSES.map((s) => ({ value: s, label: s })) },
    { key: "source", label: "Source", options: LEAD_SOURCES.map((s) => ({ value: s, label: s })) },
  ], []);

  const oppFilterConfig: FilterFieldConfig[] = useMemo(() => [
    { key: "stage", label: "Stage", options: STAGES.map((s) => ({ value: s.id, label: s.label })) },
  ], []);

  const crmGroupOptions = activeTab === "leads"
    ? [{ value: "status", label: "Status" }, { value: "source", label: "Source" }]
    : [{ value: "stage", label: "Stage" }];

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || (l.email && l.email.toLowerCase().includes(q)));
    }
    if (filters.status?.length) list = list.filter((l) => filters.status.includes(l.status));
    if (filters.source?.length) list = list.filter((l) => l.source && filters.source.includes(l.source));
    return list;
  }, [leads, search, filters]);

  const filteredOpportunities = useMemo(() => {
    let list = opportunities;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.name.toLowerCase().includes(q) || (o.contact_name && o.contact_name.toLowerCase().includes(q)));
    }
    if (filters.stage?.length) list = list.filter((o) => filters.stage.includes(o.stage));
    return list;
  }, [opportunities, search, filters]);

  return (
    <div>
      {fromContactId && fromContactName && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/dashboard/contacts" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>Contacts</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <Link href={`/dashboard/contacts/${fromContactId}`} style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>{fromContactName}</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>CRM</span>
        </div>
      )}
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">CRM Pipeline</h1>
          <p className="page-subtitle">Leads, opportunities, and sales pipeline</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary btn-sm">
            <Icon path="M3 17v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3 M8 12l4 4 4-4 M12 2v14" size={16} />
            Import
          </button>
          {activeTab === "leads" ? (
            <button className="btn-primary" onClick={() => { setLeadModalOpen(true); setError(""); }}>
              <Icon path="M12 5v14 M5 12h14" size={18} />
              New Lead
            </button>
          ) : (
            <button className="btn-primary" onClick={() => { setOppModalOpen(true); setConvertLeadId(null); setError(""); }}>
              <Icon path="M12 5v14 M5 12h14" size={18} />
              New Opportunity
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, background: "var(--danger-light)", borderColor: "var(--danger-border)" }}>
          <p style={{ margin: 0, color: "var(--danger)", fontSize: 14 }}>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab("leads")}
            className={activeTab === "leads" ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
          >
            <Icon path="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M12.5 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" size={16} />
            Leads ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pipeline")}
            className={activeTab === "pipeline" ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
          >
            <Icon path="M22 12h-4l-3 9L9 3l-3 9H2" size={16} />
            Pipeline ({opportunities.length})
          </button>
        </div>
      </div>

      {/* Search / Filter / View bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          filterConfig={activeTab === "leads" ? leadFilterConfig : oppFilterConfig}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          groupOptions={crmGroupOptions}
          pageKey={`crm_${activeTab}`}
          placeholder={activeTab === "leads" ? "Search leads..." : "Search opportunities..."}
        />
        <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
          <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading CRM data...</p>
        </div>
      )}

      {/* ===== LEADS TAB ===== */}
      {!loading && activeTab === "leads" && viewMode === "spreadsheet" && (
        <SpreadsheetView<Lead>
          columns={[
            { key: "name", label: "Name", render: (l) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{l.name}</span> },
            { key: "email", label: "Email", render: (l) => <span style={{ color: "var(--text-tertiary)" }}>{l.email || "\u2014"}</span> },
            { key: "phone", label: "Phone", render: (l) => <span style={{ color: "var(--text-tertiary)" }}>{l.phone || "\u2014"}</span> },
            { key: "source", label: "Source", render: (l) => l.source ? <span className="badge badge-neutral">{l.source}</span> : <span>\u2014</span> },
            { key: "status", label: "Status", render: (l) => { const sc = LEAD_STATUS_CFG[l.status] || LEAD_STATUS_CFG.new; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
          ]}
          groups={LEAD_STATUSES.map((s) => {
            const sc = LEAD_STATUS_CFG[s] || LEAD_STATUS_CFG.new;
            return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: filteredLeads.filter((l) => l.status === s) };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(l) => setDetailLeadId(l.id)}
          emptyIcon="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M12.5 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
          emptyLabel="No leads yet"
          emptyDescription="Create your first lead"
        />
      )}

      {!loading && activeTab === "leads" && viewMode === "timeline" && (
        <TimelineView
          items={filteredLeads.map((l) => {
            const sc = LEAD_STATUS_CFG[l.status] || LEAD_STATUS_CFG.new;
            return { id: l.id, title: l.name, color: sc.color, bg: sc.bg, onClick: () => setDetailLeadId(l.id) };
          })}
          emptyLabel="No leads to display on timeline"
        />
      )}

      {!loading && activeTab === "leads" && viewMode === "kanban" && (
        <KanbanView
          columns={LEAD_KANBAN_COLUMNS}
          itemsByColumn={Object.fromEntries(LEAD_STATUSES.map((s) => [
            s,
            filteredLeads.filter((l) => l.status === s).map((l): GenericCardData => ({
              id: l.id,
              title: l.name,
              subtitle: l.email || "No email",
              meta: [
                ...(l.source ? [{ label: "Source", value: l.source }] : []),
                ...(l.phone ? [{ label: "Phone", value: l.phone }] : []),
              ],
            })),
          ]))}
          onItemClick={(id) => setDetailLeadId(id)}
          emptyLabel="No leads"
        />
      )}

      {/* ===== PIPELINE TAB ===== */}
      {!loading && activeTab === "pipeline" && viewMode === "spreadsheet" && (
        <SpreadsheetView<Opportunity>
          columns={[
            { key: "name", label: "Opportunity", render: (o) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{o.name}</span> },
            { key: "contact_name", label: "Contact", render: (o) => <span style={{ color: "var(--text-tertiary)" }}>{o.contact_name || "\u2014"}</span> },
            { key: "stage", label: "Stage", render: (o) => { const sc = STAGE_CFG[o.stage] || STAGE_CFG.lead; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
            { key: "amount", label: "Amount", render: (o) => <span style={{ fontWeight: 600 }}>{o.amount != null ? `${fmtNumber(o.amount)} AED` : "\u2014"}</span> },
            { key: "probability", label: "Probability", render: (o) => <span>{o.probability != null ? `${o.probability}%` : "\u2014"}</span> },
            { key: "expected_close_date", label: "Expected Close", render: (o) => <span style={{ color: "var(--text-tertiary)" }}>{o.expected_close_date ? fmtDate(o.expected_close_date) : "\u2014"}</span> },
          ]}
          groups={STAGES.map((s) => {
            const sc = STAGE_CFG[s.id] || STAGE_CFG.lead;
            return { key: s.id, label: sc.label, color: sc.color, bg: sc.bg, items: filteredOpportunities.filter((o) => o.stage === s.id) };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(o) => setDetailOppId(o.id)}
          emptyIcon="M22 12h-4l-3 9L9 3l-3 9H2"
          emptyLabel="No opportunities yet"
          emptyDescription="Create your first opportunity"
        />
      )}

      {!loading && activeTab === "pipeline" && viewMode === "timeline" && (
        <TimelineView
          items={filteredOpportunities.map((o) => {
            const sc = STAGE_CFG[o.stage] || STAGE_CFG.lead;
            return {
              id: o.id,
              title: `${o.name} \u2014 ${o.amount != null ? fmtNumber(o.amount) + " AED" : "No value"}`,
              endDate: o.expected_close_date || undefined,
              color: sc.color,
              bg: sc.bg,
              onClick: () => setDetailOppId(o.id),
            };
          })}
          emptyLabel="No opportunities to display on timeline"
        />
      )}

      {!loading && activeTab === "pipeline" && viewMode === "kanban" && (
        <KanbanView
          columns={PIPELINE_KANBAN_COLUMNS}
          itemsByColumn={Object.fromEntries(STAGES.map((s) => [
            s.id,
            filteredOpportunities.filter((o) => o.stage === s.id).map((o): GenericCardData => ({
              id: o.id,
              title: o.name,
              subtitle: o.contact_name || undefined,
              meta: [
                { label: "Amount", value: o.amount != null ? `${fmtNumber(o.amount)} AED` : "No value" },
                ...(o.probability != null ? [{ label: "Probability", value: `${o.probability}%` }] : []),
                ...(o.expected_close_date ? [{ label: "Close", value: fmtDate(o.expected_close_date) }] : []),
              ],
            })),
          ]))}
          onItemClick={(id) => setDetailOppId(id)}
          emptyLabel="No opportunities"
        />
      )}

      {/* New Lead Modal */}
      <LeadModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onSuccess={() => { setLeadModalOpen(false); loadData(); }}
        error={error}
        setError={setError}
      />

      {/* Edit Lead Modal */}
      <LeadEditModal
        open={!!editLeadId}
        leadId={editLeadId}
        lead={leads.find((l) => l.id === editLeadId) ?? null}
        onClose={() => setEditLeadId(null)}
        onSuccess={() => { setEditLeadId(null); loadData(); }}
        error={error}
        setError={setError}
      />

      {/* New Opportunity Modal */}
      <OpportunityModal
        open={oppModalOpen}
        onClose={() => setOppModalOpen(false)}
        onSuccess={() => { setOppModalOpen(false); loadData(); }}
        leads={leads}
        convertLeadId={null}
        error={error}
        setError={setError}
      />

      {/* Convert Lead Panel */}
      <ConvertLeadPanel
        open={convertPanelOpen}
        lead={leads.find((l) => l.id === convertLeadId) ?? null}
        users={users}
        onClose={() => { setConvertPanelOpen(false); setConvertLeadId(null); }}
        onSuccess={() => { setConvertPanelOpen(false); setConvertLeadId(null); loadData(); }}
        error={error}
        setError={setError}
      />

      {/* Edit Opportunity Modal */}
      <OpportunityEditModal
        open={!!editOppId}
        oppId={editOppId}
        opportunity={opportunities.find((o) => o.id === editOppId) ?? null}
        leads={leads}
        onClose={() => setEditOppId(null)}
        onSuccess={() => { setEditOppId(null); loadData(); }}
        error={error}
        setError={setError}
      />

      {/* Lead Details Panel */}
      <LeadDetailsPanel
        open={!!detailLeadId}
        lead={leads.find((l) => l.id === detailLeadId) ?? null}
        onClose={() => setDetailLeadId(null)}
        onEdit={() => { setDetailLeadId(null); setEditLeadId(detailLeadId); }}
        onConvert={() => { setDetailLeadId(null); setConvertLeadId(detailLeadId); setConvertPanelOpen(true); setError(""); }}
        onDelete={() => { setDetailLeadId(null); if (detailLeadId) deleteLead(detailLeadId); }}
      />

      {/* Opportunity Details Panel */}
      <OpportunityDetailsPanel
        open={!!detailOppId}
        opportunity={opportunities.find((o) => o.id === detailOppId) ?? null}
        users={users}
        onClose={() => setDetailOppId(null)}
        onEdit={() => { setDetailOppId(null); setEditOppId(detailOppId); }}
        onSuccess={() => { loadData(); }}
        onDelete={() => { setDetailOppId(null); if (detailOppId) deleteOpportunity(detailOppId); }}
      />
    </div>
  );
}

// --- Lead Form Panel ---
function LeadModal({ open, onClose, onSuccess, error, setError }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  error: string; setError: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/crm/leads", {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        source: source || null,
        status,
        notes: notes.trim() || null,
      });
      setName(""); setEmail(""); setPhone(""); setSource(""); setNotes("");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create lead");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <SlidePanel open={open} onClose={onClose} title="New Lead" subtitle="Add a new prospect to your pipeline"
      footer={<>
        <button type="submit" form="lead-form" className="btn-primary" disabled={loading} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600 }}>{loading ? "Creating..." : "Create Lead"}</button>
        <button type="button" onClick={onClose} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
      </>}
    >
      <form id="lead-form" onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Lead name" style={{ margin: 0 }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" style={{ margin: 0 }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 ..." style={{ margin: 0 }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Source</label><select value={source} onChange={(e) => setSource(e.target.value)} style={{ margin: 0 }}><option value="">—</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} style={{ margin: 0 }}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" style={{ margin: 0 }} /></div>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        </div>
      </form>
    </SlidePanel>
  );
}

// --- Lead Edit Panel ---
function LeadEditModal({ open, leadId, lead, onClose, onSuccess, error, setError }: {
  open: boolean; leadId: string | null; lead: Lead | null;
  onClose: () => void; onSuccess: () => void;
  error: string; setError: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lead) {
      setName(lead.name);
      setEmail(lead.email || "");
      setPhone(lead.phone || "");
      setSource(lead.source || "");
      setStatus(lead.status || "new");
      setNotes(lead.notes || "");
    }
  }, [lead?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId) return;
    setError("");
    setLoading(true);
    try {
      await api.patch(`/api/crm/leads/${leadId}`, {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        source: source || null,
        status,
        notes: notes.trim() || null,
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to update lead");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <SlidePanel open={open} onClose={onClose} title="Edit Lead" subtitle="Update lead details"
      footer={<>
        <button type="submit" form="lead-edit-form" className="btn-primary" disabled={loading} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600 }}>{loading ? "Saving..." : "Save Changes"}</button>
        <button type="button" onClick={onClose} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
      </>}
    >
      <form id="lead-edit-form" onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Lead name" style={{ margin: 0 }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" style={{ margin: 0 }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 ..." style={{ margin: 0 }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Source</label><select value={source} onChange={(e) => setSource(e.target.value)} style={{ margin: 0 }}><option value="">—</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} style={{ margin: 0 }}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" style={{ margin: 0 }} /></div>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        </div>
      </form>
    </SlidePanel>
  );
}

// --- Opportunity Form Panel ---
function OpportunityModal({ open, onClose, onSuccess, leads, convertLeadId, error, setError }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  leads: Lead[]; convertLeadId: string | null;
  error: string; setError: (s: string) => void;
}) {
  const lead = useMemo(() => (convertLeadId ? leads.find((l) => l.id === convertLeadId) : null), [convertLeadId, leads]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState("lead");
  const [probability, setProbability] = useState("25");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lead) {
      setName(lead.name);
      setLeadId(lead.id);
    } else {
      setName("");
      setLeadId(convertLeadId);
    }
  }, [lead?.id, convertLeadId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/crm/opportunities", {
        name: name.trim(),
        amount: amount ? parseFloat(amount) : null,
        stage,
        probability: probability ? parseInt(probability, 10) : null,
        expected_close_date: expectedCloseDate || null,
        lead_id: convertLeadId || leadId || null,
      });
      setName(""); setAmount(""); setExpectedCloseDate(""); setLeadId(null);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create opportunity");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <SlidePanel open={open} onClose={onClose} title={convertLeadId ? "Convert Lead to Opportunity" : "New Opportunity"} subtitle={convertLeadId ? "Create an opportunity from this lead" : "Add a new opportunity to your pipeline"}
      footer={<>
        <button type="submit" form="opp-form" className="btn-primary" disabled={loading} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600 }}>{loading ? "Creating..." : convertLeadId ? "Convert to Opportunity" : "Create Opportunity"}</button>
        <button type="button" onClick={onClose} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
      </>}
    >
      <form id="opp-form" onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Opportunity name" style={{ margin: 0 }} /></div>
          {!convertLeadId && leads.length > 0 && (
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Link to Lead</label><select value={leadId || ""} onChange={(e) => setLeadId(e.target.value || null)} style={{ margin: 0 }}><option value="">—</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
          )}
          {convertLeadId && <input type="hidden" value={convertLeadId} />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Amount (AED)</label><input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ margin: 0 }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Probability (%)</label><input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="25" style={{ margin: 0 }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Stage</label><select value={stage} onChange={(e) => setStage(e.target.value)} style={{ margin: 0 }}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Expected close date</label><input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} style={{ margin: 0 }} /></div>
          </div>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        </div>
      </form>
    </SlidePanel>
  );
}

// --- Opportunity Edit Panel ---
function OpportunityEditModal({ open, oppId, opportunity, leads, onClose, onSuccess, error, setError }: {
  open: boolean; oppId: string | null; opportunity: Opportunity | null;
  leads: Lead[]; onClose: () => void; onSuccess: () => void;
  error: string; setError: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState("lead");
  const [probability, setProbability] = useState("25");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opportunity) {
      setName(opportunity.name);
      setAmount(opportunity.amount != null ? String(Number(opportunity.amount)) : "");
      setStage(opportunity.stage || "lead");
      setProbability(opportunity.probability != null ? String(Number(opportunity.probability)) : "25");
      setExpectedCloseDate(opportunity.expected_close_date || "");
      setLeadId(opportunity.lead_id ?? null);
    }
  }, [opportunity?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oppId) return;
    setError("");
    setLoading(true);
    try {
      await api.patch(`/api/crm/opportunities/${oppId}`, {
        name: name.trim(),
        amount: amount ? parseFloat(amount) : null,
        stage,
        probability: probability ? parseInt(probability, 10) : null,
        expected_close_date: expectedCloseDate || null,
        lead_id: leadId || null,
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to update opportunity");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <SlidePanel open={open} onClose={onClose} title="Edit Opportunity" subtitle="Update opportunity details"
      footer={<>
        <button type="submit" form="opp-edit-form" className="btn-primary" disabled={loading} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600 }}>{loading ? "Saving..." : "Save Changes"}</button>
        <button type="button" onClick={onClose} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
      </>}
    >
      <form id="opp-edit-form" onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Opportunity name" style={{ margin: 0 }} /></div>
          {leads.length > 0 && (
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Link to Lead</label><select value={leadId || ""} onChange={(e) => setLeadId(e.target.value || null)} style={{ margin: 0 }}><option value="">—</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Amount (AED)</label><input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ margin: 0 }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Probability (%)</label><input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="25" style={{ margin: 0 }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Stage</label><select value={stage} onChange={(e) => setStage(e.target.value)} style={{ margin: 0 }}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Expected close date</label><input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} style={{ margin: 0 }} /></div>
          </div>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        </div>
      </form>
    </SlidePanel>
  );
}

// --- Lead Details Panel ---
function LeadDetailsPanel({ open, lead, onClose, onEdit, onConvert, onDelete }: {
  open: boolean; lead: Lead | null;
  onClose: () => void; onEdit: () => void; onConvert: () => void; onDelete: () => void;
}) {
  if (!open || !lead) return null;
  return (
    <SlidePanel open={open} onClose={onClose} title={lead.name} subtitle="Lead Details"
      footer={<>
        <button type="button" className="btn-primary" onClick={onConvert} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />
            Convert to Opportunity
          </span>
        </button>
        <button type="button" onClick={onEdit} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />
        </button>
        <button type="button" onClick={onDelete} style={{ background: "var(--bg-tertiary)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={14} />
        </button>
      </>}
    >
      {/* Status Badge */}
      <div style={{ marginBottom: 20 }}>
        <span className={`badge badge-${lead.status === "lost" ? "danger" : "info"}`} style={{ fontSize: 12, padding: "4px 12px" }}>
          {lead.status}
        </span>
      </div>

      {/* Lead Info */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Contact Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Name</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lead.name}</span>
          </div>
          {lead.email && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Email</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Phone</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lead.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Source & Details */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lead.source && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Source</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>{lead.source}</span>
            </div>
          )}
          {lead.assigned_to && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Assigned To</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lead.assigned_to}</span>
            </div>
          )}
          {lead.notes && (
            <div style={{ fontSize: 13 }}>
              <div style={{ color: "var(--text-quaternary)", fontWeight: 500, marginBottom: 4 }}>Notes</div>
              <div style={{ color: "var(--text-secondary)", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", padding: "10px 12px", fontSize: 12, lineHeight: 1.5, border: "1px solid var(--border-primary)" }}>{lead.notes}</div>
            </div>
          )}
        </div>
      </div>
    </SlidePanel>
  );
}

// --- Convert Lead Panel ---
function ConvertLeadPanel({ open, lead, users, onClose, onSuccess, error, setError }: {
  open: boolean; lead: Lead | null; users: SimpleUser[];
  onClose: () => void; onSuccess: () => void;
  error: string; setError: (s: string) => void;
}) {
  const [allContacts, setAllContacts] = useState<SimpleContact[]>([]);
  const [matchedContacts, setMatchedContacts] = useState<SimpleContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [oppName, setOppName] = useState("");
  const [amount, setAmount] = useState("");
  const [probability, setProbability] = useState("25");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (lead) {
      setOppName(lead.name);
      setAssignedTo(lead.assigned_to || "");
      setSelectedContactId(null);
      setContactSearch("");
      setShowAllContacts(false);
      setAmount(""); setProbability("25"); setExpectedCloseDate("");
      setSearching(true);
      // Fetch all contacts and find matches
      api.get("/api/contacts/")
        .then((res: any) => {
          const contacts = (res as SimpleContact[]) || [];
          setAllContacts(contacts);
          const matched = contacts.filter((c: SimpleContact) => {
            const nameMatch = c.name.toLowerCase().includes(lead.name.toLowerCase()) || lead.name.toLowerCase().includes(c.name.toLowerCase());
            const emailMatch = lead.email && c.email && c.email.toLowerCase() === lead.email.toLowerCase();
            const phoneMatch = lead.phone && c.phone_primary && c.phone_primary.replace(/\s/g, "") === lead.phone.replace(/\s/g, "");
            return nameMatch || emailMatch || phoneMatch;
          });
          setMatchedContacts(matched);
          if (matched.length === 1) setSelectedContactId(matched[0].id);
        })
        .catch(() => { setAllContacts([]); setMatchedContacts([]); })
        .finally(() => setSearching(false));
    }
  }, [lead?.id]);

  const filteredAllContacts = useMemo(() => {
    if (!contactSearch.trim()) return allContacts;
    const q = contactSearch.toLowerCase();
    return allContacts.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone_primary && c.phone_primary.includes(q))
    );
  }, [allContacts, contactSearch]);

  const selectedContact = allContacts.find((c) => c.id === selectedContactId);

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    if (!selectedContactId) {
      setError("A contact must be linked to convert this lead. Select an existing contact or create one first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/api/crm/opportunities", {
        name: oppName.trim(),
        lead_id: lead.id,
        contact_id: selectedContactId,
        assigned_to: assignedTo || null,
        amount: amount ? parseFloat(amount) : null,
        stage: "lead",
        probability: probability ? parseInt(probability, 10) : null,
        expected_close_date: expectedCloseDate || null,
      });
      await api.patch(`/api/crm/leads/${lead.id}`, { status: "qualified" }).catch(() => {});
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to convert lead");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !lead) return null;
  return (
    <SlidePanel open={open} onClose={onClose} title="Convert Lead to Opportunity" subtitle={`Converting "${lead.name}" into a pipeline opportunity`}
      footer={<>
        <button type="submit" form="convert-form" className="btn-primary" disabled={loading || !selectedContactId} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600, opacity: selectedContactId ? 1 : 0.5 }}>{loading ? "Converting..." : "Convert to Opportunity"}</button>
        <button type="button" onClick={onClose} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
      </>}
    >
      {/* Lead Info Summary */}
      <div style={{ background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20, border: "1px solid var(--border-primary)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Lead Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
          <div><span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Name:</span> <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lead.name}</span></div>
          <div><span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Status:</span> <span className={`badge badge-${lead.status === "qualified" ? "success" : lead.status === "lost" ? "danger" : "info"}`} style={{ fontSize: 11 }}>{lead.status}</span></div>
          {lead.email && <div><span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Email:</span> <span style={{ color: "var(--text-primary)" }}>{lead.email}</span></div>}
          {lead.phone && <div><span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Phone:</span> <span style={{ color: "var(--text-primary)" }}>{lead.phone}</span></div>}
          {lead.source && <div><span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Source:</span> <span style={{ color: "var(--text-primary)" }}>{lead.source}</span></div>}
        </div>
      </div>

      {/* Contact Selection (REQUIRED) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Link to Contact <span style={{ color: "var(--danger)" }}>*</span></div>
          {!selectedContactId && !showAllContacts && matchedContacts.length === 0 && (
            <button type="button" onClick={() => setShowAllContacts(true)} style={{ fontSize: 11, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Browse all contacts</button>
          )}
        </div>

        {/* Selected contact display */}
        {selectedContactId && selectedContact ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: "rgba(59,130,246,0.08)", border: "2px solid var(--accent-blue)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: selectedContact.contact_type === "company" ? "var(--accent-blue)" : "var(--accent-purple, #8b5cf6)",
              color: "#fff", fontSize: 13, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {selectedContact.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{selectedContact.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-quaternary)" }}>
                {selectedContact.contact_type} {selectedContact.email ? `· ${selectedContact.email}` : ""} {selectedContact.phone_primary ? `· ${selectedContact.phone_primary}` : ""}
              </div>
            </div>
            <button type="button" onClick={() => { setSelectedContactId(null); setShowAllContacts(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-quaternary)", fontSize: 12, fontWeight: 600 }}>Change</button>
          </div>
        ) : searching ? (
          <div style={{ padding: 16, textAlign: "center", color: "var(--text-quaternary)", fontSize: 13 }}>Searching for matching contacts...</div>
        ) : (
          <>
            {/* Suggested matches */}
            {matchedContacts.length > 0 && !showAllContacts && (
              <>
                <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginBottom: 6, fontWeight: 500 }}>Suggested matches:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                  {matchedContacts.map((c) => (
                    <button key={c.id} type="button" onClick={() => setSelectedContactId(c.id)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)",
                      borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left",
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.contact_type === "company" ? "var(--accent-blue)" : "var(--accent-purple, #8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-quaternary)" }}>{c.contact_type} {c.email ? `· ${c.email}` : ""} {c.phone_primary ? `· ${c.phone_primary}` : ""}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowAllContacts(true)} style={{ fontSize: 11, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Search all contacts instead</button>
              </>
            )}

            {/* Browse/search all contacts */}
            {(showAllContacts || matchedContacts.length === 0) && (
              <>
                <input
                  placeholder="Search contacts by name, email, or phone..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  style={{ margin: 0, marginBottom: 8, fontSize: 13 }}
                />
                <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {filteredAllContacts.length === 0 ? (
                    <div style={{ padding: 14, textAlign: "center", fontSize: 12, color: "var(--text-quaternary)" }}>
                      No contacts found. <a href="/dashboard/contacts" target="_blank" style={{ color: "var(--accent-blue)", fontWeight: 600 }}>Create a new contact</a> first.
                    </div>
                  ) : filteredAllContacts.map((c) => (
                    <button key={c.id} type="button" onClick={() => { setSelectedContactId(c.id); setShowAllContacts(false); setContactSearch(""); }} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)",
                      borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left", fontSize: 12,
                    }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: c.contact_type === "company" ? "var(--accent-blue)" : "var(--accent-purple, #8b5cf6)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                        <span style={{ color: "var(--text-quaternary)", marginLeft: 6, fontSize: 11 }}>{c.contact_type} {c.email ? `· ${c.email}` : ""}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Warning */}
            {!selectedContactId && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius-md)", fontSize: 11, color: "var(--danger)", fontWeight: 500 }}>
                A contact must be linked to convert this lead to an opportunity.
              </div>
            )}
          </>
        )}
      </div>

      {/* Opportunity Form */}
      <form id="convert-form" onSubmit={handleConvert}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Opportunity Name *</label><input value={oppName} onChange={(e) => setOppName(e.target.value)} required placeholder="Opportunity name" style={{ margin: 0 }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Assign to Salesperson</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={{ margin: 0 }}>
              <option value="">— Unassigned —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Amount (AED)</label><input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ margin: 0 }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Probability (%)</label><input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="25" style={{ margin: 0 }} /></div>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Expected Close Date</label><input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} style={{ margin: 0 }} /></div>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        </div>
      </form>
    </SlidePanel>
  );
}

// --- Opportunity Details Panel ---
function OpportunityDetailsPanel({ open, opportunity, users, onClose, onEdit, onSuccess, onDelete }: {
  open: boolean; opportunity: Opportunity | null; users: SimpleUser[];
  onClose: () => void; onEdit: () => void; onSuccess: () => void; onDelete: () => void;
}) {
  const router = useRouter();
  const [changingStage, setChangingStage] = useState(false);
  const [screeningDoc, setScreeningDoc] = useState<{ id: string; file_name: string; submitted_at?: string } | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [uploadingScreening, setUploadingScreening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Contact linking for opportunities without a contact
  const [linkingContact, setLinkingContact] = useState(false);
  const [linkContactList, setLinkContactList] = useState<SimpleContact[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState("");
  const [linkContactLoading, setLinkContactLoading] = useState(false);

  const SCREENING_STAGES = ["quote_sent", "negotiation", "won"];
  const showScreening = opportunity && SCREENING_STAGES.includes(opportunity.stage);

  useEffect(() => {
    setLinkingContact(false);
    setLinkContactSearch("");
    setLinkContactList([]);
  }, [opportunity?.id]);

  useEffect(() => {
    if (!opportunity?.contact_id || !showScreening) {
      setScreeningDoc(null);
      return;
    }
    setScreeningLoading(true);
    api.get(`/api/documents/?contact_id=${opportunity.contact_id}&category=screening_form`)
      .then((docs: any) => {
        const arr = docs as any[];
        if (arr.length > 0) {
          setScreeningDoc({ id: arr[0].id, file_name: arr[0].file_name, submitted_at: arr[0].created_at });
        } else {
          setScreeningDoc(null);
        }
      })
      .catch(() => setScreeningDoc(null))
      .finally(() => setScreeningLoading(false));
  }, [opportunity?.id, opportunity?.contact_id, opportunity?.stage]);

  function startLinkingContact() {
    setLinkingContact(true);
    setLinkContactLoading(true);
    api.get("/api/contacts/")
      .then((res: any) => setLinkContactList((res as SimpleContact[]) || []))
      .catch(() => setLinkContactList([]))
      .finally(() => setLinkContactLoading(false));
  }

  async function linkContact(contactId: string) {
    if (!opportunity) return;
    try {
      await api.patch(`/api/crm/opportunities/${opportunity.id}`, { contact_id: contactId });
      setLinkingContact(false);
      onSuccess();
    } catch (err) {
      console.error("Failed to link contact", err);
    }
  }

  async function changeStage(newStage: string) {
    if (!opportunity || newStage === opportunity.stage) return;
    setChangingStage(true);
    try {
      await api.patch(`/api/crm/opportunities/${opportunity.id}`, { stage: newStage });
      onSuccess();
    } catch (err) {
      console.error("Failed to update stage", err);
    } finally {
      setChangingStage(false);
    }
  }

  async function handleScreeningUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !opportunity?.contact_id) return;
    setUploadingScreening(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("contact_id", opportunity.contact_id);
      fd.append("category", "screening_form");
      fd.append("description", `Screening form for opportunity: ${opportunity.name}`);
      const doc = await api.postForm("/api/documents/", fd) as any;
      setScreeningDoc({ id: doc.id, file_name: doc.file_name, submitted_at: doc.created_at });
    } catch (err: any) {
      console.error("Failed to upload screening form", err);
    } finally {
      setUploadingScreening(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!open || !opportunity) return null;

  const currentStage = STAGES.find((s) => s.id === opportunity.stage);
  const assignedUser = users.find((u) => u.id === opportunity.assigned_to);

  return (
    <SlidePanel open={open} onClose={onClose} title={opportunity.name} subtitle="Opportunity Details"
      footer={<>
        <button type="button" className="btn-primary" onClick={onEdit} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />
            Edit Opportunity
          </span>
        </button>
        <button type="button" onClick={onDelete} style={{ background: "var(--bg-tertiary)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={14} />
        </button>
      </>}
    >
      {/* Key Info Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", padding: 14, border: "1px solid var(--border-primary)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Value</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            {opportunity.amount != null ? fmtNumber(opportunity.amount) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 2 }}>AED</div>
        </div>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", padding: 14, border: "1px solid var(--border-primary)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Probability</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            {opportunity.probability != null ? `${Number(opportunity.probability)}%` : "—"}
          </div>
          {opportunity.probability != null && (
            <div style={{ height: 4, background: "var(--border-primary)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Number(opportunity.probability)}%`, background: "var(--accent-blue)", borderRadius: 2 }} />
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opportunity.contact_name ? (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Contact</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{opportunity.contact_name}</span>
            </div>
          ) : !linkingContact ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Contact</span>
              <button type="button" onClick={startLinkingContact} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-blue)", fontSize: 12, fontWeight: 600 }}>+ Link Contact</button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Contact</span>
                <button type="button" onClick={() => setLinkingContact(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-quaternary)", fontSize: 11, fontWeight: 500 }}>Cancel</button>
              </div>
              {linkContactLoading ? (
                <div style={{ fontSize: 12, color: "var(--text-quaternary)", padding: 8, textAlign: "center" }}>Loading contacts...</div>
              ) : (
                <>
                  <input placeholder="Search contacts..." value={linkContactSearch} onChange={(e) => setLinkContactSearch(e.target.value)} style={{ margin: 0, marginBottom: 6, fontSize: 12, padding: "6px 10px" }} />
                  <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                    {linkContactList
                      .filter((c) => !linkContactSearch.trim() || c.name.toLowerCase().includes(linkContactSearch.toLowerCase()) || (c.email && c.email.toLowerCase().includes(linkContactSearch.toLowerCase())))
                      .slice(0, 20)
                      .map((c) => (
                        <button key={c.id} type="button" onClick={() => linkContact(c.id)} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                          background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)",
                          borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left", fontSize: 12,
                        }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-blue)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                          {c.email && <span style={{ color: "var(--text-quaternary)", fontSize: 11 }}>{c.email}</span>}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
          {assignedUser && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Assigned To</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{assignedUser.full_name}</span>
            </div>
          )}
          {opportunity.assigned_to_name && !assignedUser && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Assigned To</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{opportunity.assigned_to_name}</span>
            </div>
          )}
          {opportunity.expected_close_date && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Expected Close</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmtDate(opportunity.expected_close_date)}</span>
            </div>
          )}
          {opportunity.lead_id && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>Linked Lead</span>
              <span style={{ color: "var(--accent-blue)", fontWeight: 500, fontSize: 12 }}>Yes</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Quotation Action */}
      {opportunity.stage !== "lost" && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Actions</div>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("opportunity_id", opportunity.id);
              params.set("opportunity_name", opportunity.name);
              if (opportunity.contact_id) params.set("contact_id", opportunity.contact_id);
              if (opportunity.lead_id) params.set("lead_id", opportunity.lead_id);
              if (opportunity.amount != null) params.set("amount", String(Number(opportunity.amount)));
              onClose();
              router.push(`/dashboard/quotations?${params.toString()}`);
            }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
              background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: 13, fontWeight: 600,
              color: "var(--text-primary)", transition: "all var(--transition-fast)",
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "var(--accent-blue)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" size={16} />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div>Create Quotation</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text-quaternary)", marginTop: 1 }}>Generate a quote from this opportunity</div>
            </div>
            <Icon path="M5 12h14 M12 5l7 7-7 7" size={16} />
          </button>
        </div>
      )}

      {/* Screening Form - visible at quote_sent stage and beyond */}
      {showScreening && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Compliance Screening</div>
          {!opportunity.contact_id ? (
            <div style={{
              padding: 16, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
              border: "1px dashed var(--border-primary)", textAlign: "center",
            }}>
              <div style={{ fontSize: 13, color: "var(--text-quaternary)", marginBottom: 4 }}>No contact linked</div>
              <div style={{ fontSize: 11, color: "var(--text-quaternary)" }}>Link a contact to this opportunity to submit a screening form.</div>
            </div>
          ) : screeningLoading ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-quaternary)", fontSize: 13 }}>Loading screening status...</div>
          ) : screeningDoc ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              background: "rgba(34,197,94,0.08)", borderRadius: "var(--radius-md)",
              border: "1px solid rgba(34,197,94,0.25)",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#22c55e",
              }}>
                <Icon path="M9 12l2 2 4-4" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Screening Form Submitted</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {screeningDoc.file_name}
                  {screeningDoc.submitted_at && <> &middot; {fmtDate(screeningDoc.submitted_at)}</>}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: "var(--radius-full)", background: "#22c55e", color: "#fff" }}>SUBMITTED</span>
            </div>
          ) : (
            <div style={{
              padding: 16, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
              border: "1px dashed var(--border-primary)", textAlign: "center",
            }}>
              <div style={{ marginBottom: 10 }}>
                <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={28} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Screening Form Required</div>
              <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginBottom: 12 }}>Upload the KYC screening document for {opportunity.contact_name || "this contact"}.</div>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleScreeningUpload} style={{ display: "none" }} />
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={uploadingScreening}
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 13, padding: "8px 20px" }}
              >
                <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={14} />
                {uploadingScreening ? "Uploading..." : "Submit Screening Form"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stage Selector */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Pipeline Stage</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={changingStage}
              onClick={() => changeStage(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                background: s.id === opportunity.stage ? "var(--brand-primary)" : "var(--bg-tertiary)",
                color: s.id === opportunity.stage ? "#fff" : "var(--text-secondary)",
                border: s.id === opportunity.stage ? "none" : "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)", cursor: s.id === opportunity.stage ? "default" : "pointer",
                fontSize: 13, fontWeight: 600,
                transition: "all var(--transition-fast)",
                opacity: changingStage ? 0.6 : 1,
              }}
            >
              <Icon path={s.icon} size={15} />
              {s.label}
              {s.id === opportunity.stage && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.8, fontWeight: 500 }}>Current</span>}
            </button>
          ))}
        </div>
      </div>
    </SlidePanel>
  );
}
