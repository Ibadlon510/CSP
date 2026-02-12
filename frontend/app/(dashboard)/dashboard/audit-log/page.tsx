"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { fmtDate } from "@/lib/format";

interface AuditEntry {
  id: string;
  timestamp: string | null;
  user_id: string | null;
  user_name: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  detail: string | null;
  ip_address: string | null;
}

const ACTION_ICONS: Record<string, string> = {
  "user.login": "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3",
  "user.register": "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
  "user.forgot_password": "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  "user.reset_password": "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
};

const DEFAULT_ICON = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (actionFilter) params.set("action", actionFilter);
      if (resourceFilter) params.set("resource", resourceFilter);
      const data = await api.get(`/api/audit-logs/?${params}`);
      setEntries(data.items);
      setTotal(data.total);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  function formatAction(action: string): string {
    return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatTimestamp(ts: string | null): string {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${fmtDate(ts)} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Immutable record of all system actions</p>
        </div>
        <div className="page-header-actions">
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
            {total.toLocaleString()} entries
          </span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Filter by action (e.g. user.login)"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 260 }}
        />
        <select
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 200 }}
        >
          <option value="">All resources</option>
          <option value="user">User</option>
          <option value="contact">Contact</option>
          <option value="project">Project</option>
          <option value="task">Task</option>
          <option value="quotation">Quotation</option>
          <option value="order">Order</option>
          <option value="invoice">Invoice</option>
          <option value="wallet">Wallet</option>
          <option value="document">Document</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 60 }}>
          <div className="loading-spinner" style={{ width: 28, height: 28 }}></div>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state" style={{ textAlign: "center", padding: 60 }}>
          <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={40} />
          <p style={{ marginTop: 12, fontSize: 14, color: "var(--text-tertiary)" }}>No audit log entries found</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Timestamp</th>
                <th style={{ width: 160 }}>User</th>
                <th style={{ width: 180 }}>Action</th>
                <th style={{ width: 100 }}>Resource</th>
                <th>Detail</th>
                <th style={{ width: 110 }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--text-tertiary)" }}>
                    {formatTimestamp(e.timestamp)}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "var(--radius-sm)",
                        background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: 10, fontWeight: 600, flexShrink: 0,
                      }}>
                        {(e.user_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate" style={{ fontSize: 13, maxWidth: 120 }}>{e.user_name || "System"}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon path={ACTION_ICONS[e.action] || DEFAULT_ICON} size={14} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{formatAction(e.action)}</span>
                    </div>
                  </td>
                  <td>
                    {e.resource && (
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        {e.resource}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="truncate" style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 300, display: "block" }}>
                      {e.detail || "—"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-quaternary)" }}>
                    {e.ip_address || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 20 }}>
          <button
            className="btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Icon path="M15 19l-7-7 7-7" size={16} />
            Previous
          </button>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-ghost btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <Icon path="M9 5l7 7-7 7" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
