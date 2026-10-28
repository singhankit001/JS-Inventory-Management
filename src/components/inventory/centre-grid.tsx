"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { PillGroup } from "@/components/ui/pill-group";
import { Eyebrow, StatTile } from "@/components/ui/card";
import { InventoryHeatmap } from "@/components/dashboard/inventory";
import { DataList } from "@/components/dashboard/lists";
import type { Tone } from "@/components/ui/badge";
import type { CentreCard } from "@/features/inventory/centres";

export const toneTop: Record<Tone, string> = { neutral: "before:bg-ink-3", blue: "before:bg-blue", green: "before:bg-green", orange: "before:bg-orange", amber: "before:bg-amber", red: "before:bg-red", violet: "before:bg-violet", slate: "before:bg-slate" };
export const toneCode: Record<Tone, string> = { neutral: "bg-surface-2 text-ink-2", blue: "bg-blue-soft text-blue", green: "bg-green-soft text-green", orange: "bg-orange-soft text-orange", amber: "bg-amber-soft text-amber", red: "bg-red-soft text-red", violet: "bg-violet-soft text-violet", slate: "bg-slate-soft text-slate" };
export const toneFill: Record<Tone, string> = { neutral: "bg-ink-3", blue: "bg-blue", green: "bg-green", orange: "bg-orange", amber: "bg-amber", red: "bg-red", violet: "bg-violet", slate: "bg-slate" };

/** Heatmap legend: OK (centre tone) / Low / Critical. Text labels, so colour is never the only signal. */
export function HeatLegend({ tone }: { tone: Tone }) {
  return (
    <div className="flex gap-3 text-[11px] text-ink-3">
      <span className="flex items-center gap-1"><i className={cn("size-2 rounded-[2px]", toneFill[tone])} />OK</span>
      <span className="flex items-center gap-1"><i className="size-2 rounded-[2px] bg-amber/80" />Low</span>
      <span className="flex items-center gap-1"><i className="size-2 rounded-[2px] bg-red" />Critical</span>
    </div>
  );
}

/** Warehouse-style centre card (reference c2.8): coloured top rule, code tile, SKU heatmap, stat tiles, "most value here". */
function CentreCardView({ c }: { c: CentreCard }) {
  const healthy = c.cells.filter((x) => x.state === "healthy").length;
  return (
    <article aria-labelledby={`cc-${c.id}`} className={cn("card relative overflow-hidden p-5 sm:p-6 before:absolute before:inset-x-6 before:top-0 before:h-[3px] before:rounded-b-full", toneTop[c.tone])}>
      <header className="flex items-center gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-[12px] text-[11px] font-semibold tracking-wide", toneCode[c.tone])} aria-hidden>{c.code}</span>
        <div className="min-w-0 flex-1">
          <h3 id={`cc-${c.id}`} className="truncate text-title"><Link href={`/inventory/centres/${c.id}`} className="underline-offset-4 hover:underline">{c.name}</Link></h3>
          <p className="truncate text-label text-ink-3">{c.city}</p>
        </div>
        <Link href={`/inventory/centres/${c.id}`} aria-label={`Open ${c.name}`} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"><ArrowUpRight className="size-4" /></Link>
      </header>
      <div className="mt-5 mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-ink-2"><span className="text-body font-medium text-ink tabular">{c.cells.length ? Math.round((healthy / c.cells.length) * 100) : 0}%</span> of {c.cells.length} SKUs healthy</p>
        <HeatLegend tone={c.tone} />
      </div>
      <InventoryHeatmap cells={c.cells} tone={c.tone} label={`${c.name} SKU health`} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile label="Stock value" value={c.stockValue} />
        <StatTile label="Units" value={c.units} />
        <StatTile label="SKUs" value={c.skus} />
      </div>
      <Eyebrow className="mt-5 mb-1">Most value here</Eyebrow>
      <DataList rows={c.mostValue} empty="No stock" label={`${c.name}: most valuable stock`} />
    </article>
  );
}

/** Centre cards with a category filter (segmented, sliding pill), as in the reference "Warehouses" page. */
export function CentreGrid({ cards, categories }: { cards: CentreCard[]; categories: { id: string; name: string }[] }) {
  const [cat, setCat] = useState("all");
  const shown = cat === "all" ? cards : cards.map((c) => ({ ...c, cells: c.cells.filter((x) => x.categoryId === cat) }));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <PillGroup ariaLabel="Filter by category" activeKey={cat} onSelect={setCat} items={[{ key: "all", label: "All stock" }, ...categories.map((c) => ({ key: c.id, label: c.name }))]} />
        </div>
        <p className="flex items-center gap-1.5 text-[12px] text-ink-3"><Info className="size-3.5" />Cells are SKUs, coloured by stock against reorder point</p>
      </div>
      <div key={cat} className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {shown.map((c) => <CentreCardView key={c.id} c={c} />)}
      </div>
    </div>
  );
}
