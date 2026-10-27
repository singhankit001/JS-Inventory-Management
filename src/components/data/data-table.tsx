"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Download, SearchX, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/forms/fields";
import { EmptyState } from "@/components/ui/states";
import { PillGroup } from "@/components/ui/pill-group";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/menu";
import { money, count, shortDate } from "@/lib/format";
import { applyTable, filterOptions, paginate, plain, type Cell, type FilterDef, type FilterState, type Row, type Sort } from "./table-logic";

export type { Cell, FilterDef, Row } from "./table-logic";

export interface Column {
  key: string;
  header: string;
  kind?: "text" | "money" | "count" | "date" | "badge" | "link";
  align?: "left" | "right";
  /** Hide below this breakpoint to keep mobile tables readable. */
  hideBelow?: "sm" | "md" | "lg";
}

const hideClass = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };
const PILL_MAX = 5;
const ghost = "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-label text-ink-2 transition-colors hover:bg-surface-3/70 hover:text-ink [&_svg]:size-4";

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

/** Menu-based picker for filters with too many values for a segmented control. Mirrors the segmented pill's active look. */
function FilterMenu({ def, options, value, onChange }: { def: FilterDef; options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <Menu>
      <MenuTrigger aria-label={`Filter by ${def.label}: ${value ?? "all"}`} className={cn("inline-flex h-9 max-w-full items-center gap-1.5 rounded-full px-3.5 text-label transition-colors duration-200", value ? "bg-surface text-ink shadow-card ring-1 ring-line" : "bg-surface-3/80 text-ink-3 hover:text-ink")}>
        <span className="inline-block first-letter:uppercase">{def.label}</span>
        <span className="max-w-36 truncate font-medium text-ink">{value ?? "All"}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </MenuTrigger>
      <MenuContent align="start" className="max-h-[min(60vh,360px)] overflow-y-auto">
        <MenuLabel>{def.label}</MenuLabel>
        <MenuRadioGroup value={value ?? "all"} onValueChange={onChange}>
          <MenuRadioItem value="all">All</MenuRadioItem>
          {options.map((o) => <MenuRadioItem key={o} value={o}>{o}</MenuRadioItem>)}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/**
 * Search + AND-combined filters + sortable columns + pagination + CSV export (of the filtered, sorted rows).
 * Search and filters live in the URL (`?q=…&f_<key>=…`) so a filtered view survives reload and can be shared.
 * shortcut: one table per page owns q/f_* params; add a prefix prop if a page ever shows two tables.
 */
export function DataTable({ columns, rows, label, filter, filters, pageSize = 8, exportName, emptyTitle = "Nothing here yet", emptyBody }: {
  columns: Column[]; rows: Row[]; label: string;
  /** @deprecated single filter; prefer `filters`. Still supported. */
  filter?: FilterDef; filters?: FilterDef[];
  pageSize?: number; exportName?: string; emptyTitle?: string; emptyBody?: string;
}) {
  const params = useSearchParams();
  const defs = useMemo(() => [...(filter ? [filter] : []), ...(filters ?? [])], [filter, filters]);
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [active, setActive] = useState<FilterState>(() => Object.fromEntries(defs.flatMap((d) => { const v = params.get(`f_${d.key}`); return v ? [[d.key, v]] : []; })));
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(0);

  const options = useMemo(() => defs.map((d) => filterOptions(rows, d)), [rows, defs]);
  const keys = useMemo(() => columns.map((c) => c.key), [columns]);
  const visible = useMemo(() => applyTable(rows, { keys, query, filters: active, defs, sort }), [rows, keys, query, active, defs, sort]);
  const { pages, current, slice } = paginate(visible, page, pageSize);
  const activeCount = defs.filter((d) => active[d.key]).length;
  const narrowed = activeCount > 0 || query.trim() !== "";

  // replaceState (not router.replace) keeps typing instant: no server round trip, and Next still syncs useSearchParams.
  const update = (q: string, f: FilterState) => {
    setQuery(q); setActive(f); setPage(0);
    const p = new URLSearchParams(window.location.search);
    defs.forEach((d) => (f[d.key] ? p.set(`f_${d.key}`, f[d.key]!) : p.delete(`f_${d.key}`)));
    if (q) p.set("q", q); else p.delete("q");
    window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}${window.location.hash}`);
  };
  const setFilter = (key: string, v: string) => update(query, { ...active, [key]: v === "all" ? "" : v });

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
        <SearchInput aria-label={`Search ${label}`} placeholder="Search…" value={query} onChange={(e) => update(e.target.value, active)} className="w-full sm:w-60" />
        {defs.map((d, i) => {
          const opts = options[i]!, value = active[d.key] || undefined;
          if (opts.length < 2 && !value) return null;
          if (opts.length > PILL_MAX) return <FilterMenu key={d.key} def={d} options={opts} value={value} onChange={(v) => setFilter(d.key, v)} />;
          return (
            <div key={d.key} className="flex max-w-full min-w-0 items-center gap-2">
              {defs.length > 1 && <span className="inline-block shrink-0 text-label text-ink-3 first-letter:uppercase" aria-hidden>{d.label}</span>}
              <div className="max-w-full overflow-x-auto">
                <PillGroup ariaLabel={`Filter by ${d.label}`} activeKey={value ?? "all"} onSelect={(k) => setFilter(d.key, k)} items={[{ key: "all", label: "All" }, ...opts.map((s) => ({ key: s, label: s }))]} />
              </div>
            </div>
          );
        })}
        {activeCount > 0 && (
          <button type="button" className={ghost} onClick={() => update(query, {})} aria-label={`Clear ${activeCount} ${activeCount === 1 ? "filter" : "filters"}`}>
            <X />Clear filters
            <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-surface-3 px-1 text-[10.5px] font-semibold text-ink-2 tabular" aria-hidden>{activeCount}</span>
          </button>
        )}
        <span className="text-label text-ink-3 tabular" aria-live="polite">{narrowed && rows.length > 0 ? `${visible.length} of ${rows.length}` : ""}</span>
        {exportName && (
          <Menu>
            <MenuTrigger className={cn(ghost, "ml-auto")}><Download />Export</MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={exportCsv}>CSV ({visible.length} {narrowed ? "matching " : ""}rows)</MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
      {slice.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} className="py-8" />
        ) : (
          <EmptyState
            icon={SearchX}
            title={activeCount ? "No rows match these filters" : "No rows match your search"}
            body={`None of the ${count(rows.length)} rows match. Clear ${activeCount ? "the filters" : "the search"} to see them all.`}
            action={<Button size="sm" className="mt-2" onClick={() => update("", {})}>{activeCount ? "Clear filters" : "Clear search"}</Button>}
            className="py-8"
          />
        )
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-body">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                {columns.map((c) => {
                  const on = sort?.key === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={on ? (sort!.dir === 1 ? "ascending" : "descending") : "none"} className={cn("border-b border-line px-3 py-2 text-[11.5px] font-medium text-ink-3", c.align === "right" && "text-right", c.hideBelow && hideClass[c.hideBelow])}>
                      <button type="button" className={cn("inline-flex items-center gap-1 hover:text-ink", c.align === "right" && "flex-row-reverse")} onClick={() => setSort(on && sort!.dir === -1 ? null : { key: c.key, dir: on ? -1 : 1 })}>
                        {c.header}
                        {on ? sort!.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody key={`${current}-${JSON.stringify(active)}-${sort?.key}-${sort?.dir}`} className="stagger">
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
