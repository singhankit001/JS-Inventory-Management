"use client";

import { useState } from "react";
import { ComparisonBars } from "@/components/charts/svg";
import { PillGroup } from "@/components/ui/pill-group";
import type { Tone } from "@/components/ui/badge";

export interface BreakdownView { key: string; label: string; rows: { label: string; sub?: string; value: number; display: string; tone?: Tone }[] }

/** Segmented "by category / centre / product" bars. */
export function Breakdown({ views, label }: { views: BreakdownView[]; label: string }) {
  const [key, setKey] = useState(views[0]?.key);
  const view = views.find((v) => v.key === key) ?? views[0];
  if (!view) return null;
  return (
    <div>
      <PillGroup ariaLabel={`${label} by`} items={views.map((v) => ({ key: v.key, label: v.label }))} activeKey={view.key} onSelect={setKey} className="mb-5" />
      <div key={view.key} role="tabpanel" aria-label={`${label} by ${view.label.toLowerCase()}`} className="animate-enter">
        <ComparisonBars rows={view.rows} label={`${label} by ${view.label.toLowerCase()}`} />
      </div>
    </div>
  );
}
