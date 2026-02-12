"use client";

/**
 * Shared Pill — colored status/priority badge.
 * Used across TasksTab, Kanban cards, task detail pages.
 */
interface PillProps {
  label: string;
  color: string;
  bg: string;
  size?: "sm" | "md";
}

export function Pill({ label, color, bg, size = "sm" }: PillProps) {
  return (
    <span
      style={{
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 600,
        padding: size === "sm" ? "2px 8px" : "3px 10px",
        borderRadius: "var(--radius-full)",
        color,
        background: bg,
        whiteSpace: "nowrap",
        textTransform: "capitalize",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}
