"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface DefaultsData {
  default_wallet_min_balance: number;
  default_vat_rate: number;
  default_currency: string;
  quotation_prefix: string;
  order_prefix: string;
  invoice_prefix: string;
  number_padding: string;
  expiry_alert_days: number[];
}

export default function DefaultsSettingsPage() {
  const [data, setData] = useState<DefaultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<DefaultsData>({
    default_wallet_min_balance: 1000,
    default_vat_rate: 5,
    default_currency: "AED",
    quotation_prefix: "QUO",
    order_prefix: "ORD",
    invoice_prefix: "INV",
    number_padding: "3",
    expiry_alert_days: [90, 60, 30],
  });

  useEffect(() => {
    api
      .get("/api/settings/defaults")
      .then((d) => {
        setData(d);
        setForm({
          default_wallet_min_balance: Number(d.default_wallet_min_balance),
          default_vat_rate: Number(d.default_vat_rate),
          default_currency: String(d.default_currency),
          quotation_prefix: String(d.quotation_prefix),
          order_prefix: String(d.order_prefix),
          invoice_prefix: String(d.invoice_prefix),
          number_padding: String(d.number_padding),
          expiry_alert_days: Array.isArray(d.expiry_alert_days) ? d.expiry_alert_days : [90, 60, 30],
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch("/api/settings/defaults", {
        default_wallet_min_balance: form.default_wallet_min_balance,
        default_vat_rate: form.default_vat_rate,
        default_currency: form.default_currency,
        quotation_prefix: form.quotation_prefix,
        order_prefix: form.order_prefix,
        invoice_prefix: form.invoice_prefix,
        number_padding: form.number_padding,
        expiry_alert_days: form.expiry_alert_days,
      });
      setData(updated);
      setForm({
        default_wallet_min_balance: Number(updated.default_wallet_min_balance),
        default_vat_rate: Number(updated.default_vat_rate),
        default_currency: String(updated.default_currency),
        quotation_prefix: String(updated.quotation_prefix),
        order_prefix: String(updated.order_prefix),
        invoice_prefix: String(updated.invoice_prefix),
        number_padding: String(updated.number_padding),
        expiry_alert_days: Array.isArray(updated.expiry_alert_days) ? updated.expiry_alert_days : [90, 60, 30],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleExpiryChange = (idx: number, val: number) => {
    const next = [...form.expiry_alert_days];
    next[idx] = val;
    setForm((f) => ({ ...f, expiry_alert_days: next }));
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Organization Defaults</h3>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 24 }}>
        Default values for new wallets, documents, and alerts.
      </p>
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Default Wallet Minimum Balance (AED)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.default_wallet_min_balance}
              onChange={(e) => setForm((f) => ({ ...f, default_wallet_min_balance: parseFloat(e.target.value) || 0 }))}
              className="input"
              style={{ width: "100%", maxWidth: 200 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Default VAT Rate (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.default_vat_rate}
              onChange={(e) => setForm((f) => ({ ...f, default_vat_rate: parseFloat(e.target.value) || 0 }))}
              className="input"
              style={{ width: "100%", maxWidth: 200 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Default Currency
            </label>
            <input
              type="text"
              maxLength={3}
              value={form.default_currency}
              onChange={(e) => setForm((f) => ({ ...f, default_currency: e.target.value.toUpperCase() }))}
              className="input"
              style={{ width: "100%", maxWidth: 120 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Number Sequence Prefixes
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Quotation</span>
                <input
                  type="text"
                  value={form.quotation_prefix}
                  onChange={(e) => setForm((f) => ({ ...f, quotation_prefix: e.target.value }))}
                  className="input"
                  style={{ width: 80, marginLeft: 4 }}
                />
              </div>
              <div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Order</span>
                <input
                  type="text"
                  value={form.order_prefix}
                  onChange={(e) => setForm((f) => ({ ...f, order_prefix: e.target.value }))}
                  className="input"
                  style={{ width: 80, marginLeft: 4 }}
                />
              </div>
              <div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Invoice</span>
                <input
                  type="text"
                  value={form.invoice_prefix}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_prefix: e.target.value }))}
                  className="input"
                  style={{ width: 80, marginLeft: 4 }}
                />
              </div>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Number Padding (digits)
            </label>
            <input
              type="text"
              value={form.number_padding}
              onChange={(e) => setForm((f) => ({ ...f, number_padding: e.target.value }))}
              className="input"
              style={{ width: 80 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Expiry Alert Days (before expiry)
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {form.expiry_alert_days.map((d, i) => (
                <input
                  key={i}
                  type="number"
                  min={1}
                  max={365}
                  value={d}
                  onChange={(e) => handleExpiryChange(i, parseInt(e.target.value, 10) || 0)}
                  className="input"
                  style={{ width: 70 }}
                />
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
              Days before expiry to trigger alerts (e.g. 90, 60, 30)
            </p>
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={saving}
          style={{ marginTop: 24 }}
        >
          {saving ? "Saving..." : "Save Defaults"}
        </button>
      </form>
    </div>
  );
}
