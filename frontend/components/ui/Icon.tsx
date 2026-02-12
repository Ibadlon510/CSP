/**
 * Shared Icon component — Feather Icons via inline SVG.
 * Replaces 32+ local copies across the codebase.
 */
export function Icon({ path, size = 20, color }: { path: string; size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
