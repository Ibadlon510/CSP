"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { fmtNumber } from "@/lib/format";

type ProjectProduct = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price?: number;
  source: string;
  status: string;
  is_billable: boolean;
  sales_order_id?: string;
  product_name?: string;
  product_code?: string;
  sales_order_number?: string;
  added_by_name?: string;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  code?: string;
  default_unit_price?: number;
};

const statusBadge: Record<string, string> = {
  active: "success",
  pending_approval: "warning",
  rejected: "danger",
};

export default function ProductsTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<ProjectProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | undefined>();
  const [isBillable, setIsBillable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingOrders, setCreatingOrders] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [pp, prods] = await Promise.all([
        api.get(`/api/projects/${projectId}/products`) as Promise<ProjectProduct[]>,
        api.get(`/api/products/`) as Promise<Product[]>,
      ]);
      setItems(pp);
      setProducts(prods);
    } catch {}
    setLoading(false);
  }

  async function addProduct() {
    if (!selectedProductId) return;
    setSubmitting(true);
    try {
      await api.post(`/api/projects/${projectId}/products`, {
        product_id: selectedProductId,
        quantity,
        unit_price: unitPrice,
        is_billable: isBillable,
      });
      setShowAdd(false);
      setSelectedProductId("");
      setQuantity(1);
      setUnitPrice(undefined);
      setIsBillable(true);
      loadData();
      toast.success(isBillable ? "Billable product added" : "Product added — pending approval");
    } catch (err: any) {
      toast.error(err.message || "Failed to add product");
    }
    setSubmitting(false);
  }

  async function createOrders(mode: "single" | "separate") {
    if (selectedIds.size === 0) return;
    setCreatingOrders(true);
    try {
      const res = await api.post(`/api/projects/${projectId}/products/create-orders`, {
        product_ids: Array.from(selectedIds),
        mode,
      }) as any;
      toast.success(res.message || "Sales order(s) created");
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create orders");
    }
    setCreatingOrders(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function removeProduct(ppId: string) {
    if (!confirm("Remove this added product?")) return;
    try {
      await api.delete(`/api/projects/${projectId}/products/${ppId}`);
      loadData();
      toast.success("Product removed");
    } catch (err: any) { toast.error(err.message || "Cannot remove"); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><div className="loading-spinner" style={{ width: 24, height: 24, margin: "0 auto" }} /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h4 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
          {items.length} Product{items.length !== 1 ? "s" : ""}
        </h4>
        <button className="btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          + Add Product
        </button>
      </div>

      {/* Action bar for creating SOs from selected unbilled products */}
      {(() => {
        const unbilled = items.filter((pp) => pp.is_billable && !pp.sales_order_id && pp.status === "active");
        const selCount = Array.from(selectedIds).filter((id) => unbilled.some((u) => u.id === id)).length;
        if (unbilled.length === 0) return null;
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 16px",
            background: "var(--accent-blue-light)", borderRadius: "var(--radius-md)", border: "1px solid var(--accent-blue)",
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 0, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--accent-blue)" }}>
              <input
                type="checkbox"
                checked={selCount === unbilled.length && unbilled.length > 0}
                onChange={() => {
                  if (selCount === unbilled.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(unbilled.map((u) => u.id)));
                  }
                }}
                style={{ cursor: "pointer" }}
              />
              {selCount > 0 ? `${selCount} of ${unbilled.length} unbilled selected` : `${unbilled.length} unbilled product${unbilled.length > 1 ? "s" : ""} — select to create SO`}
            </label>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                className="btn-primary btn-sm"
                disabled={selCount === 0 || creatingOrders}
                onClick={() => createOrders("single")}
                style={{ fontSize: 12 }}
              >
                {creatingOrders ? "Creating..." : "Create as One SO"}
              </button>
              {selCount > 1 && (
                <button
                  className="btn-sm"
                  disabled={creatingOrders}
                  onClick={() => createOrders("separate")}
                  style={{ fontSize: 12, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", cursor: "pointer", borderRadius: "var(--radius-sm)", padding: "6px 12px", fontWeight: 600 }}
                >
                  Create Separate SOs
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <div className="empty-state-title">No products</div>
          <div className="empty-state-description">Products from the sales order will appear here</div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Amount</th>
                <th>Source</th>
                <th>Status</th>
                <th>Sales Order</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((pp) => {
                const canSelect = pp.is_billable && !pp.sales_order_id && pp.status === "active";
                return (
                  <tr key={pp.id} style={{ background: selectedIds.has(pp.id) ? "var(--accent-blue-light)" : undefined }}>
                    <td style={{ textAlign: "center" }}>
                      {canSelect && (
                        <input type="checkbox" checked={selectedIds.has(pp.id)} onChange={() => toggleSelect(pp.id)} style={{ cursor: "pointer" }} />
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{pp.product_name || "—"}</span>
                      {pp.product_code && <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 6 }}>{pp.product_code}</span>}
                    </td>
                    <td style={{ fontSize: 14 }}>{pp.quantity}</td>
                    <td style={{ fontSize: 14 }}>{pp.unit_price != null ? fmtNumber(pp.unit_price) : "—"}</td>
                    <td style={{ fontSize: 14, fontWeight: 600 }}>
                      {pp.unit_price != null ? fmtNumber(Number(pp.quantity) * Number(pp.unit_price)) : "—"}
                    </td>
                    <td>
                      <span className={`badge badge-${pp.source === "original" ? "info" : "accent"}`} style={{ fontSize: 11 }}>
                        {pp.source === "original" ? "Original" : "Added"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${statusBadge[pp.status] || "info"}`} style={{ fontSize: 11 }}>
                        {pp.status.replace(/_/g, " ")}
                      </span>
                      {canSelect && <span style={{ fontSize: 10, color: "var(--warning)", marginLeft: 4, fontWeight: 600 }}>No SO</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {pp.sales_order_number ? (
                        <a href={`/dashboard/orders/${pp.sales_order_id}`} style={{ color: "var(--accent-blue)", fontWeight: 500, textDecoration: "none" }}>{pp.sales_order_number}</a>
                      ) : "—"}
                    </td>
                    <td>
                      {pp.source === "added" && (
                        <button className="btn-ghost btn-sm" onClick={() => removeProduct(pp.id)} style={{ color: "var(--danger)", padding: "2px 6px" }}>✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════ Add Product Panel ═══════ */}
      {showAdd && (
        <>
          <div onClick={() => setShowAdd(false)}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: "var(--z-modal-backdrop)" as any, transition: "opacity var(--transition-base)" }} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 540,
            background: "var(--bg-secondary)", boxShadow: "var(--shadow-xl)",
            zIndex: "var(--z-modal)" as any, overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 28px", borderBottom: "1px solid var(--border-primary)",
              position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1,
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add Product</h3>
                <p style={{ fontSize: 12, color: "var(--text-quaternary)", marginTop: 2 }}>Add a product or service to this project</p>
              </div>
              <button onClick={() => setShowAdd(false)} style={{
                background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)",
                padding: 6, cursor: "pointer", color: "var(--text-tertiary)", transition: "all var(--transition-fast)",
              }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-light)"; e.currentTarget.style.color = "var(--danger)"; }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px 28px" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Product *</label>
                <select value={selectedProductId} onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  const p = products.find((pr) => pr.id === e.target.value);
                  if (p?.default_unit_price) setUnitPrice(Number(p.default_unit_price));
                }} style={{ margin: 0 }}>
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Quantity</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={{ margin: 0 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>Unit Price</label>
                  <input type="number" step="0.01" value={unitPrice ?? ""} onChange={(e) => setUnitPrice(e.target.value ? Number(e.target.value) : undefined)} style={{ margin: 0 }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 14px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 0, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  <input type="radio" name="billing" checked={isBillable} onChange={() => setIsBillable(true)} /> Bill Client
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 0, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  <input type="radio" name="billing" checked={!isBillable} onChange={() => setIsBillable(false)} /> Non-Billable
                </label>
                {!isBillable && (
                  <span style={{ fontSize: 11, color: "var(--warning)", fontStyle: "italic", marginLeft: "auto" }}>Requires approval</span>
                )}
              </div>
            </div>
            <div style={{
              padding: "16px 28px", borderTop: "1px solid var(--border-primary)",
              display: "flex", gap: 12, background: "var(--bg-secondary)",
              position: "sticky", bottom: 0,
            }}>
              <button className="btn-primary" onClick={addProduct} disabled={submitting || !selectedProductId} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600 }}>
                {submitting ? "Adding..." : "Add Product"}
              </button>
              <button onClick={() => setShowAdd(false)} style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", borderRadius: "var(--radius-md)", padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
