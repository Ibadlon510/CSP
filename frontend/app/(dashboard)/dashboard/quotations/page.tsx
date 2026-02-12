"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber } from "@/lib/format";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { SpreadsheetView } from "@/components/ui/SpreadsheetView";
import { KanbanView, type KanbanColumnConfig, type GenericCardData } from "@/components/ui/KanbanView";
import { TimelineView } from "@/components/ui/TimelineView";
import { Pill } from "@/components/ui/Pill";

interface Quotation {
  id: string;
  number: string;
  contact_id: string | null;
  contact_name: string | null;
  lead_id: string | null;
  status: string;
  total: number;
  vat_amount: number;
  valid_until: string | null;
  created_at?: string;
}

const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
  sent: { label: "Sent", color: "var(--info)", bg: "var(--info-light)" },
  accepted: { label: "Accepted", color: "var(--success)", bg: "var(--success-light)" },
  rejected: { label: "Rejected", color: "var(--danger)", bg: "var(--danger-light)" },
  expired: { label: "Expired", color: "#b45309", bg: "#fffbeb" },
};

const KANBAN_COLUMNS: KanbanColumnConfig[] = QUOTE_STATUSES.map((s) => ({
  id: s,
  label: STATUS_CFG[s]?.label || s,
  color: STATUS_CFG[s]?.color || "var(--text-secondary)",
  bg: STATUS_CFG[s]?.bg || "var(--bg-tertiary)",
}));

function SlidePanel({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          zIndex: "var(--z-modal-backdrop)" as any,
          animation: "slidePanelOverlayIn 0.2s ease-out forwards",
        }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 560,
        maxWidth: "100vw",
        background: "var(--bg-secondary)",
        boxShadow: "-8px 0 30px rgba(0,0,0,0.08), -2px 0 8px rgba(0,0,0,0.04)",
        zIndex: "var(--z-modal)" as any,
        display: "flex", flexDirection: "column",
        animation: "slidePanelIn 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 28px 16px",
          borderBottom: "1px solid var(--border-primary)",
          position: "sticky", top: 0,
          background: "var(--bg-secondary)",
          zIndex: 2,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.3 }}>{title}</h3>
              {subtitle && <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3, fontWeight: 400 }}>{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--bg-tertiary)", border: "none",
                borderRadius: "var(--radius-md)", padding: 7, cursor: "pointer",
                color: "var(--text-tertiary)",
                transition: "all var(--transition-fast)",
                flexShrink: 0, marginTop: -2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
            >
              <Icon path="M18 6L6 18M6 6l12 12" size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: "16px 28px 20px",
            borderTop: "1px solid var(--border-primary)",
            background: "var(--bg-secondary)",
            position: "sticky", bottom: 0,
            zIndex: 2,
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slidePanelIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slidePanelOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

