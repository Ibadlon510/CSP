"use client";

import { Icon } from "./Icon";

/**
 * Generic page view toggle — accepts arbitrary view modes.
 * Generalized version of ViewToggle for use across all list pages.
 */

export interface PageView {
  key: string;
  label: string;
  icon: string;
}

interface PageViewToggleProps {
  value: string;
  onChange: (mode: string) => void;
  views: PageView[];
}

/* ── Common presets ── */

export const SPREADSHEET_CARD_VIEWS: PageView[] = [
  { key: "spreadsheet", label: "Spreadsheet", icon: "M3 10h18M3 14h18M3 6h18M3 18h18" },
  { key: "card", label: "Card", icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" },
];

export const SPREADSHEET_KANBAN_VIEWS: PageView[] = [
  { key: "spreadsheet", label: "Spreadsheet", icon: "M3 10h18M3 14h18M3 6h18M3 18h18" },
  { key: "kanban", label: "Kanban", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" },
];

export const TASK_VIEWS: PageView[] = [
  { key: "spreadsheet", label: "Spreadsheet", icon: "M3 10h18M3 14h18M3 6h18M3 18h18" },
  { key: "timeline", label: "Timeline", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { key: "kanban", label: "Kanban", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" },
];

export const SPREADSHEET_ONLY_VIEWS: PageView[] = [
  { key: "spreadsheet", label: "Spreadsheet", icon: "M3 10h18M3 14h18M3 6h18M3 18h18" },
];

export const STANDARD_VIEWS = TASK_VIEWS;

export const SPREADSHEET_KANBAN_CARD_VIEWS: PageView[] = [
  { key: "spreadsheet", label: "Spreadsheet", icon: "M3 10h18M3 14h18M3 6h18M3 18h18" },
  { key: "kanban", label: "Kanban", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" },
  { key: "card", label: "Card", icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" },
];

export function PageViewToggle({ value, onChange, views }: PageViewToggleProps) {
  if (views.length <= 1) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        background: "var(--bg-tertiary)",
        borderRadius: "var(--radius-md)",
        padding: 3,
        border: "1px solid var(--border-primary)",
      }}
    >
      {views.map((v) => {
        const active = value === v.key;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => onChange(v.key)}
            title={v.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              color: active ? "var(--text-primary)" : "var(--text-tertiary)",
              background: active ? "var(--bg-secondary)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            <Icon path={v.icon} size={14} />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
