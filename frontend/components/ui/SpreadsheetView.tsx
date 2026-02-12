"use client";

import { Pill } from "./Pill";
import { Icon } from "./Icon";

/* ─── Types ─── */

export interface SpreadsheetColumn<T = any> {
  key: string;
  label: string;
  width?: number | string;
  align?: "left" | "center" | "right";
  render?: (item: T) => React.ReactNode;
  renderHeader?: () => React.ReactNode;
}

export interface SpreadsheetGroup<T = any> {
  key: string;
  label: string;
  color: string;
  bg: string;
  items: T[];
}

interface SpreadsheetViewProps<T extends { id: string }> {
  columns: SpreadsheetColumn<T>[];
  groups: SpreadsheetGroup<T>[];
  onRowClick?: (item: T) => void;
  emptyIcon?: string;
  emptyLabel?: string;
  emptyDescription?: string;
}

/* ─── SpreadsheetView ─── */

export function SpreadsheetView<T extends { id: string }>({
  columns,
  groups,
  onRowClick,
  emptyIcon = "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  emptyLabel = "No items yet",
  emptyDescription = "No data to display",
}: SpreadsheetViewProps<T>) {
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (totalItems === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 0",
          color: "var(--text-quaternary)",
          border: "2px dashed var(--border-primary)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-tertiary)",
        }}
      >
        <Icon path={emptyIcon} size={36} color="var(--border-primary)" />
        <div style={{ marginTop: 12, fontSize: 14, fontWeight: 500 }}>{emptyLabel}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{emptyDescription}</div>
      </div>
    );
  }

  // If there's only one group or all groups have the same key, render flat
  const showGroupHeaders = groups.length > 1 || (groups.length === 1 && groups[0].items.length > 0);

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {groups.map((group) => {
        if (group.items.length === 0) return null;
        return (
          <div key={group.key}>
            {/* Group header */}
            {showGroupHeaders && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  background: "var(--bg-tertiary)",
                  borderBottom: "1px solid var(--border-primary)",
                }}
              >
                <Pill label={group.label} color={group.color} bg={group.bg} size="md" />
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)" }}>
                  {group.items.length}
                </span>
              </div>
            )}

            {/* Table */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: "8px 16px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-quaternary)",
                        textAlign: (col.align || "left") as any,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        width: col.width,
                      }}
                    >
                      {col.renderHeader ? col.renderHeader() : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onRowClick?.(item)}
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(item); } } : undefined}
                    style={{
                      cursor: onRowClick ? "pointer" : "default",
                      borderBottom: "1px solid var(--border-secondary)",
                      transition: "background var(--transition-fast)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-tertiary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          textAlign: (col.align || "left") as any,
                        }}
                      >
                        {col.render
                          ? col.render(item)
                          : (item as any)[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
