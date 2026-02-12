"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fmtCurrency } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { SearchFilterBar, type FilterFieldConfig } from "@/components/ui/SearchFilterBar";
import { PageViewToggle, SPREADSHEET_KANBAN_CARD_VIEWS } from "@/components/ui/PageViewToggle";
import { SpreadsheetView } from "@/components/ui/SpreadsheetView";
import { KanbanView, type KanbanColumnConfig, type GenericCardData } from "@/components/ui/KanbanView";
import { Pill } from "@/components/ui/Pill";

interface ProductTaskTemplate {
  id: string;
  task_name: string;
  sort_order: number;
  subtask_names: string[] | null;
}

interface ProductDocReq {
  id: string;
  document_name: string;
}

interface Product {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_unit_price: number | null;
  is_active: boolean;
  creates_project: boolean;
  task_templates: ProductTaskTemplate[];
  document_requirements?: ProductDocReq[];
}

const PRODUCT_STATUSES = ["active", "inactive"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "var(--success)", bg: "var(--success-light)" },
  inactive: { label: "Inactive", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
};

const KANBAN_COLUMNS: KanbanColumnConfig[] = PRODUCT_STATUSES.map((s) => ({
  id: s, label: STATUS_CFG[s].label, color: STATUS_CFG[s].color, bg: STATUS_CFG[s].bg,
}));

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ is_active: [], creates_project: [] });
  const [groupBy, setGroupBy] = useState("");
  const [viewMode, setViewMode] = useState("spreadsheet");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get("/api/products");
      setProducts((data as Product[]) || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  const productFilterConfig: FilterFieldConfig[] = [
    { key: "is_active", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    { key: "creates_project", label: "Creates Project", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
  ];
  const productGroupOptions = [{ value: "is_active", label: "Status" }];

  const filtered = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    if (filters.is_active?.includes("active")) list = list.filter((p) => p.is_active);
    if (filters.is_active?.includes("inactive")) list = list.filter((p) => !p.is_active);
    if (filters.creates_project?.includes("yes")) list = list.filter((p) => p.creates_project);
    if (filters.creates_project?.includes("no")) list = list.filter((p) => !p.creates_project);
    return list;
  }, [products, search, filters]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    withProject: products.filter((p) => p.creates_project).length,
  }), [products]);

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-content">
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage products and services, task templates, and document requirements.</p>
        </div>
        <div className="page-header-actions">
          <Link href="/dashboard/products/new" className="btn-primary">
            <Icon path="M12 4v16m8-8H4" size={16} />
            New Product
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      {!loading && products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
          <div className="stat-card" style={{ padding: 16 }}>
            <div className="stat-label">Total Products</div>
            <div className="stat-value" style={{ fontSize: 24, margin: "4px 0" }}>{stats.total}</div>
          </div>
          <div className="stat-card" style={{ padding: 16 }}>
            <div className="stat-label">Active</div>
            <div className="stat-value" style={{ fontSize: 24, margin: "4px 0", color: "var(--success)" }}>{stats.active}</div>
          </div>
          <div className="stat-card" style={{ padding: 16 }}>
            <div className="stat-label">Creates Project</div>
            <div className="stat-value" style={{ fontSize: 24, margin: "4px 0", color: "var(--accent-teal)" }}>{stats.withProject}</div>
          </div>
        </div>
      )}

      {/* Search / Filter / View bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <SearchFilterBar search={search} onSearchChange={setSearch} filters={filters} onFiltersChange={setFilters} filterConfig={productFilterConfig} groupBy={groupBy} onGroupByChange={setGroupBy} groupOptions={productGroupOptions} pageKey="products" placeholder="Search products..." />
        <PageViewToggle value={viewMode} onChange={setViewMode} views={SPREADSHEET_KANBAN_CARD_VIEWS} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }} />
          <p style={{ marginTop: 16, color: "var(--text-tertiary)" }}>Loading products...</p>
        </div>
      )}

      {/* Spreadsheet View */}
      {!loading && viewMode === "spreadsheet" && (
        <SpreadsheetView<Product>
          columns={[
            { key: "name", label: "Product", render: (p) => (
              <div>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span>
                {p.description && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, maxWidth: 400 }} className="truncate">{p.description}</div>}
              </div>
            ) },
            { key: "code", label: "Code", width: 80, render: (p) => p.code ? <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>{p.code}</span> : <span style={{ color: "var(--text-quaternary)" }}>\u2014</span> },
            { key: "default_unit_price", label: "Default Price", width: 140, render: (p) => p.default_unit_price != null ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(p.default_unit_price)}</span> : <span style={{ color: "var(--text-quaternary)" }}>\u2014</span> },
            { key: "creates_project", label: "Project", width: 100, render: (p) => p.creates_project ? <span className="badge badge-success badge-dot">Yes</span> : <span style={{ color: "var(--text-quaternary)" }}>\u2014</span> },
            { key: "tasks", label: "Tasks", width: 70, render: (p) => <span style={{ fontWeight: (p.task_templates?.length ?? 0) > 0 ? 600 : 400, fontSize: 13, color: (p.task_templates?.length ?? 0) > 0 ? "var(--text-primary)" : "var(--text-quaternary)" }}>{p.task_templates?.length ?? 0}</span> },
            { key: "docs", label: "Docs", width: 60, render: (p) => <span style={{ fontWeight: (p.document_requirements?.length ?? 0) > 0 ? 600 : 400, fontSize: 13, color: (p.document_requirements?.length ?? 0) > 0 ? "var(--text-primary)" : "var(--text-quaternary)" }}>{p.document_requirements?.length ?? 0}</span> },
            { key: "status", label: "Status", width: 90, render: (p) => { const sc = p.is_active ? STATUS_CFG.active : STATUS_CFG.inactive; return <Pill label={sc.label} color={sc.color} bg={sc.bg} />; } },
          ]}
          groups={PRODUCT_STATUSES.map((s) => {
            const sc = STATUS_CFG[s];
            return { key: s, label: sc.label, color: sc.color, bg: sc.bg, items: filtered.filter((p) => (s === "active" ? p.is_active : !p.is_active)) };
          }).filter((g) => g.items.length > 0)}
          onRowClick={(p) => router.push(`/dashboard/products/${p.id}`)}
          emptyIcon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          emptyLabel="No products yet"
          emptyDescription="Create your first product or service"
        />
      )}

      {/* Kanban View */}
      {!loading && viewMode === "kanban" && (
        <KanbanView
          columns={KANBAN_COLUMNS}
          itemsByColumn={Object.fromEntries(PRODUCT_STATUSES.map((s) => [
            s,
            filtered.filter((p) => (s === "active" ? p.is_active : !p.is_active)).map((p): GenericCardData => ({
              id: p.id,
              title: p.name,
              subtitle: p.description || undefined,
              badge: p.code ? { label: p.code, color: "var(--text-secondary)", bg: "var(--bg-tertiary)" } : undefined,
              meta: [
                ...(p.default_unit_price != null ? [{ label: "Price", value: fmtCurrency(p.default_unit_price) }] : []),
                ...(p.creates_project ? [{ label: "Project", value: "Yes" }] : []),
                ...((p.task_templates?.length ?? 0) > 0 ? [{ label: "Tasks", value: String(p.task_templates.length) }] : []),
              ],
            })),
          ]))}
          onItemClick={(id) => router.push(`/dashboard/products/${id}`)}
          emptyLabel="No products"
        />
      )}

      {/* Card View */}
      {!loading && viewMode === "card" && (
        filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ opacity: 0.4, marginBottom: 16 }}><Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={48} /></div>
            <div className="empty-state-title">No matching products</div>
            <div className="empty-state-description">Try adjusting your search or filters.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {filtered.map((p) => (
              <div key={p.id} onClick={() => router.push(`/dashboard/products/${p.id}`)} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", padding: "16px 20px", cursor: "pointer", transition: "all var(--transition-fast)", boxShadow: "var(--shadow-xs)" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.borderColor = "var(--border-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-xs)"; e.currentTarget.style.borderColor = "var(--border-primary)"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>{p.name}</div>
                    {p.code && <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", background: "var(--bg-tertiary)", padding: "1px 6px", borderRadius: "var(--radius-xs)" }}>{p.code}</span>}
                  </div>
                  <span className={`badge badge-${p.is_active ? "success" : "neutral"} badge-dot`} style={{ fontSize: 11, flexShrink: 0 }}>{p.is_active ? "Active" : "Inactive"}</span>
                </div>
                {p.description && <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</p>}
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                  {p.default_unit_price != null && <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(p.default_unit_price)}</span>}
                  {p.creates_project && <span className="badge badge-success" style={{ fontSize: 10 }}>Creates Project</span>}
                  {(p.task_templates?.length ?? 0) > 0 && <span style={{ color: "var(--text-quaternary)" }}>{p.task_templates.length} tasks</span>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Results count */}
      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
          Showing {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
