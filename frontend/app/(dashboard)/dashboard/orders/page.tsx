"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, TASK_VIEWS } from "@/components/ui/PageViewToggle";
import { SpreadsheetView, type SpreadsheetColumn, type SpreadsheetGroup } from "@/components/ui/SpreadsheetView";
import { KanbanView, type KanbanColumnConfig, type GenericCardData } from "@/components/ui/KanbanView";
import { TimelineView, type TimelineItem } from "@/components/ui/TimelineView";
import { Pill } from "@/components/ui/Pill";
import { exportToCsv } from "@/lib/export";

interface SalesOrder {
  id: string;
  number: string;
  contact_id: string | null;
  contact_name: string | null;
  quotation_id: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

const ORDER_STATUSES = ["pending", "confirmed", "in_progress", "delivered", "cancelled"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "var(--info)", bg: "var(--info-light)" },
  confirmed: { label: "Confirmed", color: "#7c3aed", bg: "#f5f3ff" },
  in_progress: { label: "In Progress", color: "#b45309", bg: "#fffbeb" },
  delivered: { label: "Delivered", color: "var(--success)", bg: "var(--success-light)" },
  cancelled: { label: "Cancelled", color: "var(--danger)", bg: "var(--danger-light)" },
};

const KANBAN_COLUMNS: KanbanColumnConfig[] = ORDER_STATUSES.map((s) => ({
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

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const fromContactQs = fromContactId && fromContactName ? `?from_contact=${encodeURIComponent(fromContactId)}&from_contact_name=${encodeURIComponent(fromContactName)}` : "";
  const [orders, setOrders] = useState<SalesOrder[]>([]);
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
      const data = await api.get("/api/orders");
      setOrders(data as SalesOrder[]);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  }

  const orderFilterConfig: FilterFieldConfig[] = [
    { key: "status", label: "Status", options: [{ value: "pending", label: "Pending" }, { value: "confirmed", label: "Confirmed" }, { value: "in_progress", label: "In Progress" }, { value: "delivered", label: "Delivered" }, { value: "cancelled", label: "Cancelled" }] },
  ];
  const orderGroupOptions = [{ value: "status", label: "Status" }];

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.number.toLowerCase().includes(q) || (o.contact_name && o.contact_name.toLowerCase().includes(q)));
    }
    if (filters.status?.length) list = list.filter((o) => filters.status.includes(o.status));
    return list;
  }, [orders, search, filters]);

  return (
    <div>
      {fromContactId && fromContactName && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/dashboard/contacts" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>Contacts</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <Link href={`/dashboard/contacts/${fromContactId}`} style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 500 }}>{fromContactName}</Link>
          <Icon path="M9 18l6-6-6-6" size={14} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Orders</span>
        </div>
      )}
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Sales Orders</h1>
          <p className="page-subtitle">Convert quotes to orders and track fulfillment</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary btn-sm" onClick={() => exportToCsv("orders", filteredOrders, [
            { key: "order_number", label: "Number" },
            { key: "contact_name", label: "Contact" },
            { key: "status", label: "Status" },
            { key: "total", label: "Total" },
            { key: "created_at", label: "Created" },
          ])}>
            <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
            Export
          </button>
          <button className="btn-primary" onClick={() => { setNewModalOpen(true); setError(""); }}>
            <Icon path="M12 5v14 M5 12h14" size={18} />
            New Order
          </button>
        </div>
      </div>

      {/* Search / Filter / View bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={orderFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={orderGroupOptions} pageKey="orders" placeholder="Search orders..." />
        <PageViewToggle value={viewMode} onChange={setViewMode} views={TASK_VIEWS} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
          <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading orders...</p>
        </div>
      )}

      {/* Spreadsheet View */}
      {!loading && viewMode === "spreadsheet" && (
        <SpreadsheetView<SalesOrder>
          columns={[
            { key: "number", label: "Order Number", render: (o) => <span style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--accent-blue)" }}>{o.number}</span> },
            { key: "contact_name", label: "Contact", render: (o) => <span style={{ color: "var(--text-secondary)" }}>{o.contact_name ?? "—"}</span> },
            { key: "status", label: "Status", render: (o) => { const sc = STATUS_CFG[o.status] || STATUS_CFG.pending; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
            { key: "actions", label: "Actions", align: "right", render: (o) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Link href={`/dashboard/orders/${o.id}${fromContactQs}`} className="btn-ghost btn-sm" style={{ textDecoration: "none" }}>
                  View <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />
                </Link>
              </span>
            ) },
          ]}
          groups={ORDER_STATUSES.map((s) => {
            const sc = STATUS_CFG[s] || STATUS_CFG.pending;
            return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: filteredOrders.filter((o) => o.status === s) };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(o) => router.push(`/dashboard/orders/${o.id}${fromContactQs}`)}
          emptyIcon="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
          emptyLabel="No orders found"
          emptyDescription={search || filters.status?.length ? "Try adjusting your filters" : "Create your first sales order"}
        />
      )}

      {/* Timeline View */}
      {!loading && viewMode === "timeline" && (
        <TimelineView
          items={filteredOrders.map((o) => {
            const sc = STATUS_CFG[o.status] || STATUS_CFG.pending;
            return {
              id: o.id,
              title: `${o.number} — ${o.contact_name || "No contact"}`,
              startDate: o.created_at,
              endDate: o.updated_at,
              color: sc.color,
              bg: sc.bg,
              onClick: () => router.push(`/dashboard/orders/${o.id}${fromContactQs}`),
            };
          })}
          emptyLabel="No orders to display on timeline"
        />
      )}

      {/* Kanban View */}
      {!loading && viewMode === "kanban" && (
        <KanbanView
          columns={KANBAN_COLUMNS}
          itemsByColumn={Object.fromEntries(ORDER_STATUSES.map((s) => [
            s,
            filteredOrders.filter((o) => o.status === s).map((o): GenericCardData => ({
              id: o.id,
              title: o.number,
              subtitle: o.contact_name || "No contact",
            })),
          ]))}
          onItemClick={(id) => router.push(`/dashboard/orders/${id}${fromContactQs}`)}
          emptyLabel="No orders"
        />
      )}

      {/* New Order Modal */}
      <NewOrderModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onSuccess={() => { setNewModalOpen(false); loadData(); }}
        error={error}
        setError={setError}
      />

      {/* Results count */}
      {!loading && filteredOrders.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
          Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// --- New Order Modal ---
interface LineItem { description: string; quantity: string; unit_price: string; product_id?: string }

function NewOrderModal({ open, onClose, onSuccess, error, setError }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  error: string; setError: (s: string) => void;
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [quotations, setQuotations] = useState<{ id: string; number: string; contact_id: string | null; contact_name: string | null }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; default_unit_price: number | null }[]>([]);
  const [contactId, setContactId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([
        api.get("/api/contacts/").catch(() => []),
        api.get("/api/quotations?status=accepted").catch(() => []),
        api.get("/api/products").catch(() => []),
      ]).then(([cData, qData, pData]) => {
        setContacts(Array.isArray(cData) ? (cData as { id: string; name: string }[]) : []);
        setQuotations(Array.isArray(qData) ? (qData as { id: string; number: string; contact_id: string | null; contact_name: string | null }[]) : []);
        setProducts(Array.isArray(pData) ? (pData as { id: string; name: string; default_unit_price: number | null }[]) : []);
      });
    }
  }, [open]);

  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: "1", unit_price: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  function onProductSelect(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateLine(i, "product_id", productId);
    updateLine(i, "description", p.name);
    updateLine(i, "unit_price", p.default_unit_price != null ? String(p.default_unit_price) : "");
  }

  function onQuotationSelect(qId: string) {
    setQuotationId(qId);
    const q = quotations.find((x) => x.id === qId);
    if (q?.contact_id) setContactId(q.contact_id);
    if (qId) setLines([{ description: "(from quotation)", quantity: "1", unit_price: "0" }]);
    else setLines([{ description: "", quantity: "1", unit_price: "" }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!contactId) {
      setError("Select a contact");
      return;
    }
    if (quotationId) {
      setLoading(true);
      try {
        await api.post("/api/orders/", {
          contact_id: contactId,
          quotation_id: quotationId,
        });
        setContactId(""); setQuotationId(""); setLines([{ description: "", quantity: "1", unit_price: "" }]);
        onSuccess();
      } catch (err: unknown) {
        setError((err as { message?: string })?.message || "Failed to create order");
      } finally {
        setLoading(false);
      }
      return;
    }
    const validLines = lines.filter((l) => l.description.trim() && l.quantity && l.unit_price);
    if (validLines.length === 0) {
      setError("Add at least one line item, or select a quotation");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/orders/", {
        contact_id: contactId,
        lines: validLines.map((l) => ({
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          product_id: l.product_id || undefined,
        })),
      });
      setContactId(""); setQuotationId(""); setLines([{ description: "", quantity: "1", unit_price: "" }]);
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  const fromQuotation = !!quotationId;

  return (
    <Modal open={open} onClose={onClose} title="New Order">
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
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>From accepted quotation (optional)</label>
            <select value={quotationId} onChange={(e) => onQuotationSelect(e.target.value)}>
              <option value="">— Create manually</option>
              {quotations
                .filter((q) => q.contact_id && (!contactId || q.contact_id === contactId))
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.number} — {q.contact_name || "—"}
                  </option>
                ))}
            </select>
          </div>

          {!fromQuotation && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Line items</label>
                <button type="button" className="btn-secondary btn-sm" onClick={addLine}>+ Add line</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {lines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr 80px 100px auto",
                      gap: 8,
                      alignItems: "end",
                    }}
                  >
                    <select
                      value={line.product_id || ""}
                      onChange={(e) => { const v = e.target.value; if (v) onProductSelect(i, v); }}
                      style={{ minWidth: 0 }}
                    >
                      <option value="">Product (optional)</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit price AED"
                      value={line.unit_price}
                      onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                    />
                    <button type="button" className="btn-ghost btn-sm" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                      <Icon path="M18 6L6 18 M6 6l12 12" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create order"}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
