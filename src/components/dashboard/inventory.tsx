"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { PillGroup } from "@/components/ui/pill-group";
import { StatTile, Eyebrow } from "@/components/ui/card";
import { DataList, type ListRow } from "./lists";
import type { Tone } from "@/components/ui/badge";

export type CellState = "healthy" | "low" | "critical" | "incoming";
export interface HeatCell { productId: string; name: string; categoryId: string; state: CellState; onHand: number }

export interface CentreSummary {
  id: string;
  code: string;
  name: string;
  city: string;
  tone: Tone;
  cells: HeatCell[];
  stockValue: string;
  units: string;
  skus: number;
  topItems: ListRow[];
}

const cellClass: Record<CellState, string> = {
  healthy: "", // filled with the centre tone
  low: "bg-amber/80",
  critical: "bg-red",
  incoming: "bg-transparent ring-[1.5px] ring-inset ring-amber",
};
const toneFill: Record<Tone, string> = { neutral: "bg-ink-3", blue: "bg-blue", green: "bg-green", orange: "bg-orange", amber: "bg-amber", red: "bg-red", violet: "bg-violet", slate: "bg-slate" };
const toneTop: Record<Tone, string> = { neutral: "before:bg-ink-3", blue: "before:bg-blue", green: "before:bg-green", orange: "before:bg-orange", amber: "before:bg-amber", red: "before:bg-red", violet: "before:bg-violet", slate: "before:bg-slate" };
const toneCode: Record<Tone, string> = { neutral: "bg-surface-2 text-ink-2", blue: "bg-blue-soft text-blue", green: "bg-green-soft text-green", orange: "bg-orange-soft text-orange", amber: "bg-amber-soft text-amber", red: "bg-red-soft text-red", violet: "bg-violet-soft text-violet", slate: "bg-slate-soft text-slate" };

/** SKU health grid: one cell per SKU, coloured by stock state. */
export function InventoryHeatmap({ cells, tone, label }: { cells: HeatCell[]; tone: Tone; label: string }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-[5px]" aria-label={label}>
      {cells.map((c, i) => (
        <li key={c.productId} className="group relative aspect-square">
          <span
            tabIndex={0}
            aria-label={`${c.name}: ${c.onHand} on hand, ${c.state}`}
            className={cn("cell-in block size-full rounded-[5px] transition-transform duration-200 group-hover:scale-110 focus-visible:scale-110", c.state === "healthy" ? toneFill[tone] : cellClass[c.state])}
            style={{ animationDelay: `${Math.min(i * 12, 500)}ms` }}
          />
          <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-48 -translate-x-1/2 rounded-[10px] bg-pill px-2.5 py-1.5 text-[11.5px] text-pill-ink opacity-0 shadow-pop transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
            {c.name} · {c.onHand} on hand
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CentreSummaryCard({ centre }: { centre: CentreSummary }) {
  const healthy = centre.cells.filter((c) => c.state === "healthy").length;
  const ratio = centre.cells.length ? healthy / centre.cells.length : 0;
  return (
    <article className={cn("card relative overflow-hidden p-5 before:absolute before:inset-x-6 before:top-0 before:h-[3px] before:rounded-b-full", toneTop[centre.tone])}>
      <header className="flex items-center gap-3">
        <span className={cn("grid size-11 place-items-center rounded-[12px] text-[11px] font-semibold tracking-wide", toneCode[centre.tone])}>{centre.code}</span>
        <div className="min-w-0">
          <h3 className="truncate text-title">{centre.name}</h3>
          <p className="truncate text-label text-ink-3">{centre.city}</p>
        </div>
      </header>
      <div className="mt-5 mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-ink-2"><span className="text-body font-medium text-ink tabular">{Math.round(ratio * 100)}%</span> of {centre.cells.length} SKUs healthy</p>
        <div className="flex gap-3 text-[11px] text-ink-3">
          <span className="flex items-center gap-1"><i className={cn("size-2 rounded-[2px]", toneFill[centre.tone])} />OK</span>
          <span className="flex items-center gap-1"><i className="size-2 rounded-[2px] bg-amber/80" />Low</span>
          <span className="flex items-center gap-1"><i className="size-2 rounded-[2px] bg-red" />Critical</span>
        </div>
      </div>
      <InventoryHeatmap cells={centre.cells} tone={centre.tone} label={`${centre.name} SKU health`} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile label="Stock value" value={centre.stockValue} />
        <StatTile label="Units" value={centre.units} />
        <StatTile label="SKUs" value={centre.skus} />
      </div>
      {centre.topItems.length > 0 && (
        <>
          <Eyebrow className="mt-5 mb-1">Needs attention</Eyebrow>
          <DataList rows={centre.topItems} empty="All stock healthy" label={`${centre.name} items needing attention`} />
        </>
      )}
    </article>
  );
}

/** Centre cards with a category filter (segmented, sliding pill). */
export function CentreBoard({ centres, categories, note }: { centres: CentreSummary[]; categories: { id: string; name: string }[]; note?: string }) {
  const [cat, setCat] = useState("all");
  const filtered = cat === "all" ? centres : centres.map((c) => ({ ...c, cells: c.cells.filter((x) => x.categoryId === cat) }));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <PillGroup ariaLabel="Filter by category" activeKey={cat} onSelect={setCat} items={[{ key: "all", label: "All stock" }, ...categories.map((c) => ({ key: c.id, label: c.name }))]} />
        </div>
        {note && <p className="flex items-center gap-1.5 text-[12px] text-ink-3"><Info className="size-3.5" />{note}</p>}
      </div>
      <div key={cat} className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((c) => <CentreSummaryCard key={c.id} centre={c} />)}
      </div>
    </div>
  );
}
