"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtCurrency, fmtNumber, fmtDate } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StatusStepper, type StepConfig } from "@/components/ui/StatusStepper";

interface QuotationLine {
  id: string;
  product_id: string | null;
  product_name: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  amount: number;
}

interface Quotation {
  id: string;
  number: string;
  contact_id: string | null;
  contact_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  opportunity_id: string | null;
  opportunity_name: string | null;
  status: string;
  total: number;
  vat_amount: number;
  valid_until: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  lines: QuotationLine[];
}

// --- Status helpers ---
const STATUS_STEPS = ["draft", "sent", "accepted"];
const STATUS_CONFIG: Record<string, StepConfig> = {
  draft: { key: "draft", label: "Draft", color: "var(--text-tertiary)", bg: "var(--bg-tertiary)", border: "var(--border-primary)", icon: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" },
  sent: { key: "sent", label: "Sent", color: "var(--accent-blue)", bg: "var(--accent-blue-light)", border: "var(--info-border)", icon: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" },
  accepted: { key: "accepted", label: "Accepted", color: "var(--success)", bg: "var(--success-light)", border: "var(--success-border)", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" },
  rejected: { key: "rejected", label: "Rejected", color: "var(--danger)", bg: "var(--danger-light)", border: "var(--danger-border)", icon: "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" },
  expired: { key: "expired", label: "Expired", color: "var(--warning)", bg: "var(--warning-light)", border: "var(--warning-border)", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2" },
};

function getQuotationSteps(status: string): StepConfig[] {
  const isTerminal = status === "rejected" || status === "expired";
  const keys = isTerminal ? [...STATUS_STEPS.slice(0, STATUS_STEPS.indexOf("accepted")), status] : STATUS_STEPS;
  return keys.map((k) => STATUS_CONFIG[k] || STATUS_CONFIG.draft);
}

function QuoteMetaRow({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
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

// --- Expiry helpers ---
function getExpiryInfo(validUntil: string | null): { text: string; color: string; bg: string; icon: string } | null {
  if (!validUntil) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(validUntil + "T00:00:00");
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} ago`, color: "var(--danger)", bg: "var(--danger-light)", icon: "M12 9v2m0 4h.01 M10.29 3.86l-8.58 14.86A2 2 0 0 0 3.46 21h17.08a2 2 0 0 0 1.75-2.98L13.71 3.86a2 2 0 0 0-3.42 0z" };
  if (diffDays <= 7) return { text: `Expires in ${diffDays} day${diffDays !== 1 ? "s" : ""}`, color: "var(--warning)", bg: "var(--warning-light)", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2" };
  return null;
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const fromContactId = searchParams.get("from_contact");
  const fromContactName = searchParams.get("from_contact_name");
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editLines, setEditLines] = useState<{ product_id: string; description: string; quantity: string; unit_price: string; vat_rate: string }[]>([]);
  const [editValidUntil, setEditValidUntil] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    if (!quotation) return;
    setEditLines(quotation.lines.map(l => ({
      product_id: l.product_id || "",
      description: l.description,
      quantity: String(l.quantity),
      unit_price: String(l.unit_price),
      vat_rate: String(l.vat_rate),
    })));
    setEditValidUntil(quotation.valid_until || "");
    setEditing(true);
    setError("");
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  function addEditLine() {
    setEditLines(prev => [...prev, { product_id: "", description: "", quantity: "1", unit_price: "", vat_rate: "5" }]);
  }

  function removeEditLine(i: number) {
    setEditLines(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateEditLine(i: number, field: string, value: string) {
    setEditLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  async function saveEdit() {
    const validLines = editLines.filter(l => l.description.trim() && l.unit_price);
    if (validLines.length === 0) {
      setError("At least one line item with description and price is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await api.patch(`/api/quotations/${id}`, {
        valid_until: editValidUntil || null,
        lines: validLines.map(l => ({
          product_id: l.product_id || null,
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          vat_rate: parseFloat(l.vat_rate) || 0,
        })),
      });
      setQuotation(data as Quotation);
      setEditing(false);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/quotations/${id}`);
      setQuotation(data as Quotation);
    } catch {
      setError("Quotation not found");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setActionLoading(true);
    setError("");
    try {
      const data = await api.patch(`/api/quotations/${id}`, { status: newStatus });
      setQuotation(data as Quotation);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  }

  async function convertToOrder() {
    if (!quotation?.contact_id) {
      setError("Quotation must have a contact to convert to order");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await api.post("/api/orders/", {
        contact_id: quotation.contact_id,
        quotation_id: quotation.id,
      });
      router.push("/dashboard/orders");
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Failed to create order");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 400 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
        <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading quotation...</p>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div>
        <Link href="/dashboard/quotations" style={{
          fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500,
        }}>
          <Icon path="M19 12H5 M12 19l-7-7 7-7" size={14} />
          Back to Quotations
        </Link>
        <div className="empty-state" style={{ marginTop: 48 }}>
          <div className="empty-state-icon">
            <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" size={48} />
          </div>
          <div className="empty-state-title">Quotation not found</div>
          <div className="empty-state-description">{error || "The quotation may have been deleted or you don't have access."}</div>
          <Link href="/dashboard/quotations" className="btn-primary btn-sm" style={{ marginTop: 8, textDecoration: "none" }}>Back to list</Link>
        </div>
      </div>
    );
  }

  const canConvert = quotation.status === "accepted" && quotation.contact_id;
  const subtotal = Number(quotation.total) - Number(quotation.vat_amount);
  const expiryInfo = quotation.status !== "accepted" && quotation.status !== "rejected" ? getExpiryInfo(quotation.valid_until) : null;
  const createdDate = quotation.created_at ? new Date(quotation.created_at) : null;
  const statusCfg = STATUS_CONFIG[quotation.status] || STATUS_CONFIG.draft;

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb items={[
        ...(fromContactId && fromContactName ? [
          { label: "Contacts", href: "/dashboard/contacts" },
          { label: fromContactName, href: `/dashboard/contacts/${fromContactId}` },
        ] : []),
        { label: "Quotations", href: "/dashboard/quotations" },
        { label: quotation.number },
      ]} />

      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text-primary)", lineHeight: 1.2 }}>
              {quotation.number}
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
            {quotation.contact_name || quotation.lead_name || "No contact assigned"}
            {quotation.created_at && <> · Created {fmtDate(quotation.created_at)}</>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          {!editing && (quotation.status === "draft" || quotation.status === "sent") && (
            <button className="btn-secondary btn-sm" onClick={startEdit}>
              <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />
              Edit
            </button>
          )}
          {editing && (
            <>
              <button className="btn-ghost btn-sm" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="btn-primary btn-sm" onClick={saveEdit} disabled={saving}
                style={{ background: "var(--success)", borderColor: "var(--success)" }}
              >
                <Icon path="M20 6L9 17l-5-5" size={14} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
          {!editing && quotation.status === "draft" && (
            <button className="btn-secondary btn-sm" disabled={actionLoading} onClick={() => updateStatus("sent")}>
              <Icon path="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" size={14} />
              Mark as Sent
            </button>
          )}
          {!editing && quotation.status === "sent" && (
            <>
              <button className="btn-primary btn-sm" disabled={actionLoading} onClick={() => updateStatus("accepted")}
                style={{ background: "var(--success)", borderColor: "var(--success)" }}
              >
                <Icon path="M20 6L9 17l-5-5" size={14} />
                Accept
              </button>
              <button className="btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={actionLoading} onClick={() => updateStatus("rejected")}>
                <Icon path="M18 6L6 18 M6 6l12 12" size={14} />
                Reject
              </button>
            </>
          )}
          {!editing && canConvert && (
            <button className="btn-primary" disabled={actionLoading} onClick={convertToOrder}>
              <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" size={16} />
              Convert to Order
            </button>
          )}
        </div>
      </div>

      {/* Error */}
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

      {/* Expiry Warning */}
      {expiryInfo && (
        <div style={{
          marginBottom: 20, padding: "12px 16px",
          background: expiryInfo.bg, border: `1px solid ${expiryInfo.color}20`,
          borderRadius: "var(--radius-lg)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 500, color: expiryInfo.color,
        }}>
          <Icon path={expiryInfo.icon} size={16} />
          {expiryInfo.text}
        </div>
      )}

      {/* Lead-to-contact warning */}
      {!quotation.contact_id && quotation.status === "accepted" && (
        <div style={{
          marginBottom: 20, padding: "12px 16px",
          background: "var(--warning-light)", border: "1px solid var(--warning-border)",
          borderRadius: "var(--radius-lg)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 500, color: "var(--warning)",
        }}>
          <Icon path="M12 9v2m0 4h.01 M10.29 3.86l-8.58 14.86A2 2 0 0 0 3.46 21h17.08a2 2 0 0 0 1.75-2.98L13.71 3.86a2 2 0 0 0-3.42 0z" size={16} />
          This quotation is linked to a lead. Convert the lead to a contact first to create a sales order.
        </div>
      )}

      {/* Status Stepper */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <StatusStepper steps={getQuotationSteps(quotation.status)} currentStep={quotation.status} />
      </div>

      {/* Main content: two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Left: Line Items */}
        <div>
          {editing ? (
            /* ===== EDIT MODE ===== */
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-primary)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--accent-blue-light)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                    background: "var(--accent-blue)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff",
                  }}>
                    <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Editing Line Items</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{editLines.length} item{editLines.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <button type="button" onClick={addEditLine} style={{
                  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
                  color: "var(--accent-blue)", background: "#fff", border: "1px solid var(--accent-blue)",
                  cursor: "pointer", padding: "6px 12px", borderRadius: "var(--radius-full)",
                  transition: "all var(--transition-fast)",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-blue)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "var(--accent-blue)"; }}
                >
                  <Icon path="M12 5v14 M5 12h14" size={13} /> Add Line
                </button>
              </div>

              {/* Valid Until in edit mode */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-primary)", background: "var(--bg-tertiary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", margin: 0, whiteSpace: "nowrap" }}>Valid Until</label>
                  <input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)}
                    style={{ margin: 0, fontSize: 13, padding: "7px 12px", maxWidth: 200 }} />
                </div>
              </div>

              {/* Editable line items */}
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                {editLines.map((line, i) => {
                  const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
                  return (
                    <div key={i} style={{
                      border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)",
                      overflow: "hidden", background: "var(--bg-secondary)",
                    }}>
                      {/* Line header */}
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 14px", background: "var(--bg-tertiary)",
                        borderBottom: "1px solid var(--border-primary)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: "var(--radius-sm)", flexShrink: 0,
                            background: "var(--brand-primary)", color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700,
                          }}>{i + 1}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                            {line.description.trim() || "New item"}
                          </span>
                        </div>
                        <button type="button" onClick={() => removeEditLine(i)} disabled={editLines.length === 1}
                          style={{
                            background: "none", border: "none",
                            cursor: editLines.length === 1 ? "default" : "pointer",
                            color: editLines.length === 1 ? "var(--border-primary)" : "var(--text-quaternary)",
                            padding: 4, borderRadius: "var(--radius-sm)",
                            transition: "all var(--transition-fast)",
                          }}
                          onMouseEnter={(e) => { if (editLines.length > 1) { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = editLines.length === 1 ? "var(--border-primary)" : "var(--text-quaternary)"; }}
                        >
                          <Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={13} />
                        </button>
                      </div>

                      {/* Description */}
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-secondary)" }}>
                        <input placeholder="Description *" value={line.description} onChange={(e) => updateEditLine(i, "description", e.target.value)}
                          style={{ margin: 0, fontSize: 13, padding: "8px 12px" }} />
                      </div>

                      {/* Qty / Price / VAT / Total */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.7fr auto", gap: 0 }}>
                        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--border-secondary)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Qty</div>
                          <input type="number" min="0" step="0.01" placeholder="1" value={line.quantity} onChange={(e) => updateEditLine(i, "quantity", e.target.value)}
                            style={{ margin: 0, fontSize: 13, padding: "6px 8px", textAlign: "center", width: "100%" }} />
                        </div>
                        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--border-secondary)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Price (AED)</div>
                          <input type="number" min="0" step="0.01" placeholder="0.00" value={line.unit_price} onChange={(e) => updateEditLine(i, "unit_price", e.target.value)}
                            style={{ margin: 0, fontSize: 13, padding: "6px 8px", width: "100%" }} />
                        </div>
                        <div style={{ padding: "10px 12px", borderRight: "1px solid var(--border-secondary)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>VAT</div>
                          <select value={line.vat_rate} onChange={(e) => updateEditLine(i, "vat_rate", e.target.value)}
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

              {/* Edit totals preview */}
              {(() => {
                const editSubtotal = editLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);
                const editVat = editLines.reduce((s, l) => {
                  const sub = (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0);
                  return s + sub * ((parseFloat(l.vat_rate) || 0) / 100);
                }, 0);
                const editTotal = editSubtotal + editVat;
                return (
                  <div style={{ borderTop: "1px solid var(--border-primary)", padding: "0 20px" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div style={{ width: 280 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>Subtotal</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {fmtCurrency(editSubtotal)}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-secondary)" }}>
                          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>VAT</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {fmtCurrency(editVat)}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Total</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                            {fmtCurrency(editTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ===== READ MODE ===== */
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-primary)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Line Items</div>
                    <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 1 }}>{quotation.lines?.length || 0} item{(quotation.lines?.length || 0) !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {(quotation.status === "draft" || quotation.status === "sent") && (
                  <button type="button" onClick={startEdit} style={{
                    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
                    color: "var(--text-tertiary)", background: "none", border: "none",
                    cursor: "pointer", padding: "4px 8px", borderRadius: "var(--radius-sm)",
                    transition: "all var(--transition-fast)",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-blue)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                  >
                    <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={12} />
                    Edit
                  </button>
                )}
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
                    {quotation.lines?.map((line, i) => (
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

              {/* Invoice-style totals */}
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
                        {fmtCurrency(quotation.vat_amount)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Total</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtCurrency(quotation.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Financial Summary Card */}
          <div style={{
            background: "var(--brand-primary)", borderRadius: "var(--radius-xl)",
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
              {fmtNumber(quotation.total)}
              <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 6, opacity: 0.6 }}>AED</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subtotal</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmtNumber(subtotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>VAT</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmtNumber(quotation.vat_amount)}</div>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "var(--radius-sm)", flexShrink: 0,
                background: "var(--accent-blue-light)", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-blue)",
              }}>
                <Icon path="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7" size={12} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Details</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {quotation.contact_name && (
                <QuoteMetaRow
                  icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                  label="Contact"
                  value={quotation.contact_name}
                  href={quotation.contact_id ? `/dashboard/contacts/${quotation.contact_id}` : undefined}
                />
              )}
              {quotation.lead_name && (
                <QuoteMetaRow
                  icon="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
                  label="Lead"
                  value={quotation.lead_name}
                  href="/dashboard/crm"
                />
              )}
              {quotation.opportunity_name && (
                <QuoteMetaRow
                  icon="M22 12h-4l-3 9L9 3l-3 9H2"
                  label="Opportunity"
                  value={quotation.opportunity_name}
                  href="/dashboard/crm"
                />
              )}
              <QuoteMetaRow
                icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2"
                label="Valid Until"
                value={quotation.valid_until || "Not set"}
              />
              {quotation.created_by_name && (
                <QuoteMetaRow
                  icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
                  label="Created by"
                  value={quotation.created_by_name}
                />
              )}
              {createdDate && (
                <QuoteMetaRow
                  icon="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18"
                  label="Created"
                  value={fmtDate(quotation.created_at)}
                />
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {(quotation.status === "draft" || quotation.status === "sent" || canConvert) && (
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "var(--radius-sm)", flexShrink: 0,
                  background: "var(--accent-purple-light)", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent-purple)",
                }}>
                  <Icon path="M13 10V3L4 14h7v7l9-11h-7z" size={12} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Quick Actions</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {quotation.status === "draft" && (
                  <button className="btn-secondary btn-sm" disabled={actionLoading} onClick={() => updateStatus("sent")}
                    style={{ width: "100%", justifyContent: "flex-start" }}
                  >
                    <Icon path="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" size={14} />
                    Mark as Sent
                  </button>
                )}
                {quotation.status === "sent" && (
                  <>
                    <button className="btn-sm" disabled={actionLoading} onClick={() => updateStatus("accepted")}
                      style={{ width: "100%", justifyContent: "flex-start", background: "var(--success-light)", color: "var(--success)", border: "1px solid var(--success-border)" }}
                    >
                      <Icon path="M20 6L9 17l-5-5" size={14} />
                      Accept Quotation
                    </button>
                    <button className="btn-ghost btn-sm" disabled={actionLoading} onClick={() => updateStatus("rejected")}
                      style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
                    >
                      <Icon path="M18 6L6 18 M6 6l12 12" size={14} />
                      Reject Quotation
                    </button>
                  </>
                )}
                {canConvert && (
                  <button className="btn-primary btn-sm" disabled={actionLoading} onClick={convertToOrder}
                    style={{ width: "100%" }}
                  >
                    <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" size={14} />
                    Convert to Sales Order
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
