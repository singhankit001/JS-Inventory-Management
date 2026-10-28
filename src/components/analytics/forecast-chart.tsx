import { moneyCompact } from "@/lib/format";
import { smoothPath } from "@/components/charts/svg";

/** History (solid) → forecast (dashed) with its confidence band. Server-rendered SVG; numbers are also listed beside it. */
export function ForecastChart({ history, points, label }: {
  history: { label: string; value: number }[]; points: { label: string; value: number; low: number; high: number }[]; label: string;
}) {
  const w = 640, h = 240, l = 52, r = 8, t = 10, b = 26;
  const n = history.length + points.length;
  const max = Math.max(...history.map((x) => x.value), ...points.map((p) => p.high), 1) * 1.08;
  const x = (i: number) => l + (i * (w - l - r)) / (n - 1);
  const y = (v: number) => t + (1 - v / max) * (h - t - b);
  const hist = history.map((p, i) => [x(i), y(p.value)] as [number, number]);
  const last = hist.at(-1)!;
  const fut = [last, ...points.map((p, i) => [x(history.length + i), y(p.value)] as [number, number])];
  const lastV = history.at(-1)!.value;
  const upper = [[last[0], y(lastV)], ...points.map((p, i) => [x(history.length + i), y(p.high)])];
  const lower = points.map((p, i) => [x(history.length + i), y(p.low)]).reverse();
  const band = [...upper, ...lower].map(([px, py], i) => `${i ? "L" : "M"}${px!.toFixed(1)},${py!.toFixed(1)}`).join(" ") + "Z";
  const ticks = [0, 0.5, 1].map((f) => Math.round((max / 1.08) * f));

  return (
    <div className="-mx-1 overflow-x-auto px-1">
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full min-w-[34rem]" role="img" aria-label={label}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={l} x2={w - r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="2 4" />
          <text x={l - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 text-[11px] tabular">{moneyCompact(v)}</text>
        </g>
      ))}
      <rect x={x(history.length - 1)} y={t} width={w - r - x(history.length - 1)} height={h - t - b} fill="var(--surface-2)" rx={8} />
      <text x={w - r - 6} y={t + 14} textAnchor="end" className="fill-ink-3 text-[11px]">Forecast</text>
      <path d={band} fill="var(--blue)" fillOpacity={0.14} />
      <path d={smoothPath(hist)} fill="none" stroke="var(--blue)" strokeWidth={2} pathLength={1} strokeDasharray={1} className="spark-draw" />
      <path d={smoothPath(fut)} fill="none" stroke="var(--blue)" strokeWidth={2} strokeDasharray="5 5" />
      {fut.slice(1).map(([px, py], i) => <circle key={i} cx={px} cy={py} r={3.5} fill="var(--surface)" stroke="var(--blue)" strokeWidth={2} />)}
      {[...history, ...points].map((p, i) => <text key={`${p.label}-${i}`} x={x(i)} y={h - 6} textAnchor="middle" className="fill-ink-3 text-[11px]">{p.label}</text>)}
    </svg>
    </div>
  );
}
