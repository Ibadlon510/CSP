"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber, fmtDate } from "@/lib/format";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { SpreadsheetView } from "@/components/ui/SpreadsheetView";
import { KanbanView, type KanbanColumnConfig, type GenericCardData } from "@/components/ui/KanbanView";
import { TimelineView } from "@/components/ui/TimelineView";
import { Pill } from "@/components/ui/Pill";

interface Invoice {
  id: string;
  number: string;
  contact_id: string | null;
  contact_name: string | null;
  sales_order_id: string | null;
  status: string;
  total: number;
  vat_amount: number;
  due_date: string | null;
  paid_at: string | null;
  created_at?: string;
}

const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
  sent: { label: "Sent", color: "var(--info)", bg: "var(--info-light)" },
  paid: { label: "Paid", color: "var(--success)", bg: "var(--success-light)" },
  overdue: { label: "Overdue", color: "var(--danger)", bg: "var(--danger-light)" },
  cancelled: { label: "Cancelled", color: "var(--danger)", bg: "var(--danger-light)" },
};

const KANBAN_COLUMNS: KanbanColumnConfig[] = INVOICE_STATUSES.map((s) => ({
  id: s,
  label: STATUS_CFG[s]?.label || s,
  color: STATUS_CFG[s]?.color || "var(--text-secondary)",
  bg: STATUS_CFG[s]?.bg || "var(--bg-tertiary)",
}));

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card"
        style={{ maxWidth: 640, width: "95%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <Icon path="M18 6L6 18 M6 6l12 12" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const fromContactQs = fromContactId && fromContactName ? `?from_contact=${encodeURIComponent(fromContactId)}&from_contact_name=${encodeURIComponent(fromContactName)}` : "";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ status: [] });
  const [groupBy, setGroupBy] = useState("");
  const [viewMode, setViewMode] = useState("spreadsheet");
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.get("/api/invoices");
      setInvoices(data as Invoice[]);
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      setLoading(false);
    }
  }

  const invoiceFilterConfig: FilterFieldConfig[] = [
    { key: "status", label: "Status", options: [{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "paid", label: "Paid" }, { value: "overdue", label: "Overdue" }, { value: "cancelled", label: "Cancelled" }] },
  ];
  const invoiceGroupOptions = [{ value: "status", label: "Status" }];

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((inv) => inv.number.toLowerCase().includes(q) || (inv.contact_name && inv.contact_name.toLowerCase().includes(q)));
    }
    if (filters.status?.length) list = list.filter((inv) => filters.status.includes(inv.status));
    return list;
  }, [invoices, search, filters]);

  return (
    <div>
      {fromContactId && fromContactName && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/dashboard/contacts" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>Contacts</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <Link href={`/dashboard/contacts/${fromContactId}`} style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>{fromContactName}</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Invoices</span>
        </div>
      )}
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Invoices and payments linked to wallet</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary btn-sm">
            <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
            Export
          </button>
          <button className="btn-primary" onClick={() => { setNewModalOpen(true); setError(""); }}>
            <Icon path="M12 5v14 M5 12h14" size={18} />
            New Invoice
          </button>
        </div>
      </div>

      {/* Search / Filter / View bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={invoiceFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={invoiceGroupOptions} pageKey="invoices" placeholder="Search invoices..." />
        <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
          <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading invoices...</p>
        </div>
      )}

      {/* Spreadsheet View */}
      {!loading && viewMode === "spreadsheet" && (
        <SpreadsheetView<Invoice>
          columns={[
            { key: "number", label: "Invoice Number", render: (i) => <span style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--accent-blue)" }}>{i.number}</span> },
            { key: "contact_name", label: "Contact", render: (i) => <span style={{ color: "var(--text-secondary)" }}>{i.contact_name ?? "\u2014"}</span> },
            { key: "status", label: "Status", render: (i) => { const sc = STATUS_CFG[i.status] || STATUS_CFG.draft; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
            { key: "total", label: "Total", render: (i) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmtNumber(i.total)} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>AED</span></span> },
            { key: "vat_amount", label: "VAT", render: (i) => <span style={{ color: "var(--text-tertiary)" }}>{fmtNumber(i.vat_amount)} AED</span> },
            { key: "due_date", label: "Due Date", render: (i) => i.due_date ? <span style={{ color: "var(--text-tertiary)" }}>{fmtDate(i.due_date)}</span> : <span>\u2014</span> },
            { key: "paid_at", label: "Paid At", render: (i) => i.paid_at ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={14} />
                <span style={{ color: "var(--success)" }}>{fmtDate(i.paid_at)}</span>
              </div>
            ) : <span style={{ color: "var(--text-quaternary)" }}>\u2014</span> },
            { key: "actions", label: "Actions", align: "right", render: (i) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Link href={`/dashboard/invoices/${i.id}${fromContactQs}`} className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
                  View <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />
                </Link>
              </span>
            ) },
          ]}
          groups={INVOICE_STATUSES.map((s) => {
            const sc = STATUS_CFG[s] || STATUS_CFG.draft;
            return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: filteredInvoices.filter((inv) => inv.status === s) };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(i) => router.push(`/dashboard/invoices/${i.id}${fromContactQs}`)}
          emptyIcon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6"
          emptyLabel="No invoices found"
          emptyDescription={search || filters.status?.length ? "Try adjusting your filters" : "Create your first invoice"}
        />
      )}

      {/* Timeline View */}
      {!loading && viewMode === "timeline" && (
        <TimelineView
          items={filteredInvoices.map((inv) => {
            const sc = STATUS_CFG[inv.status] || STATUS_CFG.draft;
            return {
              id: inv.id,
              title: `${inv.number} \u2014 ${fmtNumber(inv.total)} AED`,
              startDate: inv.created_at,
              endDate: inv.due_date || undefined,
              color: sc.color,
              bg: sc.bg,
              onClick: () => router.push(`/dashboard/invoices/${inv.id}${fromContactQs}`),
            };
          })}
          emptyLabel="No invoices to display on timeline"
        />
      )}

      {/* Kanban View */}
      {!loading && viewMode === "kanban" && (
        <KanbanView
          columns={KANBAN_COLUMNS}
          itemsByColumn={Object.fromEntries(INVOICE_STATUSES.map((s) => [
            s,
            filteredInvoices.filter((inv) => inv.status === s).map((inv): GenericCardData => ({
              id: inv.id,
              title: inv.number,
              subtitle: inv.contact_name || "No contact",
              meta: [
                { label: "Total", value: `${fmtNumber(inv.total)} AED` },
                ...(inv.due_date ? [{ label: "Due", value: fmtDate(inv.due_date) }] : []),
              ],
            })),
          ]))}
          onItemClick={(id) => router.push(`/dashboard/invoices/${id}${fromContactQs}`)}
          emptyLabel="No invoices"
        />
      )}

      {/* New Invoice Modal */}
      <NewInvoiceModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onSuccess={() => { setNewModalOpen(false); loadData(); }}
        error={error}
        setError={setError}
      />

      {/* Results count */}
      {!loading && filteredInvoices.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
          Showing {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// --- New Invoice Modal ---
interface ProductOption { id: string; name: string; default_unit_price: number | null; description: string | null }
interface LineItem { product_id: string; description: string; quantity: string; unit_price: string; vat_rate: string }

function NewInvoiceModal({ open, onClose, onSuccess, error, setError }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  error: string; setError: (s: string) => void;
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [orders, setOrders] = useState<{ id: string; number: string; contact_id: string | null; contact_name: string | null }[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [opportunities, setOpportunities] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [contactId, setContactId] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ product_id: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([
        api.get("/api/contacts/").catch(() => []),
        api.get("/api/orders").catch(() => []),
        api.get("/api/crm/leads").catch(() => []),
        api.get("/api/crm/opportunities").catch(() => []),
        api.get("/api/products/").catch(() => []),
      ]).then(([cData, oData, lData, oppData, pData]) => {
        setContacts(Array.isArray(cData) ? (cData as { id: string; name: string }[]) : []);
        setOrders(Array.isArray(oData) ? (oData as { id: string; number: string; contact_id: string | null; contact_name: string | null }[]) : []);
        setLeads(Array.isArray(lData) ? (lData as { id: string; name: string }[]) : []);
        setOpportunities(Array.isArray(oppData) ? (oppData as { id: string; name: string }[]) : []);
        setProducts(Array.isArray(pData) ? (pData as ProductOption[]) : []);
      });
    }
  }, [open]);

  function addLine() {
    setLines((prev) => [...prev, { product_id: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" }]);
  }

  function selectProduct(i: number, productId: string) {
    const prod = products.find((p) => p.id === productId);
    setLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l;
      if (!prod) return { ...l, product_id: "" };
      return {
        ...l,
        product_id: prod.id,
        description: prod.description || prod.name,
        unit_price: prod.default_unit_price != null ? String(prod.default_unit_price) : l.unit_price,
      };
    }));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  function onOrderSelect(oId: string) {
    setSalesOrderId(oId);
    const o = orders.find((x) => x.id === oId);
    if (o?.contact_id) setContactId(o.contact_id);
    if (oId) setLines([{ product_id: "", description: "(from order)", quantity: "1", unit_price: "0", vat_rate: "5" }]);
    else setLines([{ product_id: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!contactId) {
      setError("Select a contact");
      return;
    }
    if (salesOrderId) {
      setLoading(true);
      try {
        await api.post("/api/invoices/", {
          contact_id: contactId,
          sales_order_id: salesOrderId,
          due_date: dueDate || null,
        });
        setContactId(""); setSalesOrderId(""); setDueDate(""); setLines([{ product_id: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" }]);
        onSuccess();
      } catch (err: unknown) {
        setError((err as { message?: string })?.message || "Failed to create invoice");
      } finally {
        setLoading(false);
      }
      return;
    }
    const validLines = lines.filter((l) => l.description.trim() && l.quantity && l.unit_price);
    if (validLines.length === 0) {
      setError("Add at least one line item, or select a sales order");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/invoices/", {
        contact_id: contactId,
        lead_id: leadId || null,
        opportunity_id: opportunityId || null,
        due_date: dueDate || null,
        lines: validLines.map((l) => ({
          product_id: l.product_id || null,
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          vat_rate: parseFloat(l.vat_rate) || 0,
        })),
      });
      setContactId(""); setSalesOrderId(""); setLeadId(""); setOpportunityId(""); setDueDate(""); setLines([{ product_id: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" }]);
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  const fromOrder = !!salesOrderId;

  return (
    <Modal open={open} onClose={onClose} title="New Invoice">
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Contact *</label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} required>
              <option value="">—</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>From sales order (optional)</label>
            <select value={salesOrderId} onChange={(e) => onOrderSelect(e.target.value)}>
              <option value="">— Create manually</option>
              {orders
                .filter((o) => o.contact_id && (!contactId || o.contact_id === contactId))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.number} — {o.contact_name || "—"}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          {!fromOrder && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Lead (optional)</label>
                <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                  <option value="">—</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Opportunity (optional)</label>
                <select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
                  <option value="">—</option>
                  {opportunities.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {!fromOrder && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Line items</label>
                <button type="button" className="btn-secondary btn-sm" onClick={addLine}>+ Add line</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {lines.map((line, i) => (
                  <div key={i} style={{ padding: 12, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", marginBottom: 4 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <select
                        value={line.product_id}
                        onChange={(e) => selectProduct(i, e.target.value)}
                        style={{ fontSize: 13 }}
                      >
                        <option value="">— Select product (optional)</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                        <Icon path="M18 6L6 18 M6 6l12 12" size={16} />
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px 70px", gap: 8, alignItems: "end" }}>
                      <input
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => updateLine(i, "description", e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => updateLine(i, "quantity", e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price AED"
                        value={line.unit_price}
                        onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="VAT %"
                        value={line.vat_rate}
                        onChange={(e) => updateLine(i, "vat_rate", e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create invoice"}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
