"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtCurrency, fmtNumber, fmtDate } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StatusStepper, type StepConfig } from "@/components/ui/StatusStepper";

interface InvoiceLine {
  id: string;
  product_id: string | null;
  product_name: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  number: string;
  contact_id: string | null;
  contact_name: string | null;
  sales_order_id: string | null;
  sales_order_number?: string | null;
  lead_id: string | null;
  lead_name?: string | null;
  opportunity_id: string | null;
  opportunity_name?: string | null;
  created_by_name?: string | null;
  status: string;
  due_date: string | null;
  total: number;
  vat_amount: number;
  paid_at: string | null;
  created_at: string;
  lines: InvoiceLine[];
}

// Status steps for the shared StatusStepper
const INVOICE_STATUS_STEPS = ["draft", "sent", "paid"];
const INVOICE_STATUS_CONFIG: Record<string, StepConfig> = {
  draft: { key: "draft", label: "Draft", color: "var(--text-tertiary)", bg: "var(--bg-tertiary)", border: "var(--border-primary)", icon: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" },
  sent: { key: "sent", label: "Sent", color: "var(--accent-amber)", bg: "var(--accent-amber-light)", border: "rgba(245,158,11,0.3)", icon: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" },
  paid: { key: "paid", label: "Paid", color: "var(--success)", bg: "var(--success-light)", border: "var(--success-border)", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" },
  overdue: { key: "overdue", label: "Overdue", color: "var(--danger)", bg: "var(--danger-light)", border: "var(--danger-border)", icon: "M12 9v2m0 4h.01 M10.29 3.86l-8.58 14.86A2 2 0 0 0 3.46 21h17.08a2 2 0 0 0 1.75-2.98L13.71 3.86a2 2 0 0 0-3.42 0z" },
  cancelled: { key: "cancelled", label: "Cancelled", color: "var(--danger)", bg: "var(--danger-light)", border: "var(--danger-border)", icon: "M6 18L18 6M6 6l12 12" },
};

function getInvoiceSteps(status: string): StepConfig[] {
  const isTerminal = status === "overdue" || status === "cancelled";
  const keys = isTerminal ? [...INVOICE_STATUS_STEPS.slice(0, -1), status] : INVOICE_STATUS_STEPS;
  return keys.map((k) => INVOICE_STATUS_CONFIG[k] || INVOICE_STATUS_CONFIG.draft);
}

function InvoiceMetaRow({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
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

function getDueDateInfo(dueDate: string | null, status: string): { text: string; color: string; bg: string; icon: string } | null {
  if (!dueDate || status === "paid" || status === "cancelled") return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: `Overdue ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""}`, color: "var(--danger)", bg: "var(--danger-light)", icon: "M12 9v2m0 4h.01 M10.29 3.86l-8.58 14.86A2 2 0 0 0 3.46 21h17.08a2 2 0 0 0 1.75-2.98L13.71 3.86a2 2 0 0 0-3.42 0z" };
  if (diffDays <= 7) return { text: `Due in ${diffDays} day${diffDays !== 1 ? "s" : ""}`, color: "var(--warning)", bg: "var(--warning-light)", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2" };
  return null;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/invoices/${id}`);
      setInvoice(data as Invoice);
    } catch (err) {
      setError("Invoice not found");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setActionLoading(true);
    setError("");
    try {
      const data = await api.patch(`/api/invoices/${id}`, { status: newStatus });
      setInvoice(data as Invoice);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  }

  async function markAsPaid() {
    setActionLoading(true);
    setError("");
    try {
      const data = await api.post(`/api/invoices/${id}/pay`, { amount: invoice!.total });
      setInvoice(data as Invoice);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to record payment");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 400 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
        <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <Link href="/dashboard/invoices" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
          <Icon path="M19 12H5 M12 19l-7-7 7-7" size={14} />
          Back to Invoices
        </Link>
        <div className="empty-state" style={{ marginTop: 48 }}>
          <div className="empty-state-icon">
            <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" size={48} />
          </div>
          <div className="empty-state-title">Invoice not found</div>
          <div className="empty-state-description">{error || "The invoice may have been deleted or you don't have access."}</div>
          <Link href="/dashboard/invoices" className="btn-primary btn-sm" style={{ marginTop: 8, textDecoration: "none" }}>Back to list</Link>
        </div>
      </div>
    );
  }

  const subtotal = Number(invoice.total) - Number(invoice.vat_amount);
  const canMarkSent = invoice.status === "draft";
  const canMarkPaid = invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.contact_id;
  const statusCfg = INVOICE_STATUS_CONFIG[invoice.status] || INVOICE_STATUS_CONFIG.draft;
  const createdDate = invoice.created_at ? new Date(invoice.created_at) : null;
  const dueDateInfo = getDueDateInfo(invoice.due_date, invoice.status);

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb items={[
        ...(fromContactId && fromContactName ? [
          { label: "Contacts", href: "/dashboard/contacts" },
          { label: fromContactName, href: `/dashboard/contacts/${fromContactId}` },
        ] : []),
        { label: "Invoices", href: "/dashboard/invoices" },
        { label: invoice.number },
      ]} />

      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text-primary)", lineHeight: 1.2 }}>
              {invoice.number}
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
            {invoice.status === "paid" && invoice.paid_at && (
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "4px 10px", borderRadius: "var(--radius-full)",
                fontSize: 11, fontWeight: 600,
                background: "var(--success-light)", color: "var(--success)",
                border: "1px solid var(--success-border)",
              }}>
                Paid {fmtDate(invoice.paid_at)}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 400 }}>
            {invoice.contact_name || invoice.lead_name || "No contact assigned"}
            {invoice.created_at && <> · Created {fmtDate(invoice.created_at)}</>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          {canMarkSent && (
            <button className="btn-secondary btn-sm" disabled={actionLoading} onClick={() => updateStatus("sent")}>
              <Icon path="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" size={14} />
              Mark as Sent
            </button>
          )}
          {canMarkPaid && (
            <button className="btn-primary" disabled={actionLoading} onClick={markAsPaid}
              style={{ background: "var(--accent-amber)", borderColor: "var(--accent-amber)" }}
            >
              <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={16} />
              Mark as Paid
            </button>
          )}
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <button className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={actionLoading} onClick={() => updateStatus("cancelled")}>
              <Icon path="M6 18L18 6M6 6l12 12" size={14} />
              Cancel
            </button>
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

      {/* Due date warning */}
      {dueDateInfo && (
        <div style={{
          marginBottom: 20, padding: "12px 16px",
          background: dueDateInfo.bg, border: `1px solid ${dueDateInfo.color}20`,
          borderRadius: "var(--radius-lg)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 500, color: dueDateInfo.color,
        }}>
          <Icon path={dueDateInfo.icon} size={16} />
          {dueDateInfo.text}
        </div>
      )}

      {/* No-contact alert */}
      {!invoice.contact_id && invoice.status !== "paid" && invoice.status !== "cancelled" && (
        <div style={{
          marginBottom: 20, padding: "12px 16px",
          background: "var(--warning-light)", border: "1px solid var(--warning-border)",
          borderRadius: "var(--radius-lg)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 500, color: "var(--warning)",
        }}>
          <Icon path="M12 9v2m0 4h.01 M10.29 3.86l-8.58 14.86A2 2 0 0 0 3.46 21h17.08a2 2 0 0 0 1.75-2.98L13.71 3.86a2 2 0 0 0-3.42 0z" size={16} />
          This invoice has no contact. Add a contact to record payment and credit the wallet.
        </div>
      )}

      {/* Source chain */}
      {(invoice.sales_order_id || invoice.lead_id || invoice.opportunity_id) && (
        <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 20px" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Source chain</span>
          {invoice.lead_id && (
            <Link href="/dashboard/crm" className="badge badge-neutral" style={{ textDecoration: "none" }}>
              {invoice.lead_name || "Lead"}
            </Link>
          )}
          {invoice.lead_id && invoice.opportunity_id && <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />}
          {invoice.opportunity_id && (
            <Link href="/dashboard/crm" className="badge badge-neutral" style={{ textDecoration: "none" }}>
              {invoice.opportunity_name || "Opportunity"}
            </Link>
          )}
          {(invoice.lead_id || invoice.opportunity_id) && invoice.sales_order_id && <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />}
          {invoice.sales_order_id && (
            <Link href={`/dashboard/orders/${invoice.sales_order_id}`} className="badge" style={{ textDecoration: "none", background: "var(--accent-teal-light)", color: "var(--accent-teal)" }}>
              {invoice.sales_order_number || "Sales Order"}
            </Link>
          )}
          <Icon path="M5 12h14 M12 5l7 7-7 7" size={14} />
          <span className="badge" style={{ background: "var(--accent-amber)", color: "#fff" }}>This Invoice</span>
        </div>
      )}

      {/* Status Stepper */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <StatusStepper steps={getInvoiceSteps(invoice.status)} currentStep={invoice.status} />
      </div>

      {/* Main content: two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Left: Line Items */}
        <div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-primary)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                background: "var(--accent-amber-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-amber)",
              }}>
                <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" size={14} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Line Items</div>
                <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 1 }}>{invoice.lines?.length || 0} item{(invoice.lines?.length || 0) !== 1 ? "s" : ""}</div>
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
                  {invoice.lines?.map((line, i) => (
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
            <div style={{ borderTop: "1px solid var(--border-primary)", padding: "0 20px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: 280 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>Subtotal</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtCurrency(subtotal)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>VAT</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtCurrency(invoice.vat_amount)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtCurrency(invoice.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Grand Total Card - Amber (green when paid) */}
          <div style={{
            background: invoice.status === "paid"
              ? "linear-gradient(135deg, var(--success), #16a34a)"
              : "linear-gradient(135deg, var(--accent-amber), #d97706)",
            borderRadius: "var(--radius-xl)",
            padding: "20px", color: "#fff", position: "relative", overflow: "hidden",
          }}>
            {invoice.status === "paid" && (
              <div style={{
                position: "absolute", top: 12, right: 12,
                background: "rgba(255,255,255,0.2)", padding: "4px 10px",
                borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              }}>
                PAID
              </div>
            )}
            <div style={{
              position: "absolute", top: -30, right: -30, width: 100, height: 100,
              borderRadius: "50%", background: "rgba(255,255,255,0.06)",
            }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Grand Total
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.2, position: "relative" }}>
              {fmtNumber(invoice.total)}
              <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 6, opacity: 0.6 }}>AED</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subtotal</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmtNumber(subtotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>VAT</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmtNumber(invoice.vat_amount)}</div>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "var(--radius-sm)", flexShrink: 0,
                background: "var(--accent-amber-light)", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-amber)",
              }}>
                <Icon path="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7" size={12} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Details</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {invoice.contact_name && (
                <InvoiceMetaRow
                  icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                  label="Contact"
                  value={invoice.contact_name}
                  href={invoice.contact_id ? `/dashboard/contacts/${invoice.contact_id}` : undefined}
                />
              )}
              {invoice.lead_name && (
                <InvoiceMetaRow icon="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" label="Lead" value={invoice.lead_name} href="/dashboard/crm" />
              )}
              {invoice.opportunity_name && (
                <InvoiceMetaRow icon="M22 12h-4l-3 9L9 3l-3 9H2" label="Opportunity" value={invoice.opportunity_name} href="/dashboard/crm" />
              )}
              {invoice.sales_order_number && (
                <InvoiceMetaRow
                  icon="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"
                  label="From Order"
                  value={invoice.sales_order_number}
                  href={invoice.sales_order_id ? `/dashboard/orders/${invoice.sales_order_id}` : undefined}
                />
              )}
              <InvoiceMetaRow
                icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2"
                label="Due Date"
                value={invoice.due_date || "Not set"}
              />
              {invoice.created_by_name && (
                <InvoiceMetaRow icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" label="Created by" value={invoice.created_by_name} />
              )}
              {createdDate && (
                <InvoiceMetaRow
                  icon="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18"
                  label="Created"
                  value={fmtDate(invoice.created_at)}
                />
              )}
              {invoice.paid_at && (
                <InvoiceMetaRow
                  icon="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3"
                  label="Paid"
                  value={fmtDate(invoice.paid_at)}
                />
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "var(--radius-sm)", flexShrink: 0,
                  background: "var(--accent-amber-light)", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent-amber)",
                }}>
                  <Icon path="M13 10V3L4 14h7v7l9-11h-7z" size={12} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Quick Actions</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {canMarkSent && (
                  <button className="btn-secondary btn-sm" disabled={actionLoading} onClick={() => updateStatus("sent")}
                    style={{ width: "100%", justifyContent: "flex-start" }}
                  >
                    <Icon path="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" size={14} />
                    Mark as Sent
                  </button>
                )}
                {canMarkPaid && (
                  <button className="btn-primary btn-sm" disabled={actionLoading} onClick={markAsPaid}
                    style={{ width: "100%", background: "var(--accent-amber)", borderColor: "var(--accent-amber)" }}
                  >
                    <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={14} />
                    Mark as Paid
                  </button>
                )}
                <button className="btn-ghost btn-sm" disabled={actionLoading} onClick={() => updateStatus("cancelled")}
                  style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
                >
                  <Icon path="M6 18L18 6M6 6l12 12" size={14} />
                  Cancel Invoice
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
