"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { fmtNumber } from "@/lib/format";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, SPREADSHEET_CARD_VIEWS } from "@/components/ui/PageViewToggle";

type Wallet = {
  id: string;
  contact_id: string;
  contact_name?: string;
  balance: number;
  currency: string;
  minimum_balance: number;
  status: string;
  is_locked: boolean;
  is_below_threshold?: boolean;
  has_active_alerts?: boolean;
};

type WalletSummary = {
  total_wallets: number;
  active_wallets: number;
  total_balance: number;
  wallets_below_threshold: number;
  critical_alerts: number;
};

export default function WalletsPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ status: [], threshold: [] });
  const [groupBy, setGroupBy] = useState("");
  const [viewMode, setViewMode] = useState("spreadsheet");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [walletsData, summaryData] = await Promise.all([
        api.get("/api/wallets/"),
        api.get("/api/wallets/summary"),
      ]);
      setWallets(walletsData as Wallet[]);
      setSummary(summaryData as WalletSummary);
    } catch (err) {
      console.error("Failed to load wallets", err);
    } finally {
      setLoading(false);
    }
  }

  const walletFilterConfig: FilterFieldConfig[] = [
    { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "frozen", label: "Frozen" }] },
    { key: "threshold", label: "Threshold", options: [{ value: "below", label: "Below Threshold" }] },
  ];
  const walletGroupOptions = [{ value: "status", label: "Status" }];

  const filteredWallets = useMemo(() => {
    let list = wallets;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((w) => (w.contact_name && w.contact_name.toLowerCase().includes(q)) || w.contact_id.toLowerCase().includes(q));
    }
    if (filters.status?.length) list = list.filter((w) => filters.status.includes(w.status));
    if (filters.threshold?.includes("below")) list = list.filter((w) => w.is_below_threshold);
    return list;
  }, [wallets, search, filters]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-content">
            <h1 className="page-title">Wallets</h1>
            <p className="page-subtitle">Loading wallet data...</p>
          </div>
        </div>
        <div className="flex items-center justify-center" style={{ padding: 80 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Client Wallets</h1>
          <p className="page-subtitle">Trust-based financial management</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary btn-sm">
            <Icon path="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={16} />
            Export
          </button>
          <a href="/dashboard/wallets/new" className="btn-primary">
            <Icon path="M12 5v14 M5 12h14" size={16} />
            Create Wallet
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div className="stat-card">
            <div className="stat-label">Total Wallets</div>
            <div className="stat-value">{summary.total_wallets}</div>
            <span className="badge badge-accent" style={{ marginTop: 12 }}>
              {summary.active_wallets} active
            </span>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Balance</div>
            <div className="stat-value" style={{ fontSize: 28 }}>
              {fmtNumber(summary.total_balance)}
              <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 6, color: "var(--text-tertiary)" }}>AED</span>
            </div>
            <span style={{ fontSize: 13, color: "var(--text-quaternary)", marginTop: 12, display: "block" }}>
              Across all wallets
            </span>
          </div>

          <div 
            className="stat-card" 
            style={{ 
              borderColor: summary.wallets_below_threshold > 0 ? "var(--warning)" : "var(--border-primary)",
              borderWidth: summary.wallets_below_threshold > 0 ? 2 : 1
            }}
          >
            <div className="stat-label" style={{ color: summary.wallets_below_threshold > 0 ? "var(--warning)" : "var(--text-tertiary)" }}>
              Below Threshold
            </div>
            <div className="stat-value" style={{ 
              color: summary.wallets_below_threshold > 0 ? "var(--warning)" : "var(--text-primary)" 
            }}>
              {summary.wallets_below_threshold}
            </div>
            {summary.wallets_below_threshold > 0 && (
              <span className="badge badge-warning" style={{ marginTop: 12 }}>
                <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={12} />
                Needs attention
              </span>
            )}
          </div>

          <div 
            className="stat-card" 
            style={{ 
              borderColor: summary.critical_alerts > 0 ? "var(--danger)" : "var(--border-primary)",
              borderWidth: summary.critical_alerts > 0 ? 2 : 1
            }}
          >
            <div className="stat-label" style={{ color: summary.critical_alerts > 0 ? "var(--danger)" : "var(--text-tertiary)" }}>
              Critical Alerts
            </div>
            <div className="stat-value" style={{ 
              color: summary.critical_alerts > 0 ? "var(--danger)" : "var(--text-primary)" 
            }}>
              {summary.critical_alerts}
            </div>
            {summary.critical_alerts > 0 ? (
              <a href="/dashboard/wallets/alerts" className="badge badge-danger" style={{ marginTop: 12, textDecoration: "none" }}>
                <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={12} />
                View alerts
              </a>
            ) : (
              <span className="badge badge-success" style={{ marginTop: 12 }}>
                <Icon path="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" size={12} />
                All clear
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search / Filter / View bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={walletFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={walletGroupOptions} pageKey="wallets" placeholder="Search wallets..." />
        <PageViewToggle value={viewMode} onChange={setViewMode} views={SPREADSHEET_CARD_VIEWS} />
      </div>

      {/* Wallets List */}
      {filteredWallets.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 400 }}>
          <div className="empty-state-icon">
            <Icon path="M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4h-4z" size={48} />
          </div>
          <div className="empty-state-title">No wallets found</div>
          <div className="empty-state-description">
            {search || Object.values(filters).some((a) => a.length > 0)
              ? "Try adjusting your filters"
              : "Create a wallet to start managing client funds"}
          </div>
        </div>
      ) : viewMode === "spreadsheet" ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Balance</th>
                <th>Minimum</th>
                <th>Status</th>
                <th>Alerts</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWallets.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => router.push(`/dashboard/wallets/${w.id}`)}
                  style={{ cursor: "pointer" }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/dashboard/wallets/${w.id}`); } }}
                >
                  <td>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: 2, color: "var(--text-primary)" }}>
                        {w.contact_name || "Unknown Contact"}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-quaternary)", fontFamily: "monospace" }}>
                        ID: {w.contact_id.slice(0, 8)}...
                      </p>
                    </div>
                  </td>
                  <td>
                    <div>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                          color: w.is_below_threshold ? "var(--danger)" : "var(--text-primary)",
                        }}
                      >
                        {fmtNumber(w.balance)} {w.currency}
                      </p>
                      {w.is_below_threshold && (
                        <span className="badge badge-danger" style={{ marginTop: 4 }}>
                          Below threshold
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
                      {fmtNumber(w.minimum_balance)} {w.currency}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span className={`badge badge-${w.status === "active" ? "success" : "warning"}`}>
                        {w.status}
                      </span>
                      {w.is_locked && (
                        <span className="badge badge-danger">
                          <Icon path="M5 11h14v9H5z M12 17v-3 M7 11V7a5 5 0 0 1 10 0v4" size={12} />
                          Locked
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {w.has_active_alerts ? (
                      <span className="badge badge-danger">
                        <Icon path="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={12} />
                        Active
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--text-quaternary)" }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <a href={`/dashboard/wallets/${w.id}`} className="btn-sm btn-ghost" style={{ textDecoration: "none" }}>
                        View
                      </a>
                      <a href={`/dashboard/wallets/${w.id}/top-up`} className="btn-sm btn-primary" style={{ textDecoration: "none" }}>
                        <Icon path="M12 5v14 M19 12l-7 7-7-7" size={14} />
                        Top-up
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filteredWallets.map((w) => (
            <div key={w.id} onClick={() => router.push(`/dashboard/wallets/${w.id}`)} style={{ background: "var(--bg-secondary)", border: `1px solid ${w.is_below_threshold ? "var(--danger)" : "var(--border-primary)"}`, borderRadius: "var(--radius-lg)", padding: "16px 20px", cursor: "pointer", transition: "all var(--transition-fast)", boxShadow: "var(--shadow-xs)" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; if (!w.is_below_threshold) e.currentTarget.style.borderColor = "var(--border-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-xs)"; e.currentTarget.style.borderColor = w.is_below_threshold ? "var(--danger)" : "var(--border-primary)"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{w.contact_name || "Unknown"}</span>
                <span className={`badge badge-${w.status === "active" ? "success" : "warning"}`} style={{ fontSize: 10 }}>{w.status}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: w.is_below_threshold ? "var(--danger)" : "var(--text-primary)", marginBottom: 4 }}>{fmtNumber(w.balance)} {w.currency}</div>
              <div style={{ fontSize: 11, color: "var(--text-quaternary)" }}>Min: {fmtNumber(w.minimum_balance)} {w.currency}</div>
              {w.is_below_threshold && <span className="badge badge-danger" style={{ fontSize: 10, marginTop: 6 }}>Below threshold</span>}
            </div>
          ))}
        </div>
      )}

      {/* Results count */}
      {!loading && filteredWallets.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
          Showing {filteredWallets.length} wallet{filteredWallets.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
