"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "./Icon";
import { api } from "@/lib/api";

/**
 * Reusable SearchFilterBar — search, multi-field filter, grouping, saved presets.
 * Designed to be placed in any list page header beside a view toggle.
 */

/* ── Types ── */

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterFieldConfig {
  key: string;
  label: string;
  options: FilterFieldOption[];
}

export interface SavedSearchItem {
  id: string;
  user_id: string;
  name: string;
  page: string;
  criteria: { search?: string; filters?: Record<string, string[]>; groupBy?: string };
  is_default: boolean;
  is_shared: boolean;
  sort_order: number;
  is_owned: boolean;
  created_by_name?: string | null;
}

export interface SearchFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filters: Record<string, string[]>;
  onFiltersChange: (f: Record<string, string[]>) => void;
  filterConfig: FilterFieldConfig[];
  groupBy?: string;
  onGroupByChange?: (field: string) => void;
  groupOptions?: { value: string; label: string }[];
  pageKey: string;
  placeholder?: string;
}

/* ── Helpers ── */

const CACHE_PREFIX = "saved-searches-";

function cacheGet(pageKey: string): SavedSearchItem[] {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + pageKey);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function cacheSet(pageKey: string, items: SavedSearchItem[]) {
  try { localStorage.setItem(CACHE_PREFIX + pageKey, JSON.stringify(items)); } catch {}
}

/* ── Popover wrapper ── */

function Popover({ anchor, open, onClose, children, width = 280 }: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchor.current && !anchor.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, anchor]);

  if (!open) return null;

  return (
    <div ref={ref} style={{
      position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
      width, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
      borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)",
      padding: "12px 14px", maxHeight: 400, overflowY: "auto",
    }}>
      {children}
    </div>
  );
}

/* ── Active filter pill ── */

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, color: "var(--accent-blue)", background: "var(--accent-blue-light)",
      padding: "2px 8px 2px 10px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap",
    }}>
      {label}
      <button onClick={onRemove} style={{
        background: "none", border: "none", cursor: "pointer", padding: 0,
        color: "var(--accent-blue)", display: "flex", alignItems: "center",
      }}>
        <Icon path="M18 6L6 18M6 6l12 12" size={10} />
      </button>
    </span>
  );
}

/* ── Inline icon button (sits inside search box) ── */

function InlineIconBtn({ icon, label, active, onClick, btnRef }: {
  icon: string; label: string; active?: boolean;
  onClick: (e: React.MouseEvent) => void; btnRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={btnRef}
      type="button"
      title={label}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: "var(--radius-sm)",
        border: "none",
        background: active ? "var(--accent-blue-light)" : "transparent",
        color: active ? "var(--accent-blue)" : "var(--text-quaternary)",
        cursor: "pointer", transition: "all var(--transition-fast)", flexShrink: 0,
        position: "relative",
      }}
    >
      <Icon path={icon} size={14} />
      {active && (
        <span style={{
          position: "absolute", top: 1, right: 1, width: 6, height: 6,
          borderRadius: "50%", background: "var(--accent-blue)",
        }} />
      )}
    </button>
  );
}

/* ── Main component ── */

