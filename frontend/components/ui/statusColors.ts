/**
 * Unified status → badge color mapping.
 * Single source of truth for all status-to-CSS-class mappings across the app.
 */

const STATUS_MAP: Record<string, string> = {
  // Neutral
  draft: "neutral",
  pending: "neutral",
  not_started: "neutral",
  planning: "neutral",
  new: "neutral",

  // Accent (blue/info)
  sent: "accent",
  confirmed: "accent",
  in_progress: "accent",
  active: "accent",
  entry_permit_applied: "accent",
  contacted: "accent",
  open: "accent",

  // Success (green)
  accepted: "success",
  paid: "success",
  completed: "success",
  delivered: "success",
  verified: "success",
  visa_stamped: "success",
  won: "success",
  qualified: "success",

  // Warning (amber)
  on_hold: "warning",
  expired: "warning",
  overdue: "warning",
  pending_approval: "warning",
  medical_done: "warning",
  partially_paid: "warning",

  // Danger (red)
  rejected: "danger",
  cancelled: "danger",
  lost: "danger",
  failed: "danger",
};

/**
 * Returns the badge CSS class suffix for a given status string.
 * @example getStatusBadgeClass("completed") → "success"
 * @example getStatusBadgeClass("unknown_status") → "neutral"
 */
export function getStatusBadgeClass(status: string | null | undefined): string {
  if (!status) return "neutral";
  return STATUS_MAP[status.toLowerCase()] || "neutral";
}

/**
 * Returns the full badge className string for a status.
 * @example getStatusBadge("completed") → "badge badge-success"
 */
export function getStatusBadge(status: string | null | undefined): string {
  return `badge badge-${getStatusBadgeClass(status)}`;
}
