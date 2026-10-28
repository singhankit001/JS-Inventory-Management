"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps, type TooltipValueType,
} from "recharts";
import { moneyCompact, money, count } from "@/lib/format";

export type ValueFormat = "money" | "count";
const fmt = (f: ValueFormat, v: number) => (f === "money" ? money(v) : count(v));
const fmtAxis = (f: ValueFormat, v: number) => (f === "money" ? moneyCompact(v) : count(v));

const axis = { stroke: "var(--ink-3)", fontSize: 11, tickLine: false, axisLine: false } as const;
// Same timing as the CSS tokens (--dur-draw / --dur-grow, --ease-out-3). Recharts' default
// isAnimationActive="auto" already skips these under prefers-reduced-motion.
const ease = "cubic-bezier(0.215,0.61,0.355,1)" as const;
const draw = { animationDuration: 700, animationEasing: ease } as const;
const grow = { animationDuration: 600, animationEasing: ease } as const;
// Tooltips may leave the plot area (cards never clip them) and sit above neighbouring cards.
const tip = { animationDuration: 160, animationEasing: ease, allowEscapeViewBox: { x: false, y: true }, wrapperStyle: { zIndex: 40, outline: "none" } } as const;

function TooltipCard({ active, payload, label, format, names }: Partial<TooltipContentProps<TooltipValueType, string | number>> & { format: ValueFormat; names: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="animate-pop rounded-tile border border-line bg-surface px-3 py-2.5 shadow-pop">
      <p className="mb-1 text-label font-medium">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-[12px] text-ink-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1 pr-4">{names[String(p.dataKey)] ?? p.name}</span>
          <span className="font-medium text-ink tabular">{fmt(format, Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export interface TrendPoint { label: string; a: number; b?: number }

/** Area (primary series) + dashed line (comparison series) — "Revenue vs cost of goods" in the reference. */
export function TrendChart({ data, aName, bName, format = "money", height = 240 }: { data: TrendPoint[]; aName: string; bName?: string; format?: ValueFormat; height?: number | `${number}%` }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
        <XAxis dataKey="label" {...axis} dy={6} />
        <YAxis {...axis} width={56} tickFormatter={(v: number) => fmtAxis(format, v)} />
        <Tooltip {...tip} cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }} content={(p) => <TooltipCard {...p} format={format} names={{ a: aName, b: bName ?? "" }} />} />
        <Area type="monotone" dataKey="a" name={aName} stroke="var(--blue)" strokeWidth={2} fill="url(#trend-fill)" {...draw} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
        {bName && <Line type="monotone" dataKey="b" name={bName} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} {...draw} />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Diverging in/out bars around zero — the reference "Cash on hand" widget. */
export function FlowBars({ data, height = 120, format = "money" }: { data: { label: string; value: number }[]; height?: number; format?: ValueFormat }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
        <ReferenceLine y={0} stroke="var(--line-strong)" />
        <Tooltip {...tip} cursor={{ fill: "var(--surface-3)", radius: 6 }} content={(p) => <TooltipCard {...p} format={format} names={{ value: "Net" }} />} />
        <XAxis dataKey="label" hide />
        <Bar dataKey="value" radius={3} {...grow}>
          {data.map((d) => <Cell key={d.label} fill={d.value >= 0 ? "var(--green)" : "var(--orange)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ColumnChart({ data, name, format = "money", height = 220, highlight }: { data: { label: string; value: number }[]; name: string; format?: ValueFormat; height?: number | `${number}%`; highlight?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
        <XAxis dataKey="label" {...axis} dy={6} />
        <YAxis {...axis} width={56} tickFormatter={(v: number) => fmtAxis(format, v)} />
        <Tooltip {...tip} cursor={{ fill: "var(--surface-3)", radius: 8 }} content={(p) => <TooltipCard {...p} format={format} names={{ value: name }} />} />
        <Bar dataKey="value" radius={[6, 6, 6, 6]} {...grow}>
          {data.map((d) => <Cell key={d.label} fill={d.label === highlight ? "var(--ink)" : "var(--blue)"} fillOpacity={d.label === highlight ? 1 : 0.75} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
