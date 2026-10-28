import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type StepState = "done" | "current" | "upcoming" | "blocked";
export interface Step { label: string; state: StepState; detail?: string; at?: string }

const dot: Record<StepState, string> = {
  done: "bg-ink text-canvas",
  current: "bg-surface text-orange ring-[3px] ring-orange",
  upcoming: "bg-surface-3 text-ink-3",
  blocked: "bg-red text-white",
};

/**
 * Workflow progress (request → approval → PO → receipt → invoice …). Horizontal from md, vertical on phones.
 * Connectors are solid once passed and dotted ahead — the same language as the day timeline.
 */
export function WorkflowStepper({ steps, label, className }: { steps: Step[]; label: string; className?: string }) {
  return (
    <ol aria-label={label} className={cn("grid gap-4 md:flex md:gap-0", className)}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.label} aria-current={s.state === "current" ? "step" : undefined} className="relative flex gap-3 md:flex-1 md:flex-col md:gap-2.5">
            {!last && (
              <span aria-hidden className={cn(
                "absolute top-7 bottom-[-1rem] left-[11px] w-0 border-l-2 md:top-[11px] md:right-0 md:bottom-auto md:left-7 md:h-0 md:w-auto md:border-t-2 md:border-l-0",
                s.state === "done" ? "border-ink" : "border-dotted border-line-strong",
              )} />
            )}
            <span className={cn("cell-in relative z-10 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold", dot[s.state])} style={{ animationDelay: `${i * 70}ms` }}>
              {s.state === "done" ? <Check className="size-3.5" strokeWidth={2.5} /> : s.state === "blocked" ? <X className="size-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
            <div className="min-w-0 md:pr-4">
              <p className={cn("text-label font-medium", s.state === "upcoming" ? "text-ink-3" : "text-ink")}>{s.label}<span className="sr-only"> — {s.state}</span></p>
              {s.detail && <p className="text-[12px] text-ink-3">{s.detail}</p>}
              {s.at && <p className="text-[11.5px] text-ink-3 tabular">{s.at}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
