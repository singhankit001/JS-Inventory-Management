"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { CardHeader } from "@/components/ui/card";
import { PillGroup } from "@/components/ui/pill-group";
import { TrendChart, ColumnChart } from "./lazy";
import type { TrendPoint, ValueFormat } from "./interactive";

export interface TrendView {
  key: string;
  label: string;
  kind: "trend" | "column";
  data: TrendPoint[];
  format: ValueFormat;
  aName: string;
  bName?: string;
}

/** Client half of TrendCard: owns the selected view. The icon arrives pre-rendered (`leading`) because
 *  icon components are functions and cannot cross the server → client boundary. */
export function TrendCardClient({ leading, title, subtitle, views, className }: { leading: React.ReactNode; title: string; subtitle?: string; views: TrendView[]; className?: string }) {
  // undefined until the user picks a view: the first view mounts with its card's enter, not a second blur-fade.
  const [key, setKey] = useState<string>();
  const view = views.find((v) => v.key === key) ?? views[0];
  if (!view) return null;
  return (
    <section className={cn("card flex flex-col p-5 sm:p-6", className)} aria-label={title}>
      <CardHeader leading={leading} title={title} subtitle={subtitle} action={views.length > 1 ? <PillGroup ariaLabel={`${title} view`} items={views.map((v) => ({ key: v.key, label: v.label }))} activeKey={view.key} onSelect={setKey} /> : undefined} />
      {/* Legend row and chart box keep a fixed height across views so switching never moves the card. */}
      <div className="-mt-2 mb-2 flex h-4 justify-end gap-4 text-[11.5px] text-ink-3" aria-hidden>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-blue" />{view.aName}</span>
        {view.bName && <span className="flex items-center gap-1.5"><i className="h-0.5 w-3 border-t-2 border-dashed border-ink-3" />{view.bName}</span>}
      </div>
      {/* Grows with a taller neighbour instead of leaving a gap; absolute box gives recharts a definite height. */}
      <div className="relative min-h-[240px] flex-1">
        <div key={view.key} className={cn("absolute inset-0", key && "animate-enter")} role="tabpanel" aria-label={view.label}>
          {view.kind === "trend"
            ? <TrendChart data={view.data} aName={view.aName} bName={view.bName} format={view.format} height="100%" />
            : <ColumnChart data={view.data.map((d) => ({ label: d.label, value: d.a }))} name={view.aName} format={view.format} highlight={view.data.at(-1)?.label} height="100%" />}
        </div>
      </div>
    </section>
  );
}
