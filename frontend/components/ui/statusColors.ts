/**
 * Unified status → color mapping.
 * Single source of truth for all status-to-CSS-class and status-to-pill color
 * mappings across the app. Import per-domain configs from here instead of
 * redefining STATUS_CFG in each page.
 */

/* ── Rich status config (label + color + bg) ── */

export interface StatusConfig {
  label: string;
  color: string;
  bg: string;
}

/** Contact statuses */
export const CONTACT_STATUSES = ["active", "expired", "under_renewal", "cancelled"] as const;
export const CONTACT_STATUS_CFG: Record<string, StatusConfig> = {
  active:        { label: "Active",        color: "var(--success)",        bg: "var(--success-light)" },
  expired:       { label: "Expired",       color: "var(--danger)",         bg: "var(--danger-light)" },
  under_renewal: { label: "Under Renewal", color: "#b45309",              bg: "#fffbeb" },
  cancelled:     { label: "Cancelled",     color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
};

/** Quotation statuses */
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
export const QUOTE_STATUS_CFG: Record<string, StatusConfig> = {
  draft:    { label: "Draft",    color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
  sent:     { label: "Sent",     color: "var(--info)",           bg: "var(--info-light)" },
  accepted: { label: "Accepted", color: "var(--success)",        bg: "var(--success-light)" },
  rejected: { label: "Rejected", color: "var(--danger)",         bg: "var(--danger-light)" },
  expired:  { label: "Expired",  color: "#b45309",              bg: "#fffbeb" },
};

/** Sales order statuses */
export const ORDER_STATUSES = ["pending", "confirmed", "in_progress", "delivered", "cancelled"] as const;
export const ORDER_STATUS_CFG: Record<string, StatusConfig> = {
  pending:     { label: "Pending",     color: "var(--info)",           bg: "var(--info-light)" },
  confirmed:   { label: "Confirmed",   color: "#7c3aed",              bg: "#f5f3ff" },
  in_progress: { label: "In Progress", color: "#b45309",              bg: "#fffbeb" },
  delivered:   { label: "Delivered",    color: "var(--success)",        bg: "var(--success-light)" },
  cancelled:   { label: "Cancelled",   color: "var(--danger)",         bg: "var(--danger-light)" },
};

/** Invoice statuses */
export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
export const INVOICE_STATUS_CFG: Record<string, StatusConfig> = {
  draft:     { label: "Draft",     color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
  sent:      { label: "Sent",      color: "var(--info)",           bg: "var(--info-light)" },
  paid:      { label: "Paid",      color: "var(--success)",        bg: "var(--success-light)" },
  overdue:   { label: "Overdue",   color: "#b45309",              bg: "#fffbeb" },
  cancelled: { label: "Cancelled", color: "var(--danger)",         bg: "var(--danger-light)" },
};

/** Project statuses */
export const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "completed", "cancelled"] as const;
export const PROJECT_STATUS_CFG: Record<string, StatusConfig> = {
  planning:    { label: "Planning",     color: "var(--info)",           bg: "var(--info-light)" },
  in_progress: { label: "In Progress",  color: "#7c3aed",              bg: "#f5f3ff" },
  on_hold:     { label: "On Hold",      color: "#b45309",              bg: "#fffbeb" },
  completed:   { label: "Completed",    color: "var(--success)",        bg: "var(--success-light)" },
  cancelled:   { label: "Cancelled",    color: "var(--danger)",         bg: "var(--danger-light)" },
};

/** Task statuses */
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "review", "done"] as const;
export const TASK_STATUS_CFG: Record<string, StatusConfig> = {
  todo:        { label: "To Do",       color: "var(--info)",           bg: "var(--info-light)" },
  in_progress: { label: "In Progress", color: "#7c3aed",              bg: "#f5f3ff" },
  blocked:     { label: "Blocked",     color: "var(--danger)",         bg: "var(--danger-light)" },
  review:      { label: "In Review",   color: "#b45309",              bg: "#fffbeb" },
  done:        { label: "Done",        color: "var(--success)",        bg: "var(--success-light)" },
};

/** Product statuses */
export const PRODUCT_STATUSES = ["active", "inactive"] as const;
export const PRODUCT_STATUS_CFG: Record<string, StatusConfig> = {
  active:   { label: "Active",   color: "var(--success)",        bg: "var(--success-light)" },
  inactive: { label: "Inactive", color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
};

/* ── Badge class helpers (legacy — still useful for quick badge rendering) ── */

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
