/**
 * Unified data formatting utilities for the CSP-ERP platform.
 * All currency, date, number, and percentage display should use these functions.
 */

/**
 * Format a currency value with locale-aware thousands separators.
 * @example fmtCurrency(1234.5) → "1,234.50 AED"
 * @example fmtCurrency(null) → "—"
 */
export function fmtCurrency(value: number | string | null | undefined, currency = "AED"): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return `${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Format a number value (no currency suffix).
 * @example fmtNumber(1234.5) → "1,234.50"
 * @example fmtNumber(1234.5, 0) → "1,235"
 */
export function fmtNumber(value: number | string | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-AE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Format a date string as "12 Feb 2026".
 * @example fmtDate("2026-02-12") → "12 Feb 2026"
 * @example fmtDate(null) → "—"
 */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Format a date as a relative string ("3 days ago", "in 45 days", "Today").
 */
export function fmtDateRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

/**
 * Format a datetime string as "12 Feb 2026, 14:30".
 * @example fmtDateTime("2026-02-12T14:30:00Z") → "12 Feb 2026, 14:30"
 * @example fmtDateTime(null) → "—"
 */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Format a percentage value.
 * @example fmtPercent(75) → "75%"
 * @example fmtPercent(12.5) → "12.5%"
 */
export function fmtPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}
