"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
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

/** Card with a segmented control switching between chart views (reference: "Revenue & cost | Bikes built"). */
export function TrendCard({ icon, title, subtitle, views, className }: { icon: LucideIcon; title: string; subtitle?: string; views: TrendView[]; className?: string }) {
  const [key, setKey] = useState(views[0]?.key);
  const view = views.find((v) => v.key === key) ?? views[0];
  if (!view) return null;
  return (
    <section className={`card p-5 sm:p-6 ${className ?? ""}`} aria-label={title}>
      <CardHeader icon={icon} title={title} subtitle={subtitle} action={views.length > 1 ? <PillGroup ariaLabel={`${title} view`} items={views.map((v) => ({ key: v.key, label: v.label }))} activeKey={view.key} onSelect={setKey} /> : undefined} />
      {view.bName && (
        <div className="-mt-2 mb-2 flex justify-end gap-4 text-[11.5px] text-ink-3">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-blue" />{view.aName}</span>
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-3 border-t-2 border-dashed border-ink-3" />{view.bName}</span>
        </div>
      )}
      <div key={view.key} className="animate-enter" role="tabpanel">
        {view.kind === "trend"
          ? <TrendChart data={view.data} aName={view.aName} bName={view.bName} format={view.format} />
          : <ColumnChart data={view.data.map((d) => ({ label: d.label, value: d.a }))} name={view.aName} format={view.format} highlight={view.data.at(-1)?.label} />}
      </div>
    </section>
  );
}
