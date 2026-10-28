export interface CsvColumn { key: string; header: string; kind?: "text" | "money" | "count" }
export type CsvRow = Record<string, string | number | null | undefined>;

const esc = (s: string) => {
  // Spreadsheets execute cells starting with = + - @ (CSV injection); a leading apostrophe keeps them as text.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** RFC 4180 CSV. Money columns are paise in the data and rupees with two decimals in the file. */
export function buildCsv(columns: CsvColumn[], rows: CsvRow[]): string {
  const cell = (c: CsvColumn, v: CsvRow[string]) => (v === null || v === undefined ? "" : c.kind === "money" && typeof v === "number" ? (v / 100).toFixed(2) : String(v));
  return [columns.map((c) => esc(c.header)).join(","), ...rows.map((r) => columns.map((c) => esc(cell(c, r[c.key]))).join(","))].join("\r\n");
}
