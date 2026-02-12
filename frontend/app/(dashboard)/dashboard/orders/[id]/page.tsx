"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtCurrency, fmtNumber, fmtDate } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { TabBar } from "@/components/ui/TabBar";
import { StatusStepper, type StepConfig } from "@/components/ui/StatusStepper";

interface OrderLine {
  id: string;
  product_id: string | null;
  product_name: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  amount: number;
  unit_cost: number;
  commission_attrib: string | null;
}

interface SalesOrder {
  id: string;
  number: string;
  contact_id: string | null;
  contact_name: string | null;
  quotation_id: string | null;
  quotation_number?: string | null;
  lead_id: string | null;
  lead_name?: string | null;
  opportunity_id: string | null;
  opportunity_name?: string | null;
  created_by_name?: string | null;
  project_id: string | null;
  invoice_id: string | null;
  status: string;
  confirmed_at: string | null;
  discount_mode: string;
  order_discount_amount: number;
  order_discount_percent: number;
  created_at: string;
  lines: OrderLine[];
}

interface CommissionAttr {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

type Tab = "lines" | "sov";

const ORDER_TABS = [
  { key: "lines", label: "Line Items" },
  { key: "sov", label: "SOV Breakdown" },
];

// Status steps for the shared StatusStepper
const ORDER_STATUS_CONFIG: Record<string, StepConfig> = {
  pending: { key: "pending", label: "Pending", color: "var(--text-tertiary)", bg: "var(--bg-tertiary)", border: "var(--border-primary)", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  confirmed: { key: "confirmed", label: "Confirmed", color: "var(--accent-teal)", bg: "var(--accent-teal-light)", border: "rgba(13,148,136,0.3)", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  in_progress: { key: "in_progress", label: "In Progress", color: "var(--accent-teal)", bg: "var(--accent-teal-light)", border: "rgba(13,148,136,0.3)", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
  delivered: { key: "delivered", label: "Delivered", color: "var(--success)", bg: "var(--success-light)", border: "var(--success-border)", icon: "M5 13l4 4L19 7" },
  cancelled: { key: "cancelled", label: "Cancelled", color: "var(--danger)", bg: "var(--danger-light)", border: "var(--danger-border)", icon: "M6 18L18 6M6 6l12 12" },
};
const ORDER_STATUS_STEPS = ["pending", "confirmed", "in_progress", "delivered"];

function getOrderSteps(status: string): StepConfig[] {
  const isTerminal = status === "cancelled";
  const keys = isTerminal ? [...ORDER_STATUS_STEPS.slice(0, -1), status] : ORDER_STATUS_STEPS;
  return keys.map((k) => ORDER_STATUS_CONFIG[k] || ORDER_STATUS_CONFIG.pending);
}

function OrderMetaRow({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)", fontSize: 13, fontWeight: 500 }}>
        <Icon path={icon} size={14} />
        {label}
      </div>
      {href ? (
        <Link href={href} style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-blue)", textDecoration: "none" }}>{value}</Link>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("lines");
  const [commissionAttrs, setCommissionAttrs] = useState<CommissionAttr[]>([]);
  const [sovCosts, setSovCosts] = useState<Record<string, string>>({});
  const [sovCommissions, setSovCommissions] = useState<Record<string, string>>({});
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [sovSaving, setSovSaving] = useState(false);
  const [sovDirty, setSovDirty] = useState(false);
  const [sovMsg, setSovMsg] = useState("");

  useEffect(() => {
    load();
    api.get("/api/commission-attributes/?is_active=true").then((d) => setCommissionAttrs(Array.isArray(d) ? d as CommissionAttr[] : [])).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!order) return;
    const costs: Record<string, string> = {};
    const comms: Record<string, string> = {};
    order.lines.forEach((l) => {
      costs[l.id] = String(l.unit_cost || 0);
      comms[l.id] = l.commission_attrib || "";
    });
    setSovCosts(costs);
    setSovCommissions(comms);
    setDiscountMode((order.discount_mode as "amount" | "percent") || "amount");
    setDiscountValue(
      order.discount_mode === "percent"
        ? String(order.order_discount_percent || 0)
        : String(order.order_discount_amount || 0)
    );
    setSovDirty(false);
    setSovMsg("");
  }, [order]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/orders/${id}`);
      setOrder(data as SalesOrder);
    } catch (err) {
      setError("Order not found");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setActionLoading(true);
    setError("");
    try {
      const data = await api.patch(`/api/orders/${id}`, { status: newStatus });
      setOrder(data as SalesOrder);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveSOV() {
    if (!order) return;
    setSovSaving(true);
    setSovMsg("");
    try {
      const line_updates = order.lines.map((l) => ({
        line_id: l.id,
        unit_cost: parseFloat(sovCosts[l.id] || "0") || 0,
        commission_attrib: sovCommissions[l.id] || null,
      }));
      const patch: Record<string, unknown> = {
        discount_mode: discountMode,
        line_updates,
      };
      if (discountMode === "amount") {
        patch.order_discount_amount = parseFloat(discountValue) || 0;
        patch.order_discount_percent = 0;
      } else {
        patch.order_discount_percent = parseFloat(discountValue) || 0;
        patch.order_discount_amount = 0;
      }
      const data = await api.patch(`/api/orders/${id}`, patch);
      setOrder(data as SalesOrder);
      setSovDirty(false);
      setSovMsg("Saved");
      setTimeout(() => setSovMsg(""), 2000);
    } catch (err: unknown) {
      setSovMsg((err as { message?: string })?.message || "Save failed");
    } finally {
      setSovSaving(false);
    }
  }

  function markDirty() { if (!sovDirty) setSovDirty(true); }

  async function confirmOrder() {
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/orders/${id}/confirm`, {});
      await load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to confirm order";
      setError(message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 400 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
        <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Link href="/dashboard/orders" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
          <Icon path="M19 12H5 M12 19l-7-7 7-7" size={14} />
          Back to Orders
        </Link>
        <div className="empty-state" style={{ marginTop: 48 }}>
          <div className="empty-state-icon">
            <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" size={48} />
          </div>
          <div className="empty-state-title">Order not found</div>
          <div className="empty-state-description">{error || "The order may have been deleted or you don't have access."}</div>
          <Link href="/dashboard/orders" className="btn-primary btn-sm" style={{ marginTop: 8, textDecoration: "none" }}>Back to list</Link>
        </div>
      </div>
    );
  }

  const totalAmount = order.lines?.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) ?? 0;
  const orderSubtotal = totalAmount;
  const discountTotal = discountMode === "percent"
    ? orderSubtotal * (parseFloat(discountValue) || 0) / 100
    : (parseFloat(discountValue) || 0);
  const clampedDiscount = Math.min(Math.max(discountTotal, 0), orderSubtotal);
  const grandTotal = orderSubtotal - clampedDiscount;
  const vatAmount = order.lines?.reduce((s, l) => s + (Number(l.amount) || 0) * ((Number(l.vat_rate) || 0) / 100), 0) ?? 0;

  const sovEditable = order.status === "pending";
  const statusCfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.pending;
  const createdDate = order.created_at ? new Date(order.created_at) : null;

  const sovRows = order.lines.map((l) => {
    const lineSubtotal = Number(l.quantity) * Number(l.unit_price);
    const allocDiscount = orderSubtotal > 0 ? clampedDiscount * (lineSubtotal / orderSubtotal) : 0;
    const revenue = lineSubtotal - allocDiscount;
    const uc = parseFloat(sovCosts[l.id] || "0") || 0;
    const plannedExp = Number(l.quantity) * uc;
    const profit = revenue - plannedExp;
    const tax = revenue * (Number(l.vat_rate) || 0) / 100;
    const netAchievement = profit - tax;
    return { ...l, lineSubtotal, allocDiscount, revenue, unitCost: uc, plannedExp, profit, tax, netAchievement };
  });
  const sovTotals = sovRows.reduce((t, r) => ({
    qty: t.qty + Number(r.quantity),
    subtotal: t.subtotal + r.lineSubtotal,
    discount: t.discount + r.allocDiscount,
    revenue: t.revenue + r.revenue,
    plannedExp: t.plannedExp + r.plannedExp,
    profit: t.profit + r.profit,
    tax: t.tax + r.tax,
    net: t.net + r.netAchievement,
  }), { qty: 0, subtotal: 0, discount: 0, revenue: 0, plannedExp: 0, profit: 0, tax: 0, net: 0 });

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb items={[
        ...(fromContactId && fromContactName ? [
          { label: "Contacts", href: "/dashboard/contacts" },
          { label: fromContactName, href: `/dashboard/contacts/${fromContactId}` },
        ] : []),
        { label: "Orders", href: "/dashboard/orders" },
        { label: order.number },
      ]} />

      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text-primary)", lineHeight: 1.2 }}>
              {order.number}
            </h1>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: "var(--radius-full)",
              fontSize: 12, fontWeight: 600,
              background: statusCfg.bg, color: statusCfg.color,
              border: `1px solid ${statusCfg.border}`,
              textTransform: "capitalize",
            }}>
              <Icon path={statusCfg.icon} size={12} />
              {statusCfg.label}
            </span>
          </div>
          <p style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 400 }}>
            {order.contact_name || order.lead_name || "No contact assigned"}
            {order.created_at && <> · Created {fmtDate(order.created_at)}</>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          {order.status === "pending" && (
            <button className="btn-primary" disabled={actionLoading} onClick={confirmOrder}
              style={{ background: "var(--accent-teal)", borderColor: "var(--accent-teal)" }}
            >
              <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={16} />
              Confirm Order
            </button>
          )}
          {order.status === "confirmed" && (
            <button className="btn-secondary btn-sm" disabled={actionLoading} onClick={() => updateStatus("in_progress")}>
              <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={14} />
              Start Progress
            </button>
          )}
          {order.status === "in_progress" && (
            <button className="btn-primary btn-sm" disabled={actionLoading} onClick={() => updateStatus("delivered")}
              style={{ background: "var(--success)", borderColor: "var(--success)" }}
            >
              <Icon path="M5 13l4 4L19 7" size={14} />
              Mark Delivered
            </button>
          )}
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <button className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={actionLoading} onClick={() => updateStatus("cancelled")}>
              <Icon path="M6 18L18 6M6 6l12 12" size={14} />
              Cancel
            </button>
          )}
          {order.invoice_id && (
            <Link
              href={`/dashboard/invoices/${order.invoice_id}`}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "var(--accent-blue-light)",
                border: "1px solid rgba(59,130,246,0.3)", borderRadius: "var(--radius-md)",
                padding: "8px 14px", fontSize: 13, fontWeight: 600,
                color: "var(--accent-blue)", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" size={14} />
              View Invoice
            </Link>
          )}
          {order.project_id && (
            <Link
              href={`/dashboard/projects/${order.project_id}`}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "var(--accent-teal-light)",
                border: "1px solid rgba(13,148,136,0.3)", borderRadius: "var(--radius-md)",
                padding: "8px 14px", fontSize: 13, fontWeight: 600,
                color: "var(--accent-teal)", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              <Icon path="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" size={14} />
              View Project
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: 20, padding: "12px 16px",
          background: "var(--danger-light)", border: "1px solid var(--danger-border)",
          borderRadius: "var(--radius-lg)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 500, color: "var(--danger)",
        }}>
          <Icon path="M12 9v2m0 4h.01 M10.29 3.86l-8.58 14.86A2 2 0 0 0 3.46 21h17.08a2 2 0 0 0 1.75-2.98L13.71 3.86a2 2 0 0 0-3.42 0z" size={16} />
          {error}
        </div>
      )}

      {/* Source chain */}
      {(order.quotation_id || order.lead_id || order.opportunity_id) && (
        <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 20px" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Source chain</span>
          {order.lead_id && (
            <Link href="/dashboard/crm" className="badge badge-neutral" style={{ textDecoration: "none" }}>
              {order.lead_name || "Lead"}
            </Link>
          )}
          {order.lead_id && order.opportunity_id && <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />}
          {order.opportunity_id && (
            <Link href="/dashboard/crm" className="badge badge-neutral" style={{ textDecoration: "none" }}>
              {order.opportunity_name || "Opportunity"}
            </Link>
          )}
          {(order.lead_id || order.opportunity_id) && order.quotation_id && <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />}
          {order.quotation_id && (
            <Link href={`/dashboard/quotations/${order.quotation_id}`} className="badge" style={{ textDecoration: "none", background: "var(--accent-purple-light)", color: "var(--accent-purple)" }}>
              {order.quotation_number || "Quotation"}
            </Link>
          )}
          <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />
          <span className="badge" style={{ background: "var(--accent-teal)", color: "#fff" }}>This Order</span>
        </div>
      )}

      {/* Status Stepper */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <StatusStepper steps={getOrderSteps(order.status)} currentStep={order.status} />
      </div>

      {/* Main content: two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Left: Tabs + Content */}
        <div>
          <TabBar tabs={ORDER_TABS} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as Tab)} />

          {activeTab === "lines" && (
            <div className="card" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                  background: "var(--accent-teal-light)", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent-teal)",
                }}>
                  <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" size={14} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Line Items</div>
                  <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 1 }}>{order.lines?.length || 0} item{(order.lines?.length || 0) !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 20 }}>#</th>
                      <th>Description</th>
                      <th style={{ width: 80, textAlign: "center" }}>Qty</th>
                      <th style={{ width: 120, textAlign: "right" }}>Unit Price</th>
                      <th style={{ width: 70, textAlign: "center" }}>VAT</th>
                      <th style={{ width: 130, textAlign: "right", paddingRight: 20 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines?.map((line, i) => (
                      <tr key={line.id}>
                        <td style={{ paddingLeft: 20, color: "var(--text-quaternary)", fontWeight: 600, fontSize: 12 }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{line.description}</div>
                          {line.product_name && (
                            <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                              <Icon path="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" size={10} />
                              {line.product_name}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{line.quantity}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNumber(line.unit_price)}</td>
                        <td style={{ textAlign: "center", color: "var(--text-tertiary)" }}>{fmtNumber(Number(line.vat_rate) || 0, 0)}%</td>
                        <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", paddingRight: 20 }}>{fmtNumber(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Totals section matching quotation pattern */}
              <div style={{ borderTop: "1px solid var(--border-primary)", padding: "0 20px" }}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ width: 280 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                      <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>Subtotal</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtCurrency(orderSubtotal)}
                      </span>
                    </div>
                    {clampedDiscount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                        <span style={{ fontSize: 13, color: "var(--danger)", fontWeight: 500 }}>Discount</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
                          −{fmtCurrency(clampedDiscount)}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                      <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>VAT</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtCurrency(vatAmount)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Total</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtCurrency(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "sov" && (
            <div className="card" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>Order Discount</span>
                {sovEditable ? (
                  <>
                    <select value={discountMode} onChange={(e) => { setDiscountMode(e.target.value as "amount" | "percent"); markDirty(); }}
                      style={{ padding: "6px 8px", fontSize: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", width: 90 }}>
                      <option value="amount">Amount</option>
                      <option value="percent">Percent</option>
                    </select>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input type="number" min="0" step="0.01" value={discountValue}
                        onChange={(e) => { setDiscountValue(e.target.value); markDirty(); }}
                        style={{ padding: "6px 8px", fontSize: 13, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", width: 120, paddingRight: 32 }} />
                      <span style={{ position: "absolute", right: 8, fontSize: 11, color: "var(--text-quaternary)", pointerEvents: "none" }}>
                        {discountMode === "percent" ? "%" : "AED"}
                      </span>
                    </div>
                    {discountMode === "percent" && clampedDiscount > 0 && (
                      <span style={{ fontSize: 12, color: "var(--text-quaternary)" }}>= {fmtNumber(clampedDiscount)} AED</span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {clampedDiscount > 0 ? `${fmtNumber(clampedDiscount)} AED` : "None"}
                  </span>
                )}
              </div>
              <div className="table-container" style={{ overflowX: "auto" }}>
                <table style={{ minWidth: 900, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 140 }}>Description</th>
                      <th style={{ width: 50, textAlign: "right" }}>Qty</th>
                      <th style={{ width: 90, textAlign: "right" }}>Unit Price</th>
                      <th style={{ width: 90, textAlign: "right" }}>Subtotal</th>
                      <th style={{ width: 80, textAlign: "right" }}>Discount</th>
                      <th style={{ width: 90, textAlign: "right" }}>Revenue</th>
                      <th style={{ width: 90, textAlign: "right" }}>Unit Cost</th>
                      <th style={{ width: 90, textAlign: "right" }}>Planned Exp</th>
                      <th style={{ width: 80, textAlign: "right" }}>Profit</th>
                      <th style={{ width: 70, textAlign: "right" }}>Tax</th>
                      <th style={{ width: 90, textAlign: "right" }}>Net Achv</th>
                      <th style={{ width: 110 }}>Comm. Attri</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sovRows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.description}</td>
                        <td style={{ textAlign: "right" }}>{r.quantity}</td>
                        <td style={{ textAlign: "right" }}>{fmtNumber(r.unit_price)}</td>
                        <td style={{ textAlign: "right" }}>{fmtNumber(r.lineSubtotal)}</td>
                        <td style={{ textAlign: "right", color: r.allocDiscount > 0 ? "var(--danger)" : "var(--text-quaternary)" }}>
                          {r.allocDiscount > 0 ? `−${fmtNumber(r.allocDiscount)}` : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtNumber(r.revenue)}</td>
                        <td style={{ textAlign: "right" }}>
                          {sovEditable ? (
                            <input type="number" min="0" step="0.01" value={sovCosts[r.id] ?? "0"}
                              onChange={(e) => { setSovCosts((p) => ({ ...p, [r.id]: e.target.value })); markDirty(); }}
                              style={{ width: 70, padding: "3px 6px", fontSize: 12, textAlign: "right", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }} />
                          ) : (
                            <span>{fmtNumber(r.unitCost)}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>{fmtNumber(r.plannedExp)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: r.profit >= 0 ? "var(--success)" : "var(--danger)" }}>
                          {fmtNumber(r.profit)}
                        </td>
                        <td style={{ textAlign: "right" }}>{fmtNumber(r.tax)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: r.netAchievement >= 0 ? "var(--success)" : "var(--danger)" }}>
                          {fmtNumber(r.netAchievement)}
                        </td>
                        <td>
                          {sovEditable ? (
                            <select value={sovCommissions[r.id] ?? ""}
                              onChange={(e) => { setSovCommissions((p) => ({ ...p, [r.id]: e.target.value })); markDirty(); }}
                              style={{ width: "100%", padding: "3px 4px", fontSize: 11, border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)" }}>
                              <option value="">—</option>
                              {commissionAttrs.map((ca) => <option key={ca.id} value={ca.label}>{ca.label}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: 11 }}>{r.commission_attrib || "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border-primary)" }}>
                      <td>Totals</td>
                      <td style={{ textAlign: "right" }}>{sovTotals.qty}</td>
                      <td></td>
                      <td style={{ textAlign: "right" }}>{fmtNumber(sovTotals.subtotal)}</td>
                      <td style={{ textAlign: "right", color: sovTotals.discount > 0 ? "var(--danger)" : "var(--text-quaternary)" }}>
                        {sovTotals.discount > 0 ? `−${fmtNumber(sovTotals.discount)}` : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>{fmtNumber(sovTotals.revenue)}</td>
                      <td></td>
                      <td style={{ textAlign: "right" }}>{fmtNumber(sovTotals.plannedExp)}</td>
                      <td style={{ textAlign: "right", color: sovTotals.profit >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {fmtNumber(sovTotals.profit)}
                      </td>
                      <td style={{ textAlign: "right" }}>{fmtNumber(sovTotals.tax)}</td>
                      <td style={{ textAlign: "right", color: sovTotals.net >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {fmtNumber(sovTotals.net)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {sovEditable && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 16, padding: "0 20px 16px" }}>
                  {sovMsg && <span style={{ fontSize: 12, color: sovMsg === "Saved" ? "var(--success)" : "var(--danger)" }}>{sovMsg}</span>}
                  <button onClick={saveSOV} disabled={sovSaving || !sovDirty}
                    className="btn-primary" style={{ padding: "8px 20px", fontSize: 13, background: "var(--accent-teal)", borderColor: "var(--accent-teal)" }}>
                    {sovSaving ? "Saving..." : "Save SOV"}
                  </button>
                </div>
              )}
              {!sovEditable && (
                <div style={{ marginTop: 12, padding: "0 20px 16px", fontSize: 12, color: "var(--text-quaternary)", fontStyle: "italic" }}>
                  SOV data is locked after confirmation.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Grand Total Card - Teal */}
          <div style={{
            background: "linear-gradient(135deg, var(--accent-teal), #0f766e)", borderRadius: "var(--radius-xl)",
            padding: "20px", color: "#fff", position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -30, right: -30, width: 100, height: 100,
              borderRadius: "50%", background: "rgba(255,255,255,0.06)",
            }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Grand Total
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.2, position: "relative" }}>
              {fmtNumber(grandTotal)}
              <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 6, opacity: 0.6 }}>AED</span>
            </div>
            {clampedDiscount > 0 && (
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>
                Discount: −{fmtCurrency(clampedDiscount)}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subtotal</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmtNumber(orderSubtotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>VAT</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmtNumber(vatAmount)}</div>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "var(--radius-sm)", flexShrink: 0,
                background: "var(--accent-teal-light)", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-teal)",
              }}>
                <Icon path="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7" size={12} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Details</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {order.contact_name && (
                <OrderMetaRow
                  icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                  label="Contact"
                  value={order.contact_name}
                  href={order.contact_id ? `/dashboard/contacts/${order.contact_id}` : undefined}
                />
              )}
              {order.lead_name && (
                <OrderMetaRow icon="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" label="Lead" value={order.lead_name} href="/dashboard/crm" />
              )}
              {order.opportunity_name && (
                <OrderMetaRow icon="M22 12h-4l-3 9L9 3l-3 9H2" label="Opportunity" value={order.opportunity_name} href="/dashboard/crm" />
              )}
              {order.quotation_number && (
                <OrderMetaRow
                  icon="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"
                  label="From Quotation"
                  value={order.quotation_number}
                  href={order.quotation_id ? `/dashboard/quotations/${order.quotation_id}` : undefined}
                />
              )}
              {order.created_by_name && (
                <OrderMetaRow icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" label="Created by" value={order.created_by_name} />
              )}
              {createdDate && (
                <OrderMetaRow
                  icon="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18"
                  label="Created"
                  value={fmtDate(order.created_at)}
                />
              )}
              {order.confirmed_at && (
                <OrderMetaRow
                  icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  label="Confirmed"
                  value={fmtDate(order.confirmed_at)}
                />
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {(order.status !== "cancelled" && order.status !== "delivered") && (
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "var(--radius-sm)", flexShrink: 0,
                  background: "var(--accent-teal-light)", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent-teal)",
                }}>
                  <Icon path="M13 10V3L4 14h7v7l9-11h-7z" size={12} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Quick Actions</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {order.status === "pending" && (
                  <button className="btn-primary btn-sm" disabled={actionLoading} onClick={confirmOrder}
                    style={{ width: "100%", background: "var(--accent-teal)", borderColor: "var(--accent-teal)" }}
                  >
                    <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={14} />
                    Confirm Order
                  </button>
                )}
                {order.status === "confirmed" && (
                  <button className="btn-secondary btn-sm" disabled={actionLoading} onClick={() => updateStatus("in_progress")}
                    style={{ width: "100%", justifyContent: "flex-start" }}
                  >
                    <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={14} />
                    Start Progress
                  </button>
                )}
                {order.status === "in_progress" && (
                  <button className="btn-sm" disabled={actionLoading} onClick={() => updateStatus("delivered")}
                    style={{ width: "100%", justifyContent: "flex-start", background: "var(--success-light)", color: "var(--success)", border: "1px solid var(--success-border)" }}
                  >
                    <Icon path="M5 13l4 4L19 7" size={14} />
                    Mark Delivered
                  </button>
                )}
                {order.invoice_id && (
                  <Link href={`/dashboard/invoices/${order.invoice_id}`} className="btn-secondary btn-sm"
                    style={{ width: "100%", justifyContent: "flex-start", textDecoration: "none" }}
                  >
                    <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" size={14} />
                    View Invoice
                  </Link>
                )}
                {order.project_id && (
                  <Link href={`/dashboard/projects/${order.project_id}`} className="btn-secondary btn-sm"
                    style={{ width: "100%", justifyContent: "flex-start", textDecoration: "none" }}
                  >
                    <Icon path="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" size={14} />
                    View Project
                  </Link>
                )}
                <button className="btn-ghost btn-sm" disabled={actionLoading} onClick={() => updateStatus("cancelled")}
                  style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
                >
                  <Icon path="M6 18L18 6M6 6l12 12" size={14} />
                  Cancel Order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
