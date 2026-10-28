"use client";

import { useState } from "react";
import {
  AudioLines, Bot, Calculator, ChartLine, FileScan, Landmark, Lightbulb, PackageSearch, ScanSearch, ShoppingCart, type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import type { AICapabilityId } from "@/features/ai/contracts";
import { DemoOutputView, type DemoOutput } from "./demo-output";

const ICON: Record<AICapabilityId, LucideIcon> = {
  request_intelligence: AudioLines, catalogue_matching: ScanSearch, inventory_analysis: PackageSearch, demand_forecasting: ChartLine,
  procurement_optimization: ShoppingCart, budget_intelligence: Landmark, document_intelligence: FileScan, reconciliation: Calculator,
  executive_insights: Lightbulb, operational_assistant: Bot,
};

/** The ten AI capabilities. Each card opens its demo output in a drawer. */
export function InsightGrid({ capabilities }: { capabilities: { id: AICapabilityId; name: string; summary: string; output: DemoOutput }[] }) {
  const [open, setOpen] = useState<AICapabilityId>();
  const current = capabilities.find((c) => c.id === open);
  return (
    <>
      <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="AI capabilities">
        {capabilities.map((c) => {
          const Icon = ICON[c.id];
          return (
            <li key={c.id}>
              <button type="button" onClick={() => setOpen(c.id)} aria-haspopup="dialog"
                className="flex h-full w-full flex-col items-start gap-3 rounded-tile border border-line bg-surface p-4 text-left shadow-card transition-[transform,translate,scale,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-float">
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-2 ring-1 ring-line" aria-hidden><Icon className="size-4" strokeWidth={1.75} /></span>
                  <StatusBadge tone="neutral" dot>Not connected</StatusBadge>
                </span>
                <span className="text-body font-medium">{c.name}</span>
                <span className="text-[12px] text-ink-3">{c.summary}</span>
                <span className="mt-auto line-clamp-2 text-label text-ink-2">{c.output.summary}</span>
                <span className="text-[12px] font-medium text-ink underline-offset-4">Demo preview ›</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!current} onOpenChange={(o) => !o && setOpen(undefined)}>
        {current && (
          <DrawerContent title={current.name} description={current.summary}>
            <DemoOutputView output={current.output} />
          </DrawerContent>
        )}
      </Dialog>
    </>
  );
}
