/**
 * Client-side CSV export utility.
 * Converts an array of objects to CSV and triggers a download.
 */

interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
}

export function exportToCsv(
  filename: string,
  data: Record<string, any>[],
  columns: ExportColumn[],
) {
  if (!data.length) return;

  const header = columns.map((c) => `"${c.label}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const raw = row[col.key];
        const val = col.format ? col.format(raw, row) : (raw ?? "");
        // Escape double quotes in CSV values
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
