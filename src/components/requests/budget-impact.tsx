import { cn } from "@/lib/cn";
import { toneDot } from "@/components/ui/badge";
import { moneyCompact, percent } from "@/lib/format";
import type { BudgetImpact } from "@/features/requests/logic";

/**
 * Month budget as one bar: spent (solid) · committed (soft) · this request (orange) against the allocation mark.
 * Safe in server and client components (no hooks).
 */
export function BudgetImpactBar({ impact, requestLabel = "This request", className }: { impact: BudgetImpact; requestLabel?: string; className?: string }) {
  const { share } = impact;
  const legend = [
    { label: "Spent", value: impact.spent, dot: toneDot.blue },
    { label: "Committed", value: impact.committed, dot: "bg-blue/35" },
    { label: requestLabel, value: impact.request, dot: toneDot.orange },
  ];
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-label text-ink-3">Allocation {moneyCompact(impact.allocated)}</p>
        <p className={cn("text-label font-medium tabular", impact.over ? "text-red" : "text-ink")}>
          {impact.over ? `${moneyCompact(-impact.after)} over budget` : `${moneyCompact(impact.after)} left after`}
        </p>
      </div>
      <div className="relative mt-2 h-3 rounded-full bg-surface-3" role="img"
        aria-label={`${percent(impact.utilisation)} of allocation used including ${requestLabel.toLowerCase()}; ${impact.over ? `${moneyCompact(-impact.after)} over` : `${moneyCompact(impact.after)} headroom left`}`}>
        <div className="flex h-full overflow-hidden rounded-full">
          <div className="bar-grow h-full bg-blue" style={{ width: `${share.spent * 100}%` }} />
          <div className="bar-grow h-full bg-blue/35" style={{ width: `${share.committed * 100}%`, animationDelay: "90ms" }} />
          <div className={cn("bar-grow h-full bg-orange", impact.over && "bg-red")} style={{ width: `${share.request * 100}%`, animationDelay: "180ms" }} />
        </div>
        {/* Allocation mark: only distinct from the end when demand exceeds it. */}
        {impact.over && <span className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-ink" style={{ left: `${share.allocation * 100}%` }} title="Allocation" />}
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-[12px] xs:grid-cols-3">
        {legend.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 shrink-0 rounded-full", l.dot, l.label === requestLabel && impact.over && "bg-red")} aria-hidden />
            <dt className="truncate text-ink-3">{l.label}</dt>
            <dd className="ml-auto font-medium tabular xs:ml-1">{moneyCompact(l.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