export function SearchFilterBar({
  search, onSearchChange,
  filters, onFiltersChange,
  filterConfig,
  groupBy, onGroupByChange,
  groupOptions,
  pageKey,
  placeholder = "Search...",
}: SearchFilterBarProps) {
  /* Popover state */
  const [filterOpen, setFilterOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newShared, setNewShared] = useState(false);

  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const groupBtnRef = useRef<HTMLButtonElement>(null);
  const savedBtnRef = useRef<HTMLButtonElement>(null);

  /* Saved searches */
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>(() => cacheGet(pageKey));

  const loadSaved = useCallback(async () => {
    try {
      const data = await api.get(`/api/saved-searches/?page=${encodeURIComponent(pageKey)}`) as SavedSearchItem[];
      setSavedSearches(data);
      cacheSet(pageKey, data);
    } catch {}
  }, [pageKey]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  /* Check for default on mount */
  useEffect(() => {
    const def = savedSearches.find((s) => s.is_default && s.is_owned);
    if (def && def.criteria) {
      if (def.criteria.search) onSearchChange(def.criteria.search);
      if (def.criteria.filters) onFiltersChange(def.criteria.filters);
      if (def.criteria.groupBy && onGroupByChange) onGroupByChange(def.criteria.groupBy);
    }
    // Only run on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Filter helpers */
  const hasActiveFilters = Object.values(filters).some((arr) => arr.length > 0);
  const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

  function toggleFilter(key: string, value: string) {
    const current = filters[key] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: next });
  }

  function removeFilter(key: string, value: string) {
    const current = filters[key] || [];
    onFiltersChange({ ...filters, [key]: current.filter((v) => v !== value) });
  }

  function clearAllFilters() {
    const empty: Record<string, string[]> = {};
    filterConfig.forEach((f) => { empty[f.key] = []; });
    onFiltersChange(empty);
  }

  /* Saved search actions */
  async function handleSave() {
    if (!newName.trim()) return;
    try {
      await api.post("/api/saved-searches/", {
        name: newName.trim(),
        page: pageKey,
        criteria: { search, filters, groupBy: groupBy || "" },
        is_shared: newShared,
      });
      setNewName("");
      setNewShared(false);
      setSavingNew(false);
      loadSaved();
    } catch {}
  }

  function applySaved(item: SavedSearchItem) {
    if (item.criteria.search !== undefined) onSearchChange(item.criteria.search);
    if (item.criteria.filters) onFiltersChange(item.criteria.filters);
    if (item.criteria.groupBy !== undefined && onGroupByChange) onGroupByChange(item.criteria.groupBy);
    setSavedOpen(false);
  }

  async function toggleDefault(item: SavedSearchItem) {
    try {
      await api.patch(`/api/saved-searches/${item.id}`, { is_default: !item.is_default });
      loadSaved();
    } catch {}
  }

  async function toggleShared(item: SavedSearchItem) {
    try {
      await api.patch(`/api/saved-searches/${item.id}`, { is_shared: !item.is_shared });
      loadSaved();
    } catch {}
  }

  async function deleteSaved(item: SavedSearchItem) {
    try {
      await api.delete(`/api/saved-searches/${item.id}`);
      loadSaved();
    } catch {}
  }

  const ownSearches = savedSearches.filter((s) => s.is_owned);
  const sharedSearches = savedSearches.filter((s) => !s.is_owned);

  /* ── Build active filter labels ── */
  const activePills: { key: string; value: string; label: string }[] = [];
  for (const fc of filterConfig) {
    for (const v of filters[fc.key] || []) {
      const opt = fc.options.find((o) => o.value === v);
      activePills.push({ key: fc.key, value: v, label: `${fc.label}: ${opt?.label || v}` });
    }
  }

  const hasFilter = filterConfig.length > 0;
  const hasGroup = !!(groupOptions && groupOptions.length > 0 && onGroupByChange);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* ── Search + action buttons row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Search input */}
        <div style={{
          position: "relative", display: "flex", alignItems: "center",
          width: 260, maxWidth: "100%",
          height: 34, borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-primary)", background: "var(--bg-secondary)",
          transition: "border-color var(--transition-fast)",
        }}>
          <span style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-quaternary)", pointerEvents: "none", display: "flex",
          }}>
            <Icon path="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" size={14} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1, height: "100%", paddingLeft: 32, paddingRight: 10,
              fontSize: 12, background: "transparent",
              border: "none", color: "var(--text-primary)", outline: "none",
            }}
          />
        </div>

        {/* Action buttons */}
        {hasFilter && (
          <div style={{ position: "relative" }}>
            <button
              ref={filterBtnRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilterOpen(!filterOpen); setGroupOpen(false); setSavedOpen(false); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 34, padding: "0 12px",
                fontSize: 12, fontWeight: 600,
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                background: hasActiveFilters ? "var(--accent-blue-light)" : "var(--bg-secondary)",
                color: hasActiveFilters ? "var(--accent-blue)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all var(--transition-fast)",
                whiteSpace: "nowrap",
              }}
            >
              <Icon path="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" size={14} />
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
        )}
        {hasGroup && (
          <div style={{ position: "relative" }}>
            <button
              ref={groupBtnRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setGroupOpen(!groupOpen); setFilterOpen(false); setSavedOpen(false); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 34, padding: "0 12px",
                fontSize: 12, fontWeight: 600,
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                background: (groupBy && groupBy !== "") ? "var(--accent-blue-light)" : "var(--bg-secondary)",
                color: (groupBy && groupBy !== "") ? "var(--accent-blue)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all var(--transition-fast)",
                whiteSpace: "nowrap",
              }}
            >
              <Icon path="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" size={14} />
              Group{groupBy ? ": " + (groupOptions!.find((g) => g.value === groupBy)?.label || groupBy) : ""}
            </button>
          </div>
        )}
        <div style={{ position: "relative" }}>
          <button
            ref={savedBtnRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); setSavedOpen(!savedOpen); setFilterOpen(false); setGroupOpen(false); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 34, padding: "0 12px",
              fontSize: 12, fontWeight: 600,
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              background: savedOpen ? "var(--accent-blue-light)" : "var(--bg-secondary)",
              color: savedOpen ? "var(--accent-blue)" : "var(--text-secondary)",
              cursor: "pointer", transition: "all var(--transition-fast)",
              whiteSpace: "nowrap",
            }}
          >
            <Icon path="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" size={14} />
            Saved
          </button>
        </div>
      </div>

      {/* ── Popovers ── */}
      <div style={{ position: "relative" }}>

        {/* Filter popover */}
        {hasFilter && (
          <Popover anchor={filterBtnRef} open={filterOpen} onClose={() => setFilterOpen(false)} width={300}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Filters</span>
              {hasActiveFilters && (
                <button onClick={clearAllFilters} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, color: "var(--accent-blue)",
                }}>Clear all</button>
              )}
            </div>
            {filterConfig.map((fc) => (
              <div key={fc.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {fc.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {fc.options.map((opt) => {
                    const checked = (filters[fc.key] || []).includes(opt.value);
                    return (
                      <label key={opt.value} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "4px 6px",
                        borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: 12,
                        color: "var(--text-secondary)", background: checked ? "var(--accent-blue-light)" : "transparent",
                        transition: "background var(--transition-fast)",
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFilter(fc.key, opt.value)}
                          style={{ width: 14, height: 14, cursor: "pointer" }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </Popover>
        )}

        {/* Group popover */}
        {hasGroup && (
          <Popover anchor={groupBtnRef} open={groupOpen} onClose={() => setGroupOpen(false)} width={200}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Group by</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <label style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 6px",
                borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: 12,
                color: "var(--text-secondary)",
                background: !groupBy || groupBy === "" ? "var(--accent-blue-light)" : "transparent",
              }}>
                <input type="radio" name="groupBy" checked={!groupBy || groupBy === ""} onChange={() => onGroupByChange!("")} style={{ cursor: "pointer" }} />
                None
              </label>
              {groupOptions!.map((g) => (
                <label key={g.value} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 6px",
                  borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: 12,
                  color: "var(--text-secondary)",
                  background: groupBy === g.value ? "var(--accent-blue-light)" : "transparent",
                }}>
                  <input type="radio" name="groupBy" checked={groupBy === g.value} onChange={() => onGroupByChange!(g.value)} style={{ cursor: "pointer" }} />
                  {g.label}
                </label>
              ))}
            </div>
          </Popover>
        )}

        {/* Saved searches popover */}
        <Popover anchor={savedBtnRef} open={savedOpen} onClose={() => setSavedOpen(false)} width={320}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Saved Searches</div>

          {/* Save current */}
          {!savingNew ? (
            <button onClick={() => setSavingNew(true)} style={{
              width: "100%", padding: "8px 10px", border: "1px dashed var(--border-primary)",
              borderRadius: "var(--radius-md)", background: "transparent", cursor: "pointer",
              fontSize: 12, fontWeight: 600, color: "var(--accent-blue)",
              display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
            }}>
              <Icon path="M12 4v16m8-8H4" size={12} /> Save current search
            </button>
          ) : (
            <div style={{ marginBottom: 12, padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)" }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Preset name..."
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setSavingNew(false); setNewName(""); } }}
                style={{
                  width: "100%", fontSize: 12, padding: "6px 8px", marginBottom: 8,
                  border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)",
                  background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none",
                }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={newShared} onChange={(e) => setNewShared(e.target.checked)} style={{ cursor: "pointer" }} />
                Share with team
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleSave} style={{
                  flex: 1, padding: "5px 10px", fontSize: 11, fontWeight: 600,
                  background: "var(--brand-primary)", color: "var(--text-inverse)",
                  border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
                }}>Save</button>
                <button onClick={() => { setSavingNew(false); setNewName(""); }} style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 600,
                  background: "var(--bg-secondary)", color: "var(--text-secondary)",
                  border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", cursor: "pointer",
                }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Own searches */}
          {ownSearches.length > 0 && (
            <div style={{ marginBottom: sharedSearches.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>My Searches</div>
              {ownSearches.map((s) => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                  transition: "background var(--transition-fast)",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span onClick={() => applySaved(s)} style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </span>
                  {s.is_default && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-blue)", background: "var(--accent-blue-light)", padding: "1px 5px", borderRadius: "var(--radius-full)" }}>DEFAULT</span>}
                  {s.is_shared && <span style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", padding: "1px 5px", borderRadius: "var(--radius-full)" }}>SHARED</span>}
                  <button onClick={() => toggleDefault(s)} title={s.is_default ? "Unset default" : "Set as default"} style={{
                    background: "none", border: "none", cursor: "pointer", padding: 2,
                    color: s.is_default ? "var(--accent-blue)" : "var(--text-quaternary)", display: "flex",
                  }}>
                    <Icon path={s.is_default ? "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" : "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"} size={12} />
                  </button>
                  <button onClick={() => toggleShared(s)} title={s.is_shared ? "Unshare" : "Share with team"} style={{
                    background: "none", border: "none", cursor: "pointer", padding: 2,
                    color: s.is_shared ? "#7c3aed" : "var(--text-quaternary)", display: "flex",
                  }}>
                    <Icon path="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" size={12} />
                  </button>
                  <button onClick={() => deleteSaved(s)} title="Delete" style={{
                    background: "none", border: "none", cursor: "pointer", padding: 2,
                    color: "var(--text-quaternary)", display: "flex",
                  }}>
                    <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Shared searches */}
          {sharedSearches.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Shared with team</div>
              {sharedSearches.map((s) => (
                <div key={s.id} onClick={() => applySaved(s)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                  transition: "background var(--transition-fast)",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-quaternary)", whiteSpace: "nowrap" }}>
                    by {s.created_by_name || "Unknown"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {ownSearches.length === 0 && sharedSearches.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-quaternary)", textAlign: "center", padding: "12px 0" }}>
              No saved searches yet
            </p>
          )}
        </Popover>
      </div>

      {/* ── Active filter pills ── */}
      {activePills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {activePills.map((p, i) => (
            <FilterPill key={`${p.key}-${p.value}-${i}`} label={p.label} onRemove={() => removeFilter(p.key, p.value)} />
          ))}
          <button onClick={clearAllFilters} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", padding: "2px 6px",
          }}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
