// Server-renderable, dependency-free chart primitives. Animate on mount via CSS only.
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/components/ui/badge";

/** Catmull-Rom → cubic Bézier, matching the soft curves in the reference sparklines. */
export function smoothPath(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(2)},${c1[1]!.toFixed(2)} ${c2[0]!.toFixed(2)},${c2[1]!.toFixed(2)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const toneVar: Record<Tone, string> = {
  neutral: "var(--ink-3)", blue: "var(--blue)", green: "var(--green)", orange: "var(--orange)", amber: "var(--amber)", red: "var(--red)", violet: "var(--violet)", slate: "var(--slate)",
};

export function Sparkline({ data, tone, className, label }: { data: number[]; tone?: Tone; className?: string; label: string }) {
  const w = 120, h = 40, pad = 3;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1), pad + (1 - (v - min) / span) * (h - pad * 2)] as [number, number]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-10 w-28 overflow-visible", className)} role="img" aria-label={label}>
      <path
        d={smoothPath(pts)}
        fill="none"
        stroke={tone ? toneVar[tone] : "currentColor"}
        strokeWidth={1.75}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        className="[animation:spark-draw_1.2s_var(--ease-out-3)_both]"
      />
    </svg>
  );
}

/** Speedometer-style gauge from the reference "On-time delivery" card. value/target are 0..1. */
export function Gauge({ value, target, label, caption }: { value: number; target?: number; label: string; caption?: string }) {
  const r = 70, cx = 90, cy = 88, sweep = 240, start = 150;
  const polar = (deg: number, rad = r) => [cx + rad * Math.cos((deg * Math.PI) / 180), cy + rad * Math.sin((deg * Math.PI) / 180)] as const;
  const arc = (from: number, to: number) => {
    const [x1, y1] = polar(from), [x2, y2] = polar(to);
    return `M${x1} ${y1} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const v = Math.max(0, Math.min(1, value));
  const needle = start + sweep * v;
  const tone = target === undefined || v >= target ? "var(--green)" : v >= target - 0.08 ? "var(--amber)" : "var(--red)";
  const ticks = Array.from({ length: 13 }, (_, i) => start + (sweep * i) / 12);
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 180 150" className="w-full max-w-[220px]" role="img" aria-label={`${label}: ${Math.round(v * 100)}%`}>
        <path d={arc(start, start + sweep)} stroke="var(--surface-3)" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={arc(start, start + sweep)} stroke={tone} strokeWidth={14} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${v} 1`} className="[animation:gauge-fill_1.3s_var(--ease-out-3)_both]" />
        {ticks.map((t) => {
          const [x1, y1] = polar(t, 52), [x2, y2] = polar(t, 47);
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-strong)" strokeWidth={1.5} strokeLinecap="round" />;
        })}
        {target !== undefined && (() => { const [x1, y1] = polar(start + sweep * target, 60), [x2, y2] = polar(start + sweep * target, 80); return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" />; })()}
        <g style={{ transformOrigin: `${cx}px ${cy}px`, ["--needle" as string]: `${needle - 360}deg` }} className="[animation:needle-swing_1.4s_var(--ease-spring)_both] [transform:rotate(var(--needle))]">
          <line x1={cx} y1={cy} x2={cx + 44} y2={cy} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={7} fill="var(--surface)" stroke="var(--ink)" strokeWidth={3} />
        <text x={cx} y={cy + 32} textAnchor="middle" className="fill-ink text-[22px] font-medium tabular">{Math.round(v * 100)}%</text>
      </svg>
      {caption && <figcaption className="-mt-3 text-center text-label text-ink-3">{caption}</figcaption>}
    </figure>
  );
}

export function ProgressRing({ value, size = 56, stroke = 6, tone = "blue", label, children }: { value: number; size?: number; stroke?: number; tone?: Tone; label: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={toneVar[tone]} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="ring-draw" style={{ ["--ring-len" as string]: `${c}` }} />
      </svg>
      <span className="absolute text-[12px] font-medium tabular">{children ?? `${Math.round(v * 100)}%`}</span>
    </div>
  );
}

/** "↗ 9 orders confirmed" style footnote. `good` decides colour, `direction` the arrow. */
export function TrendIndicator({ direction, good, children, className }: { direction: "up" | "down" | "flat"; good?: boolean; children: React.ReactNode; className?: string }) {
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium", good === undefined ? "" : good ? "text-green" : "text-orange", className)}>
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

export interface Segment { label: string; value: number; tone: Tone; display?: string; detail?: string }

const toneBg: Record<Tone, string> = { neutral: "bg-ink-3", blue: "bg-blue", green: "bg-green", orange: "bg-orange", amber: "bg-amber", red: "bg-red", violet: "bg-violet", slate: "bg-slate" };

/** Stacked horizontal bar + legend ("Where the money sits" in the reference). */
export function CategoryDistribution({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full" role="img" aria-label={label}>
        {segments.map((s, i) => (
          <div key={s.label} className={cn("bar-grow h-full first:rounded-l-full last:rounded-r-full", toneBg[s.tone])} style={{ width: `${(s.value / total) * 100}%`, animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5 text-label">
            <span className={cn("size-2.5 rounded-[3px]", toneBg[s.tone])} aria-hidden />
            <dt className="flex-1 truncate text-ink-2">{s.label}</dt>
            <dd className="font-medium tabular">{s.display ?? s.value}</dd>
            <dd className="w-9 text-right text-ink-3 tabular">{Math.round((s.value / total) * 100)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Horizontal comparison bars (centre spend, funnel-style rows). */
export function ComparisonBars({ rows, label }: { rows: { label: string; sub?: string; value: number; display: string; tone?: Tone; marker?: number }[]; label: string }) {
  const max = Math.max(...rows.map((r) => Math.max(r.value, r.marker ?? 0)), 1);
  return (
    <ul className="grid gap-3.5" aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-label font-medium">{r.label}</p>
            {r.sub && <p className="truncate text-[11.5px] text-ink-3">{r.sub}</p>}
          </div>
          <div className="relative h-2.5 rounded-full bg-surface-3">
            <div className={cn("bar-grow h-full rounded-full", toneBg[r.tone ?? "slate"])} style={{ width: `${(r.value / max) * 100}%`, animationDelay: `${i * 70}ms` }} />
            {r.marker !== undefined && <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-ink" style={{ left: `${(r.marker / max) * 100}%` }} title="Budget" />}
          </div>
          <span className="text-label font-medium tabular">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}
