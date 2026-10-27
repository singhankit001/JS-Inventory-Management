import { cn } from "@/lib/cn";
import type { Tone } from "@/components/ui/badge";
import { toneDot } from "@/components/ui/badge";

export function WelcomeCard({ dateLabel, greeting, children, actions, footer, className }: {
  dateLabel: string; greeting: string; children: React.ReactNode; actions?: React.ReactNode; footer?: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("card relative flex flex-col overflow-hidden p-5 sm:p-6", className)}>
      {/* Faint cool wash in the top-right, as in the reference hero card. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-blue-soft opacity-60 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-eyebrow font-medium tracking-[0.14em] text-orange uppercase">{dateLabel}</p>
          <h2 className="mt-2 text-[1.75rem] leading-tight font-normal tracking-[-0.02em] sm:text-[2rem]">{greeting}</h2>
          <div className="mt-2 text-body text-ink-2 [&_b]:font-semibold [&_b]:text-ink [&_em]:text-red [&_em]:not-italic">{children}</div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {/* mt-auto pins the timeline to the bottom when a taller neighbour stretches the row, as in the reference. */}
      {footer && <div className="relative mt-auto pt-6">{footer}</div>}
    </section>
  );
}

export interface DayEvent { id: string; hour: number; label: string; tone: Tone }

/** Hour-by-hour strip (7a–7p): coloured event dots, solid spans over busy stretches, dotted idle time, "now" ring. */
export function DayTimeline({ events, nowHour, startHour = 7, endHour = 19, label }: { events: DayEvent[]; nowHour: number; startHour?: number; endHour?: number; label: string }) {
  const hours = Array.from({ length: Math.floor((endHour - startHour) / 2) + 1 }, (_, i) => startHour + i * 2);
  const pct = (h: number) => ((Math.min(Math.max(h, startHour), endHour) - startHour) / (endHour - startHour)) * 100;
  const pos = (h: number) => `${pct(h)}%`;
  const fmt = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
  // Reference look: solid blue spans over busy stretches so far (events ≤ 1.5h apart, padded ½h), dotted elsewhere.
  const spans: [number, number][] = [];
  for (const h of events.map((e) => e.hour).filter((h) => h <= nowHour).sort((a, b) => a - b)) {
    const last = spans.at(-1);
    if (last && h - last[1] <= 1.5) last[1] = h;
    else spans.push([h, h]);
  }
  return (
    <div role="group" aria-label={label}>
      <div className="relative h-8">
        <div className="absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dotted border-line-strong" />
        {spans.map(([a, b], i) => {
          const from = pct(a - 0.5), to = pct(Math.min(nowHour, b + 0.5));
          return <div key={a} className="bar-grow absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-blue" style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%`, animationDelay: `calc(var(--enter-delay, 0ms) + ${i * 80}ms)` }} />;
        })}
        <span className="absolute inset-y-0 w-px -translate-x-1/2 bg-line-strong" style={{ left: pos(nowHour) }} aria-hidden />
        {events.map((e, i) => (
          <span key={e.id} className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pos(e.hour) }}>
            <span tabIndex={0} aria-label={`${fmt(Math.floor(e.hour))}: ${e.label}`} className={cn("cell-in block size-3 rounded-full ring-2 ring-surface transition-transform duration-200 group-hover:scale-125 focus-visible:scale-125", toneDot[e.tone])} style={{ animationDelay: `calc(var(--enter-delay, 0ms) + ${300 + i * 50}ms)` }} />
            <span role="tooltip" className="pointer-events-none absolute bottom-5 left-1/2 z-10 w-max max-w-56 -translate-x-1/2 translate-y-1 rounded-[10px] bg-pill px-2.5 py-1.5 text-[11.5px] text-pill-ink opacity-0 shadow-pop transition-all duration-200 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">{e.label}</span>
          </span>
        ))}
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink-2 bg-surface" style={{ left: pos(nowHour) }} aria-label="Now" role="img" />
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-ink-3">
        {hours.map((h) => <span key={h} className="absolute -translate-x-1/2" style={{ left: pos(h) }}>{fmt(h)}</span>)}
      </div>
    </div>
  );
}
