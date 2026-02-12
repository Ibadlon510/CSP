"use client";

/**
 * Shared AvatarChip — user initial circle with optional name label.
 * Used in task cards, assignee lists, comment threads.
 */
interface AvatarChipProps {
  name: string;
  size?: number;
  showName?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  color?: string;
}

const GRADIENT_PAIRS = [
  ["var(--accent-blue-light)", "var(--accent-purple-light)", "var(--accent-blue)"],
  ["var(--accent-purple-light)", "var(--accent-pink-light)", "var(--accent-purple)"],
  ["var(--accent-teal-light)", "var(--accent-blue-light)", "var(--accent-teal)"],
  ["var(--accent-amber-light)", "var(--accent-pink-light)", "var(--accent-amber)"],
];

function getGradient(name: string) {
  const idx = Math.abs(name.charCodeAt(0) || 0) % GRADIENT_PAIRS.length;
  return GRADIENT_PAIRS[idx];
}

export function AvatarChip({ name, size = 26, showName = false, removable = false, onRemove }: AvatarChipProps) {
  const [bg1, bg2, textColor] = getGradient(name);
  const initial = (name || "?").charAt(0).toUpperCase();

  if (showName) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 12px 4px 4px",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-full)",
          border: "1px solid var(--border-secondary)",
        }}
      >
        <span
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            flexShrink: 0,
            background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(size * 0.42),
            fontWeight: 700,
            color: textColor,
          }}
        >
          {initial}
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{name}</span>
        {removable && onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              marginLeft: 2,
              color: "var(--text-quaternary)",
              display: "flex",
              alignItems: "center",
              fontSize: 12,
              lineHeight: 1,
            }}
            aria-label={`Remove ${name}`}
          >
            ×
          </button>
        )}
      </span>
    );
  }

  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        color: textColor,
        border: "2px solid var(--bg-secondary)",
      }}
    >
      {initial}
    </span>
  );
}
