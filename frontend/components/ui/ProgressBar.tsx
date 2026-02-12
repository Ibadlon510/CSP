"use client";

/**
 * Shared ProgressBar — thin colored progress indicator with optional label.
 * Used in Kanban cards, task tables, and detail pages.
 */
interface ProgressBarProps {
  value: number;
  height?: number;
  showLabel?: boolean;
  color?: string;
}

export function ProgressBar({ value, height = 4, showLabel = false, color }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const barColor = color || (pct >= 100 ? "var(--success)" : pct > 50 ? "var(--accent-blue)" : "var(--accent-amber)");

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span
        style={{
          flex: 1,
          height,
          background: "var(--bg-tertiary)",
          borderRadius: height / 2,
          overflow: "hidden",
          minWidth: 36,
        }}
      >
        <span
          style={{
            display: "block",
            width: `${pct}%`,
            height: "100%",
            background: barColor,
            borderRadius: height / 2,
            transition: "width 0.3s ease",
          }}
        />
      </span>
      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
          {pct}%
        </span>
      )}
    </span>
  );
}
