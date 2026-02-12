"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { SpreadsheetView } from "@/components/ui/SpreadsheetView";
import { KanbanView, type KanbanColumnConfig, type GenericCardData } from "@/components/ui/KanbanView";
import { TimelineView } from "@/components/ui/TimelineView";
import { Pill } from "@/components/ui/Pill";
import { exportToCsv } from "@/lib/export";

interface Contact {
  id: string;
  contact_type: string;
  name: string;
  email: string | null;
  status: string;
  trade_license_no: string | null;
  jurisdiction: string | null;
  license_expiry_date: string | null;
  visa_expiry_date: string | null;
  vat_registered?: boolean | null;
  ct_registered?: boolean | null;
  vat_first_period_end_date?: string | null;
  vat_return_due_days?: number | null;
  ct_financial_year_start_month?: number | null;
  ct_filing_due_months?: number | null;
  created_at?: string;
}

const CONTACT_STATUSES = ["active", "expired", "under_renewal", "cancelled"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "var(--success)", bg: "var(--success-light)" },
  expired: { label: "Expired", color: "var(--danger)", bg: "var(--danger-light)" },
  under_renewal: { label: "Under Renewal", color: "#b45309", bg: "#fffbeb" },
  cancelled: { label: "Cancelled", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
};

const KANBAN_COLUMNS: KanbanColumnConfig[] = CONTACT_STATUSES.map((s) => ({
  id: s,
  label: STATUS_CFG[s]?.label || s,
  color: STATUS_CFG[s]?.color || "var(--text-secondary)",
  bg: STATUS_CFG[s]?.bg || "var(--bg-tertiary)",
}));

