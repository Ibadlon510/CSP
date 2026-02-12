"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/ui/Icon";

type Contact = {
  id: string;
  name: string;
  contact_type?: string;
  trade_license_no?: string;
};

export default function NewWalletPage() {
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [minBalance, setMinBalance] = useState("1000.00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    api.get("/api/contacts/").then((data: unknown) => {
      setContacts(data as Contact[]);
    }).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/wallets/", {
        contact_id: contactId,
        minimum_balance: parseFloat(minBalance),
        notes,
      });

      toast.success("Wallet created successfully");
      router.push(`/dashboard/wallets/${(response as { id: string }).id}`);
    } catch (err: any) {
      const msg = err.message || "Failed to create wallet";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <a href="/dashboard/wallets" style={{ fontSize: 14, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12, fontWeight: 500 }}>
            <Icon path="M19 12H5 M12 19l-7-7 7-7" size={16} />
            Back to Wallets
          </a>
          <h1 className="page-title">New Wallet</h1>
          <p className="page-subtitle">Set up a trust wallet for a client contact</p>
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label>Select Contact *</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                required
              >
                <option value="">-- Choose a contact --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.trade_license_no ? `(${c.trade_license_no})` : ""}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Select the client contact for this wallet
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label>Minimum Balance (AED) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
                required
              />
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Red Alert threshold - system will warn when balance drops below this
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label>Notes (Optional)</label>
              <textarea
                rows={4}
                placeholder="Add any relevant notes about this wallet..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={18} />
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className="btn-ghost" onClick={() => router.back()} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? (
                  <>
                    <div className="loading-spinner" style={{ width: 16, height: 16 }}></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={16} />
                    Create Wallet
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="card" style={{ marginTop: 24, background: "var(--info-light)", border: "1px solid var(--info-border)" }}>
          <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "var(--info)", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon path="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16v-4 M12 8h.01" size={18} />
            About Client Wallets
          </h4>
          <ul style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, paddingLeft: 20 }}>
            <li>Each contact can have only one wallet</li>
            <li>Wallets start with zero balance - use Top-up to add funds</li>
            <li>Red Alert triggers when balance drops below minimum threshold</li>
            <li>All transactions are tracked and audited</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
