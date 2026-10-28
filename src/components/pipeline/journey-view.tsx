"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BrainCircuit, ChevronLeft, ChevronRight, Landmark, Mic, Pause, Play, ReceiptText, ShoppingCart, Stamp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import type { StageKey } from "@/features/pipeline/journey";

export interface JourneyStage {
  key: StageKey;
  title: string;
  owner: { name: string; role: string };
  when: string;
  status: { label: string; tone: Tone };
  panel: ReactNode;
}

const ICON: Record<StageKey, LucideIcon> = { voice: Mic, intake: BrainCircuit, approval: Stamp, purchasing: ShoppingCart, finance: ReceiptText, executive: Landmark };
const STEP_MS = 5000;

/** Six-stage track with a detail panel. Starts on the stage in progress; "Play" walks the whole story. */
export function JourneyView({ stages, current }: { stages: JourneyStage[]; current: StageKey }) {
  const currentIdx = stages.findIndex((s) => s.key === current);
  const [sel, setSel] = useState(currentIdx);
  const [playing, setPlaying] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = stages[sel]!;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      if (sel >= stages.length - 1) setPlaying(false);
      else setSel(sel + 1);
    }, STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, sel, stages.length]);

  const go = (i: number, focus = false) => {
    const n = Math.max(0, Math.min(stages.length - 1, i));
    setSel(n);
    if (focus) tabs.current[n]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); setPlaying(false); go(sel + d, true); }
    if (e.key === "Home") { e.preventDefault(); go(0, true); }
    if (e.key === "End") { e.preventDefault(); go(stages.length - 1, true); }
  };
  const progress = currentIdx / (stages.length - 1);

  return (
    <div className="grid gap-4">
      <section className="card p-3 sm:p-4" aria-label="Request journey stages">
        <div className="relative">
          {/* Connector: full track, then the completed part. Desktop only; mobile stacks the stages. */}
          <div aria-hidden className="pointer-events-none absolute top-[34px] right-[calc(100%/12)] left-[calc(100%/12)] hidden h-[2px] rounded-full bg-line md:block">
            <div className="journey-fill h-full origin-left rounded-full bg-ink" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <div role="tablist" aria-label="Stages" onKeyDown={onKeyDown} className="relative grid gap-1.5 md:grid-cols-6 md:gap-2">
            {stages.map((s, i) => {
              const Icon = ICON[s.key];
              const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming";
              const on = i === sel;
              return (
                <button
                  key={s.key}
                  ref={(el) => { tabs.current[i] = el; }}
                  role="tab"
                  id={`stage-${s.key}`}
                  aria-selected={on}
                  aria-controls="stage-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => { setPlaying(false); go(i); }}
                  className={cn(
                    "journey-tab group flex items-center gap-3 rounded-[18px] p-2.5 text-left md:flex-col md:items-center md:gap-2 md:px-2 md:pt-3 md:pb-3 md:text-center",
                    on ? "bg-surface-2 ring-1 ring-line" : "hover:bg-surface-2/60",
                  )}
                >
                  <span className={cn(
                    "relative grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,color,box-shadow] duration-300",
                    state === "done" && "bg-pill text-pill-ink",
                    state === "current" && "bg-surface text-ink shadow-float ring-2 ring-ink",
                    state === "upcoming" && "bg-surface text-ink-3 ring-1 ring-line-strong",
                  )}>
                    <Icon className="size-[18px]" strokeWidth={1.7} />
                    {state === "current" && <span className="pulse-dot absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-green ring-2 ring-surface" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 md:flex-none">
                    <span className="block text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase tabular">Step {i + 1}</span>
                    <span className="block truncate text-body font-medium tracking-[-0.01em]">{s.title}</span>
                    <span className="block truncate text-[12px] text-ink-3">{s.owner.name}</span>
                    <span className="block truncate text-[11.5px] text-ink-3 tabular md:mt-0.5">{s.when}</span>
                  </span>
                  <span className="md:hidden"><StatusBadge tone={s.status.tone} dot>{s.status.label}</StatusBadge></span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section id="stage-panel" role="tabpanel" aria-labelledby={`stage-${stage.key}`} className="card p-5 sm:p-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line/70 pb-4">
          <div className="min-w-0">
            <p className="text-eyebrow font-medium tracking-[0.12em] text-ink-3 uppercase">Step {sel + 1} of {stages.length} · {stage.owner.role}</p>
            <h2 className="mt-1 text-[1.35rem] leading-tight font-light tracking-[-0.02em]">{stage.title}</h2>
            <p className="mt-1 text-label text-ink-3">{stage.owner.name} · {stage.when}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge tone={stage.status.tone} dot>{stage.status.label}</StatusBadge>
            <span className="mx-1 h-6 w-px bg-line" aria-hidden />
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => { setPlaying(false); go(sel - 1); }} disabled={sel === 0} aria-label="Previous stage"><ChevronLeft /></button>
            <button type="button" className={buttonClass(playing ? "secondary" : "primary", "sm")} onClick={() => { if (!playing && sel === stages.length - 1) setSel(0); setPlaying(!playing); }}>
              {playing ? <><Pause />Pause</> : <><Play />Play walkthrough</>}
            </button>
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => { setPlaying(false); go(sel + 1); }} disabled={sel === stages.length - 1} aria-label="Next stage"><ChevronRight /></button>
          </div>
        </header>
        {playing && <div aria-hidden className="journey-timer -mt-5 mb-5 h-[2px] origin-left rounded-full bg-ink/70" key={`t-${sel}`} style={{ animationDuration: `${STEP_MS}ms` }} />}
        <div key={stage.key} className="animate-enter">{stage.panel}</div>
      </section>
    </div>
  );
}