export default function QuotationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ status: [] });
  const [groupBy, setGroupBy] = useState("");
  const [viewMode, setViewMode] = useState("spreadsheet");
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [error, setError] = useState("");

  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const fromContactQs = fromContactId && fromContactName ? `?from_contact=${encodeURIComponent(fromContactId)}&from_contact_name=${encodeURIComponent(fromContactName)}` : "";

  // Pre-fill from opportunity link
  const prefill = {
    opportunityId: searchParams.get("opportunity_id") || "",
    contactId: searchParams.get("contact_id") || "",
    leadId: searchParams.get("lead_id") || "",
    amount: searchParams.get("amount") || "",
    opportunityName: searchParams.get("opportunity_name") || "",
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (prefill.opportunityId) {
      setNewModalOpen(true);
    }
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.get("/api/quotations");
      setQuotations(data as Quotation[]);
    } catch (err) {
      console.error("Failed to load quotations", err);
    } finally {
      setLoading(false);
    }
  }

  const quotationFilterConfig: FilterFieldConfig[] = [
    { key: "status", label: "Status", options: [{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "accepted", label: "Accepted" }, { value: "rejected", label: "Rejected" }, { value: "expired", label: "Expired" }] },
  ];
  const quotationGroupOptions = [{ value: "status", label: "Status" }];

  const filteredQuotations = useMemo(() => {
    let list = quotations;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((qt) => qt.number.toLowerCase().includes(q) || (qt.contact_name && qt.contact_name.toLowerCase().includes(q)));
    }
    if (filters.status?.length) list = list.filter((qt) => filters.status.includes(qt.status));
    return list;
  }, [quotations, search, filters]);

  return (
    <div>
      {fromContactId && fromContactName && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/dashboard/contacts" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>Contacts</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <Link href={`/dashboard/contacts/${fromContactId}`} style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>{fromContactName}</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Quotations</span>
        </div>
      )}
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Quotations</h1>
          <p className="page-subtitle">Create and manage sales quotes</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary btn-sm">
            <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
            Export
          </button>
          <button className="btn-primary" onClick={() => { setNewModalOpen(true); setError(""); }}>
            <Icon path="M12 5v14 M5 12h14" size={18} />
            New Quotation
          </button>
        </div>
      </div>

      {/* Search / Filter / View bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={quotationFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={quotationGroupOptions} pageKey="quotations" placeholder="Search quotations..." />
        <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
          <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading quotations...</p>
        </div>
      )}

      {/* Spreadsheet View */}
      {!loading && viewMode === "spreadsheet" && (
        <SpreadsheetView<Quotation>
          columns={[
            { key: "number", label: "Number", render: (q) => <span style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--accent-blue)" }}>{q.number}</span> },
            { key: "contact_name", label: "Contact", render: (q) => <span style={{ color: "var(--text-secondary)" }}>{q.contact_name ?? "\u2014"}</span> },
            { key: "status", label: "Status", render: (q) => { const sc = STATUS_CFG[q.status] || STATUS_CFG.draft; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
            { key: "total", label: "Total", render: (q) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmtNumber(q.total)} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>AED</span></span> },
            { key: "vat_amount", label: "VAT", render: (q) => <span style={{ color: "var(--text-tertiary)" }}>{fmtNumber(q.vat_amount)} AED</span> },
            { key: "valid_until", label: "Valid Until", render: (q) => <span style={{ color: "var(--text-tertiary)" }}>{q.valid_until || "\u2014"}</span> },
            { key: "actions", label: "Actions", align: "right", render: (q) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Link href={`/dashboard/quotations/${q.id}${fromContactQs}`} className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
                  View <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />
                </Link>
              </span>
            ) },
          ]}
          groups={QUOTE_STATUSES.map((s) => {
            const sc = STATUS_CFG[s] || STATUS_CFG.draft;
            return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: filteredQuotations.filter((q) => q.status === s) };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(q) => router.push(`/dashboard/quotations/${q.id}${fromContactQs}`)}
          emptyIcon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8"
          emptyLabel="No quotations found"
          emptyDescription={search || filters.status?.length ? "Try adjusting your filters" : "Create your first quotation"}
        />
      )}

      {/* Timeline View */}
      {!loading && viewMode === "timeline" && (
        <TimelineView
          items={filteredQuotations.map((q) => {
            const sc = STATUS_CFG[q.status] || STATUS_CFG.draft;
            return {
              id: q.id,
              title: `${q.number} \u2014 ${fmtNumber(q.total)} AED`,
              startDate: q.created_at,
              endDate: q.valid_until || undefined,
              color: sc.color,
              bg: sc.bg,
              onClick: () => router.push(`/dashboard/quotations/${q.id}${fromContactQs}`),
            };
          })}
          emptyLabel="No quotations to display on timeline"
        />
      )}

      {/* Kanban View */}
      {!loading && viewMode === "kanban" && (
        <KanbanView
          columns={KANBAN_COLUMNS}
          itemsByColumn={Object.fromEntries(QUOTE_STATUSES.map((s) => [
            s,
            filteredQuotations.filter((q) => q.status === s).map((q): GenericCardData => ({
              id: q.id,
              title: q.number,
              subtitle: q.contact_name || "No contact",
              meta: [
                { label: "Total", value: `${fmtNumber(q.total)} AED` },
                ...(q.valid_until ? [{ label: "Valid until", value: q.valid_until }] : []),
              ],
            })),
          ]))}
          onItemClick={(id) => router.push(`/dashboard/quotations/${id}${fromContactQs}`)}
          emptyLabel="No quotations"
        />
      )}

      {/* New Quotation Modal */}
      <NewQuotationModal
        open={newModalOpen}
        onClose={() => { setNewModalOpen(false); if (prefill.opportunityId) router.replace("/dashboard/quotations", { scroll: false }); }}
        onSuccess={() => { setNewModalOpen(false); if (prefill.opportunityId) router.replace("/dashboard/quotations", { scroll: false }); loadData(); }}
        error={error}
        setError={setError}
        prefill={prefill}
      />

      {/* Results count */}
      {!loading && filteredQuotations.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
          Showing {filteredQuotations.length} quotation{filteredQuotations.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// --- New Quotation Modal ---
interface LineItem { product_id: string; product_name: string; description: string; quantity: string; unit_price: string; vat_rate: string }
interface ProductOption { id: string; name: string; default_unit_price: number; description: string | null }

interface Prefill {
  opportunityId: string;
  contactId: string;
  leadId: string;
  amount: string;
  opportunityName: string;
}

function NewQuotationModal({ open, onClose, onSuccess, error, setError, prefill }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  error: string; setError: (s: string) => void;
  prefill?: Prefill;
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [opportunities, setOpportunities] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [contactId, setContactId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<LineItem[]>([
    { product_id: "", product_name: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" },
  ]);
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [editingProductIdx, setEditingProductIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      Promise.all([
        api.get("/api/contacts/").catch(() => []),
        api.get("/api/crm/leads").catch(() => []),
        api.get("/api/crm/opportunities").catch(() => []),
        api.get("/api/products/?is_active=true").catch(() => []),
      ]).then(([cData, lData, oData, pData]) => {
        setContacts(Array.isArray(cData) ? (cData as { id: string; name: string }[]) : []);
        setLeads(Array.isArray(lData) ? (lData as { id: string; name: string }[]) : []);
        setOpportunities(Array.isArray(oData) ? (oData as { id: string; name: string }[]) : []);
        setProducts(Array.isArray(pData) ? (pData as ProductOption[]) : []);
        // Apply prefill from opportunity after data is loaded
        if (prefill && prefill.opportunityId && !prefilled) {
          setOpportunityId(prefill.opportunityId);
          if (prefill.contactId) setContactId(prefill.contactId);
          if (prefill.leadId) setLeadId(prefill.leadId);
          if (prefill.amount) {
            setLines([{ product_id: "", product_name: "", description: prefill.opportunityName || "Service", quantity: "1", unit_price: prefill.amount, vat_rate: "5" }]);
          }
          setPrefilled(true);
        }
      });
    }
  }, [open]);

  function addLine() {
    setShowProductPicker(true);
    setEditingProductIdx(null);
    setProductSearch("");
  }

  function addLineWithProduct(prod: ProductOption | null) {
    if (prod) {
      setLines((prev) => [...prev, {
        product_id: prod.id, product_name: prod.name,
        description: prod.description || prod.name,
        quantity: "1", unit_price: String(prod.default_unit_price ?? ""), vat_rate: "5",
      }]);
    } else {
      setLines((prev) => [...prev, { product_id: "", product_name: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" }]);
    }
    setShowProductPicker(false);
    setProductSearch("");
  }

  function changeProduct(i: number, prod: ProductOption | null) {
    setLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l;
      if (!prod) return { ...l, product_id: "", product_name: "" };
      return {
        ...l, product_id: prod.id, product_name: prod.name,
        description: prod.description || prod.name,
        unit_price: String(prod.default_unit_price ?? l.unit_price),
      };
    }));
    setEditingProductIdx(null);
    setShowProductPicker(false);
    setProductSearch("");
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validLines = lines.filter((l) => l.description.trim() && l.quantity && l.unit_price);
    if (validLines.length === 0) {
      setError("Add at least one line item");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/quotations/", {
        contact_id: contactId || null,
        lead_id: leadId || null,
        opportunity_id: opportunityId || null,
        valid_until: validUntil || null,
        lines: validLines.map((l) => ({
          product_id: l.product_id || null,
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          vat_rate: parseFloat(l.vat_rate) || 0,
        })),
      });
      setContactId(""); setLeadId(""); setOpportunityId(""); setValidUntil("");
      setLines([{ product_id: "", product_name: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" }]);
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to create quotation");
    } finally {
      setLoading(false);
    }
  }

  // Compute running total
  const computedLines = lines.map((l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unit_price) || 0;
    const subtotal = qty * price;
    const vat = subtotal * ((parseFloat(l.vat_rate) || 0) / 100);
    return { subtotal, vat };
  });
  const totalSubtotal = computedLines.reduce((s, l) => s + l.subtotal, 0);
  const totalVat = computedLines.reduce((s, l) => s + l.vat, 0);
  const grandTotal = totalSubtotal + totalVat;

  if (!open) return null;

  const filteredProducts = products.filter((p) => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <SlidePanel open={open} onClose={onClose} title="New Quotation" subtitle="Create a sales quote with line items"
      footer={<>
        {/* Summary row */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0,
          background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-primary)", overflow: "hidden",
        }}>
          <div style={{ padding: "10px 14px", borderRight: "1px solid var(--border-primary)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Subtotal</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              {fmtNumber(totalSubtotal)}
            </div>
          </div>
          <div style={{ padding: "10px 14px", borderRight: "1px solid var(--border-primary)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>VAT</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              {fmtNumber(totalVat)}
            </div>
          </div>
          <div style={{ padding: "10px 14px", background: "var(--brand-primary)", borderRadius: "0" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Total (AED)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
              {fmtNumber(grandTotal)}
            </div>
          </div>
        </div>
        {/* CTA */}
        <button
          type="submit" form="new-quotation-form" disabled={loading}
          style={{
            width: "100%", padding: "13px 28px", fontSize: 14, fontWeight: 600,
            borderRadius: "var(--radius-lg)",
            background: loading ? "var(--bg-tertiary)" : "var(--brand-primary)",
            color: loading ? "var(--text-tertiary)" : "#fff",
            border: "none", cursor: loading ? "not-allowed" : "pointer",
            transition: "all var(--transition-fast)",
            letterSpacing: "-0.01em",
          }}
        >
          {loading ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Creating...
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon path="M12 5v14 M5 12h14" size={16} />
              Create Quotation
            </span>
          )}
        </button>
      </>}
    >
      <form id="new-quotation-form" onSubmit={handleSubmit}>
        {/* Deal Info — static when prefilled, editable otherwise */}
        {prefill?.opportunityId ? (
          <div style={{ marginBottom: 28 }}>
            <div style={{
              background: "linear-gradient(135deg, var(--accent-blue-light), var(--accent-purple-light))",
              borderRadius: "var(--radius-lg)", padding: "20px",
              border: "1px solid rgba(99,102,241,0.12)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: -20, right: -20, width: 80, height: 80,
                borderRadius: "50%", background: "rgba(99,102,241,0.06)",
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, position: "relative" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0,
                  background: "linear-gradient(135deg, var(--accent-blue), #6366f1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
                }}>
                  <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{prefill.opportunityName || "Opportunity"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Linked opportunity</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
                {(() => {
                  const contactName = contacts.find((c) => c.id === contactId)?.name;
                  return contactName ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "var(--text-tertiary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" size={13} />
                        Contact
                      </span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{contactName}</span>
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const leadName = leads.find((l) => l.id === leadId)?.name;
                  return leadName ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "var(--text-tertiary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon path="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" size={13} />
                        Lead
                      </span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{leadName}</span>
                    </div>
                  ) : null;
                })()}
                {prefill.amount && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <span style={{ color: "var(--text-tertiary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon path="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" size={13} />
                      Deal Value
                    </span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 14 }}>{fmtNumber(prefill.amount)} AED</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                style={{ margin: 0, fontSize: 13, padding: "10px 14px" }} />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                background: "var(--accent-blue-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-blue)",
              }}>
                <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" size={14} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Deal Information</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Contact</label>
                <select value={contactId} onChange={(e) => { setContactId(e.target.value); setLeadId(""); setOpportunityId(""); }}
                  style={{ margin: 0, fontSize: 13, padding: "10px 14px" }}>
                  <option value="">Select contact...</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Lead</label>
                  <select value={leadId} onChange={(e) => { setLeadId(e.target.value); setContactId(""); setOpportunityId(""); }}
                    style={{ margin: 0, fontSize: 13, padding: "10px 14px" }}>
                    <option value="">None</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Opportunity</label>
                  <select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}
                    style={{ margin: 0, fontSize: 13, padding: "10px 14px" }}>
                    <option value="">None</option>
                    {opportunities.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Valid Until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                  style={{ margin: 0, fontSize: 13, padding: "10px 14px" }} />
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border-primary)", marginBottom: 28 }} />

        {/* Section: Line Items */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                background: "var(--accent-purple-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-purple)",
              }}>
                <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" size={14} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Line Items</div>
                <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 1 }}>{lines.length} item{lines.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <button type="button" onClick={addLine} style={{
              display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
              color: "var(--accent-blue)", background: "var(--accent-blue-light)", border: "none",
              cursor: "pointer", padding: "6px 12px", borderRadius: "var(--radius-full)",
              transition: "all var(--transition-fast)",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-blue)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent-blue-light)"; e.currentTarget.style.color = "var(--accent-blue)"; }}
            >
              <Icon path="M12 5v14 M5 12h14" size={13} /> Add Item
            </button>
          </div>

          {/* Product Picker Dropdown */}
          {showProductPicker && (
            <div style={{
              marginBottom: 14,
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-secondary)",
              overflow: "hidden",
              boxShadow: "var(--shadow-md)",
              animation: "slidePanelOverlayIn 0.15s ease-out forwards",
            }}>
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-primary)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--bg-tertiary)",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{editingProductIdx !== null ? "Change Product" : "Select Product"}</span>
                <button type="button" onClick={() => { setShowProductPicker(false); setEditingProductIdx(null); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-quaternary)", padding: 4, borderRadius: "var(--radius-sm)",
                    transition: "all var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-quaternary)"; }}
                >
                  <Icon path="M18 6L6 18 M6 6l12 12" size={14} />
                </button>
              </div>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-primary)" }}>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-quaternary)" }}>
                    <Icon path="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" size={14} />
                  </div>
                  <input
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    autoFocus
                    style={{
                      margin: 0, fontSize: 13, padding: "9px 12px 9px 32px",
                      background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)",
                      borderRadius: "var(--radius-md)",
                    }}
                  />
                </div>
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {editingProductIdx === null && (
                  <button type="button" onClick={() => addLineWithProduct(null)} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                    padding: "10px 16px", fontSize: 13, fontWeight: 500,
                    color: "var(--text-tertiary)", background: "none", border: "none",
                    borderBottom: "1px solid var(--border-secondary)",
                    cursor: "pointer", transition: "background var(--transition-fast)",
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                      background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1px dashed var(--border-hover)",
                    }}>
                      <Icon path="M12 5v14 M5 12h14" size={12} />
                    </span>
                    Custom item (no product)
                  </button>
                )}
                {filteredProducts.map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => editingProductIdx !== null ? changeProduct(editingProductIdx, p) : addLineWithProduct(p)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left",
                      padding: "10px 16px", fontSize: 13, background: "none", border: "none",
                      borderBottom: "1px solid var(--border-secondary)", cursor: "pointer",
                      transition: "background var(--transition-fast)",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                        background: "var(--accent-blue-light)", display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--accent-blue)",
                      }}>
                        <Icon path="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" size={12} />
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span>
                    </div>
                    {p.default_unit_price != null && (
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {fmtNumber(p.default_unit_price)} AED
                      </span>
                    )}
                  </button>
                ))}
                {filteredProducts.length === 0 && productSearch.trim() && (
                  <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text-quaternary)", fontSize: 13 }}>
                    No products match &ldquo;{productSearch}&rdquo;
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Line item rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lines.map((line, i) => {
              const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
              return (
                <div key={i} style={{
                  border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)",
                  overflow: "hidden", background: "var(--bg-secondary)",
                  transition: "all var(--transition-fast)",
                }}>
                  {/* Header: product name + actions */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", background: "var(--bg-tertiary)",
                    borderBottom: "1px solid var(--border-primary)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: "var(--radius-sm)", flexShrink: 0,
                        background: "var(--brand-primary)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, letterSpacing: "-0.02em",
                      }}>{i + 1}</span>
                      {line.product_name ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{line.product_name}</span>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-quaternary)" }}>Custom item</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button type="button" onClick={() => { setEditingProductIdx(i); setShowProductPicker(true); setProductSearch(""); }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--accent-blue)", fontSize: 12, fontWeight: 600,
                          padding: "4px 8px", borderRadius: "var(--radius-sm)",
                          transition: "all var(--transition-fast)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-blue-light)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      >
                        {line.product_name ? "Change" : "Set product"}
                      </button>
                      <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1}
                        style={{
                          background: "none", border: "none",
                          cursor: lines.length === 1 ? "default" : "pointer",
                          color: lines.length === 1 ? "var(--border-primary)" : "var(--text-quaternary)",
                          padding: 4, borderRadius: "var(--radius-sm)",
                          transition: "all var(--transition-fast)",
                        }}
                        onMouseEnter={(e) => { if (lines.length > 1) { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = lines.length === 1 ? "var(--border-primary)" : "var(--text-quaternary)"; }}
                      >
                        <Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-secondary)" }}>
                    <input placeholder="Description *" value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)}
                      style={{ margin: 0, fontSize: 13, padding: "8px 12px" }} />
                  </div>

                  {/* Qty / Price / VAT / Total row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.7fr auto", gap: 0 }}>
                    <div style={{ padding: "10px 14px", borderRight: "1px solid var(--border-secondary)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Qty</div>
                      <input type="number" min="0" step="0.01" placeholder="1" value={line.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)}
                        style={{ margin: 0, fontSize: 13, padding: "6px 8px", textAlign: "center", width: "100%" }} />
                    </div>
                    <div style={{ padding: "10px 14px", borderRight: "1px solid var(--border-secondary)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Price (AED)</div>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={line.unit_price} onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                        style={{ margin: 0, fontSize: 13, padding: "6px 8px", width: "100%" }} />
                    </div>
                    <div style={{ padding: "10px 12px", borderRight: "1px solid var(--border-secondary)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>VAT</div>
                      <select value={line.vat_rate} onChange={(e) => updateLine(i, "vat_rate", e.target.value)}
                        style={{ margin: 0, fontSize: 12, padding: "6px 4px", width: "100%" }}>
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                      </select>
                    </div>
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", justifyContent: "flex-end", minWidth: 90 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Total</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: lineTotal > 0 ? "var(--text-primary)" : "var(--text-quaternary)", fontVariantNumeric: "tabular-nums" }}>
                        {lineTotal > 0 ? fmtNumber(lineTotal) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{
            margin: "16px 0 0", padding: "10px 14px",
            background: "var(--danger-light)", border: "1px solid var(--danger-border)",
            borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 13, fontWeight: 500, color: "var(--danger)",
          }}>
            <Icon path="M12 9v2m0 4h.01 M10.29 3.86l-8.58 14.86A2 2 0 0 0 3.46 21h17.08a2 2 0 0 0 1.75-2.98L13.71 3.86a2 2 0 0 0-3.42 0z" size={16} />
            {error}
          </div>
        )}
      </form>
    </SlidePanel>
  );
}
