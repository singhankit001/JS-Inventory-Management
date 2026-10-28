import Link from "next/link";
import { FlaskConical, Link2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/charts/svg";
import type { AIOutput } from "@/features/ai/contracts";

export type DemoOutput = Omit<AIOutput<unknown>, "result">;

export function DemoBanner({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-tile bg-amber-soft px-3.5 py-2.5 text-label text-ink-2", className)} role="note">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
      <span><b className="font-medium text-ink">Demo preview — AI not connected.</b> {children ?? "Computed from demo data by fixed rules, not a model; the same data always gives the same answer."}</span>
    </p>
  );
}

/** Body of one AI output: confidence, review status, highlights, why, and the records it cites. */
export function DemoOutputView({ output }: { output: DemoOutput }) {
  return (
    <div className="grid gap-5">
      <DemoBanner />
      <div className="flex items-center gap-4">
        <ProgressRing value={output.confidence} tone="blue" label="Confidence" />
        <div className="min-w-0">
          <p className="text-body text-ink">{output.summary}</p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            <StatusBadge tone={output.status === "needs_review" ? "amber" : "green"} dot>{output.status === "needs_review" ? "Needs a person to confirm" : "Completes on its own"}</StatusBadge>
            <StatusBadge>Confidence {Math.round(output.confidence * 100)}%</StatusBadge>
          </p>
        </div>
      </div>
      {output.highlights.length > 0 && (
        <ul className="-mx-2 grid" aria-label="Findings">
          {output.highlights.map((h, i) => (
            <li key={`${h.label}-${i}`} className="border-b border-line/60 last:border-0">
              {h.href
                ? <Link href={h.href} className="flex flex-wrap justify-between gap-x-3 rounded-[12px] px-2 py-2 hover:bg-surface-2"><span className="text-label font-medium">{h.label}</span><span className="text-label text-ink-2 tabular">{h.value}</span></Link>
                : <div className="flex flex-wrap justify-between gap-x-3 px-2 py-2"><span className="text-label font-medium">{h.label}</span><span className="text-label text-ink-2 tabular">{h.value}</span></div>}
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="mb-1.5 text-label font-medium">How it got there</p>
        <ol className="grid list-decimal gap-1 pl-4 text-label text-ink-2">{output.explanation.map((e) => <li key={e}>{e}</li>)}</ol>
      </div>
      {output.citations.length > 0 && (
        <div>
          <p className="mb-1.5 text-label font-medium">Sources ({output.citations.length})</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Sources">
            {output.citations.slice(0, 16).map((c) => (
              <li key={`${c.kind}-${c.id}`}>
                <Link href={c.href} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2 ring-1 ring-line hover:text-ink">
                  <Link2 className="size-3" aria-hidden /><span className="sr-only">{c.kind.replace("_", " ")}: </span>{c.label}
                </Link>
              </li>
            ))}
            {output.citations.length > 16 && <li className="px-1 py-1 text-[12px] text-ink-3">+{output.citations.length - 16} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
