"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { SearchInput } from "@/components/forms/fields";
import { EmptyState } from "@/components/ui/states";
import { PillGroup } from "@/components/ui/pill-group";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { money, count, shortDate } from "@/lib/format";

export type Cell = string | number | null | { label: string; tone: Tone } | { label: string; href: string };
export type Row = { id: string } & Record<string, Cell>;

export interface Column {
  key: string;
  header: string;
  kind?: "text" | "money" | "count" | "date" | "badge" | "link";
  align?: "left" | "right";
  /** Hide below this breakpoint to keep mobile tables readable. */
  hideBelow?: "sm" | "md" | "lg";
}

export interface FilterDef { key: string; label: string }

const hideClass = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

const plain = (c: Cell): string => (c === null ? "" : typeof c === "object" ? c.label : String(c));

function render(col: Column, c: Cell) {
  if (c === null || c === undefined) return <span className="text-ink-3">—</span>;
  switch (col.kind) {
    case "money": return money(Number(c));
    case "count": return count(Number(c));
    case "date": return shortDate(String(c));
    case "badge": return typeof c === "object" && "tone" in c ? <StatusBadge tone={c.tone} dot>{c.label}</StatusBadge> : plain(c);
    case "link": return typeof c === "object" && "href" in c ? <Link className="font-medium text-ink underline-offset-4 hover:underline" href={c.href}>{c.label}</Link> : plain(c);
    default: return plain(c);
  }
}

function toCsv(columns: Column[], rows: Row[]) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const raw = (col: Column, c: Cell) => (col.kind === "money" && typeof c === "number" ? (c / 100).toFixed(2) : plain(c));
  return [columns.map((c) => esc(c.header)).join(","), ...rows.map((r) => columns.map((c) => esc(raw(c, r[c.key] ?? null))).join(","))].join("\n");
}

/** Search + optional status filter + sortable columns + pagination + CSV export. */
export function DataTable({ columns, rows, label, filter, pageSize = 8, exportName, emptyTitle = "Nothing here yet" }: {
  columns: Column[]; rows: Row[]; label: string; filter?: FilterDef; pageSize?: number; exportName?: string; emptyTitle?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const statusOptions = useMemo(() => (filter ? Array.from(new Set(rows.map((r) => plain(r[filter.key] ?? null)))).filter(Boolean) : []), [rows, filter]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => (!q || columns.some((c) => plain(r[c.key] ?? null).toLowerCase().includes(q))) && (status === "all" || !filter || plain(r[filter.key] ?? null) === status));
    if (sort) {
      out = [...out].sort((a, b) => {
        const x = a[sort.key] ?? null, y = b[sort.key] ?? null;
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : plain(x).localeCompare(plain(y), undefined, { numeric: true });
        return cmp * sort.dir;
      });
    }
    return out;
  }, [rows, columns, query, status, filter, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = visible.slice(current * pageSize, current * pageSize + pageSize);

  const exportCsv = () => {
    const blob = new Blob([toCsv(columns, visible)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput aria-label={`Search ${label}`} placeholder="Search…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} className="w-full sm:w-60" />
        {filter && statusOptions.length > 1 && (
          <div className="max-w-full overflow-x-auto">
            <PillGroup ariaLabel={`Filter by ${filter.label}`} activeKey={status} onSelect={(k) => { setStatus(k); setPage(0); }} items={[{ key: "all", label: "All" }, ...statusOptions.map((s) => ({ key: s, label: s }))]} />
          </div>
        )}
        {exportName && (
          <Menu>
            <MenuTrigger className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-label text-ink-2 hover:bg-surface-3/70 hover:text-ink"><Download className="size-4" />Export</MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={exportCsv}>CSV ({visible.length} rows)</MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
      {slice.length === 0 ? (
        <EmptyState title={rows.length ? "No rows match your search" : emptyTitle} className="py-8" />
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-body">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"} className={cn("border-b border-line px-3 py-2 text-[11.5px] font-medium text-ink-3", c.align === "right" && "text-right", c.hideBelow && hideClass[c.hideBelow])}>
                      <button type="button" className={cn("inline-flex items-center gap-1 hover:text-ink", c.align === "right" && "flex-row-reverse")} onClick={() => setSort(active && sort!.dir === -1 ? null : { key: c.key, dir: active ? -1 : 1 })}>
                        {c.header}
                        {active ? sort!.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody key={`${current}-${status}-${sort?.key}-${sort?.dir}`} className="stagger">
              {slice.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface-2">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("border-b border-line/60 px-3 py-3 first:rounded-l-[12px] last:rounded-r-[12px]", c.align === "right" && "text-right tabular", c.hideBelow && hideClass[c.hideBelow])}>
                      {render(c, r[c.key] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-3 flex items-center justify-between text-label text-ink-3" aria-label={`${label} pagination`}>
          <span className="tabular">{current * pageSize + 1}–{Math.min(visible.length, (current + 1) * pageSize)} of {visible.length}</span>
          <div className="flex gap-1">
            <button className="grid size-8 place-items-center rounded-full hover:bg-surface-3 disabled:opacity-30" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></button>
            <button className="grid size-8 place-items-center rounded-full hover:bg-surface-3 disabled:opacity-30" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page"><ChevronRight className="size-4" /></button>
          </div>
        </nav>
      )}
    </div>
  );
}
