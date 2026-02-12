"use client";

import { Icon } from "./Icon";

/**
 * Shared MetaRow — key-value info display with two variants.
 * Variant A: Sidebar info row (icon box + label + value)
 * Variant B: Detail card meta (stacked label + value)
 */
interface MetaRowProps {
  label: string;
  value: React.ReactNode;
  icon?: string;
  variant?: "sidebar" | "detail";
  copyable?: boolean;
  onCopy?: () => void;
}

export function MetaRow({ label, value, icon, variant = "detail", copyable, onCopy }: MetaRowProps) {
  if (variant === "sidebar") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
        {icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-tertiary)",
              color: "var(--text-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon path={icon} size={14} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-quaternary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value || "—"}
          </div>
        </div>
        {copyable && onCopy && (
          <button
            className="btn-ghost"
            style={{ padding: 4, flexShrink: 0 }}
            onClick={onCopy}
            aria-label={`Copy ${label}`}
          >
            <Icon path="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" size={12} />
          </button>
        )}
      </div>
    );
  }

  // Variant B: detail card meta
  return (
    <div>
      <div className="meta-label">{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
        {value || "—"}
      </div>
    </div>
  );
}
