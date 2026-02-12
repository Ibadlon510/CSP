"use client";

import { AvatarChip } from "./AvatarChip";

/**
 * Shared AvatarStack — overlapping avatar group with "+N" overflow.
 * Used in Kanban cards, task table rows, dashboard headers.
 */
interface AvatarStackProps {
  names: string[];
  max?: number;
  size?: number;
}

export function AvatarStack({ names, max = 3, size = 24 }: AvatarStackProps) {
  const visible = names.slice(0, max);
  const overflow = names.length - max;

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {visible.map((name, i) => (
        <span key={i} style={{ marginLeft: i > 0 ? -(size * 0.25) : 0, zIndex: max - i }}>
          <AvatarChip name={name} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          style={{
            marginLeft: 4,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-tertiary)",
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