export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ status: [], contact_type: [], jurisdiction: [] });
  const [groupBy, setGroupBy] = useState("");
  const [viewMode, setViewMode] = useState("spreadsheet");
  const [showExpiring, setShowExpiring] = useState(searchParams.get("expiring") === "1");

  function load() {
    setLoading(true);
    if (showExpiring) {
      api.get("/api/contacts/expiring?days=90").then((data: Contact[]) => { setContacts(data); setLoading(false); }).catch(() => setLoading(false));
      return;
    }
    api.get("/api/contacts/").then((data: Contact[]) => { setContacts(data); setLoading(false); }).catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [showExpiring]);

  const uniqueJurisdictions = useMemo(() => [...new Set(contacts.map((c) => c.jurisdiction).filter(Boolean))] as string[], [contacts]);

  const contactFilterConfig: FilterFieldConfig[] = useMemo(() => [
    { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "expired", label: "Expired" }, { value: "under_renewal", label: "Under Renewal" }, { value: "cancelled", label: "Cancelled" }] },
    { key: "contact_type", label: "Type", options: [{ value: "company", label: "Company" }, { value: "individual", label: "Individual" }] },
    ...(uniqueJurisdictions.length > 0 ? [{ key: "jurisdiction", label: "Jurisdiction", options: uniqueJurisdictions.map((j) => ({ value: j, label: j })) }] : []),
  ], [uniqueJurisdictions]);

  const contactGroupOptions = [
    { value: "status", label: "Status" },
    { value: "contact_type", label: "Type" },
    { value: "jurisdiction", label: "Jurisdiction" },
  ];

  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)) || (c.trade_license_no && c.trade_license_no.toLowerCase().includes(q)));
    }
    if (filters.status?.length) list = list.filter((c) => filters.status.includes(c.status));
    if (filters.contact_type?.length) list = list.filter((c) => filters.contact_type.includes(c.contact_type));
    if (filters.jurisdiction?.length) list = list.filter((c) => c.jurisdiction && filters.jurisdiction.includes(c.jurisdiction));
    return list;
  }, [contacts, search, filters]);

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Manage companies and individuals</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => exportToCsv("contacts", filteredContacts, [
            { key: "name", label: "Name" },
            { key: "contact_type", label: "Type" },
            { key: "email", label: "Email" },
            { key: "status", label: "Status" },
            { key: "jurisdiction", label: "Jurisdiction" },
            { key: "trade_license_no", label: "Trade License" },
            { key: "license_expiry_date", label: "License Expiry" },
          ])}>
            <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
            Export
          </button>
          <a href="/dashboard/contacts/new" className="btn-primary">
            <Icon path="M12 5v14 M5 12h14" size={16} />
            New Contact
          </a>
        </div>
      </div>

      {/* Search / Filter / View bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, flexWrap: "wrap" }}>
          <SearchFilterBar
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onFiltersChange={setFilters}
            filterConfig={contactFilterConfig}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            groupOptions={contactGroupOptions}
            pageKey="contacts"
            placeholder="Search contacts..."
          />
          <label style={{
            display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
            fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
            padding: "6px 10px", borderRadius: "var(--radius-md)",
            border: showExpiring ? "1px solid var(--accent-blue)" : "1px solid var(--border-primary)",
            background: showExpiring ? "var(--accent-blue-light)" : "var(--bg-secondary)",
            transition: "all var(--transition-fast)", whiteSpace: "nowrap",
          }}>
            <input type="checkbox" checked={showExpiring} onChange={(e) => setShowExpiring(e.target.checked)} style={{ width: 14, height: 14, cursor: "pointer" }} />
            Expiring 90d
          </label>
        </div>
        <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
          <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading contacts...</p>
        </div>
      )}

      {/* Spreadsheet View */}
      {!loading && viewMode === "spreadsheet" && (
        <SpreadsheetView<Contact>
          columns={[
            { key: "contact_type", label: "Type", render: (c) => <span className={`badge badge-${c.contact_type === "company" ? "primary" : "accent"}`}>{c.contact_type}</span> },
            { key: "name", label: "Name", render: (c) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span> },
            { key: "email", label: "Email", render: (c) => <span style={{ color: "var(--text-tertiary)" }}>{c.email || "\u2014"}</span> },
            { key: "trade_license_no", label: "License No.", render: (c) => <span style={{ color: "var(--text-tertiary)", fontFamily: "monospace", fontSize: 13 }}>{c.trade_license_no || "\u2014"}</span> },
            { key: "jurisdiction", label: "Jurisdiction", render: (c) => c.jurisdiction ? <span className="badge badge-neutral">{c.jurisdiction}</span> : <span>\u2014</span> },
            { key: "status", label: "Status", render: (c) => { const sc = STATUS_CFG[c.status] || STATUS_CFG.active; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
            { key: "license_expiry_date", label: "License expires", render: (c) => <span style={{ color: "var(--text-tertiary)" }}>{c.license_expiry_date || "\u2014"}</span> },
            { key: "tax", label: "Tax", render: (c) => (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.vat_registered && <span className="badge badge-info" style={{ fontSize: 11 }}>VAT</span>}
                {c.ct_registered && <span className="badge badge-warning" style={{ fontSize: 11 }}>CT</span>}
                {!c.vat_registered && !c.ct_registered && <span style={{ color: "var(--text-quaternary)", fontSize: 13 }}>\u2014</span>}
              </div>
            ) },
            { key: "actions", label: "Actions", align: "right", render: (c) => (
              <span onClick={(e) => e.stopPropagation()}>
                <a href={`/dashboard/contacts/${c.id}`} className="btn-sm btn-ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  View <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />
                </a>
              </span>
            ) },
          ]}
          groups={CONTACT_STATUSES.map((s) => {
            const sc = STATUS_CFG[s] || STATUS_CFG.active;
            return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: filteredContacts.filter((c) => c.status === s) };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(c) => router.push(`/dashboard/contacts/${c.id}`)}
          emptyIcon="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"
          emptyLabel="No contacts found"
          emptyDescription={search || Object.values(filters).some((a) => a.length > 0) || showExpiring ? "Try adjusting your filters" : "Get started by creating your first contact"}
        />
      )}

      {/* Timeline View */}
      {!loading && viewMode === "timeline" && (
        <TimelineView
          items={filteredContacts.map((c) => {
            const sc = STATUS_CFG[c.status] || STATUS_CFG.active;
            return {
              id: c.id,
              title: c.name,
              startDate: c.created_at,
              endDate: c.license_expiry_date || undefined,
              color: sc.color,
              bg: sc.bg,
              onClick: () => router.push(`/dashboard/contacts/${c.id}`),
            };
          })}
          emptyLabel="No contacts to display on timeline"
        />
      )}

      {/* Kanban View */}
      {!loading && viewMode === "kanban" && (
        <KanbanView
          columns={KANBAN_COLUMNS}
          itemsByColumn={Object.fromEntries(CONTACT_STATUSES.map((s) => [
            s,
            filteredContacts.filter((c) => c.status === s).map((c): GenericCardData => ({
              id: c.id,
              title: c.name,
              subtitle: c.email || "No email",
              badge: c.contact_type === "company"
                ? { label: "Company", color: "var(--info)", bg: "var(--info-light)" }
                : { label: "Individual", color: "#7c3aed", bg: "#f5f3ff" },
              meta: [
                ...(c.jurisdiction ? [{ label: "Jurisdiction", value: c.jurisdiction }] : []),
                ...(c.license_expiry_date ? [{ label: "License expires", value: c.license_expiry_date }] : []),
              ],
            })),
          ]))}
          onItemClick={(id) => router.push(`/dashboard/contacts/${id}`)}
          emptyLabel="No contacts"
        />
      )}

      {/* Results count */}
      {!loading && filteredContacts.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
          Showing {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
