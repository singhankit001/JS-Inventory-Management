import type { Tone } from "@/components/ui/badge";

export type Cell = string | number | null | { label: string; tone: Tone } | { label: string; href: string };
export type Row = { id: string } & Record<string, Cell>;
/** `split` treats a cell as a list (e.g. "Admin, Finance") so a row matches when any part equals the chosen value. */
export interface FilterDef { key: string; label: string; split?: string }
export type Sort = { key: string; dir: 1 | -1 } | null;
/** Active filter values by filter key; a missing key means "all". */
export type FilterState = Record<string, string>;

export const plain = (c: Cell | undefined): string => (c === null || c === undefined ? "" : typeof c === "object" ? c.label : String(c));

const parts = (c: Cell | undefined, split?: string) => (split ? plain(c).split(split).map((s) => s.trim()) : [plain(c)]);

export function filterOptions(rows: Row[], def: FilterDef): string[] {
  return [...new Set(rows.flatMap((r) => parts(r[def.key], def.split)))].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Search (any column) AND every active filter, then sort. Input rows are never mutated. */
export function applyTable(rows: Row[], { keys, query, filters, defs, sort }: { keys: string[]; query: string; filters: FilterState; defs: FilterDef[]; sort: Sort }): Row[] {
  const q = query.trim().toLowerCase();
  const active = defs.filter((d) => filters[d.key]);
  const out = rows.filter((r) => (!q || keys.some((k) => plain(r[k]).toLowerCase().includes(q))) && active.every((d) => parts(r[d.key], d.split).includes(filters[d.key]!)));
  if (!sort) return out;
  return out.sort((a, b) => {
    const x = a[sort.key] ?? null, y = b[sort.key] ?? null;
    const cmp = typeof x === "number" && typeof y === "number" ? x - y : plain(x).localeCompare(plain(y), undefined, { numeric: true });
    return cmp * sort.dir;
  });
}

/** Clamps the page into range so a shrinking result set never shows an empty page. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(0, page), pages - 1);
  return { pages, current, slice: items.slice(current * pageSize, current * pageSize + pageSize) };
}
