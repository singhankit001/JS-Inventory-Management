"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from "recharts";
import { moneyCompact, money, count } from "@/lib/format";

export type ValueFormat = "money" | "count";
const fmt = (f: ValueFormat, v: number) => (f === "money" ? money(v) : count(v));
const fmtAxis = (f: ValueFormat, v: number) => (f === "money" ? moneyCompact(v) : count(v));

const axis = { stroke: "var(--ink-3)", fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipCard({ active, payload, label, format, names }: Partial<TooltipContentProps<number, string>> & { format: ValueFormat; names: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="animate-pop rounded-[14px] border border-line bg-surface px-3 py-2.5 shadow-pop">
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
export function TrendChart({ data, aName, bName, format = "money", height = 240 }: { data: TrendPoint[]; aName: string; bName?: string; format?: ValueFormat; height?: number }) {
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
        <Tooltip cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }} content={(p) => <TooltipCard {...p} format={format} names={{ a: aName, b: bName ?? "" }} />} />
        <Area type="monotone" dataKey="a" name={aName} stroke="var(--blue)" strokeWidth={2} fill="url(#trend-fill)" animationDuration={1100} animationEasing="ease-out" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
        {bName && <Line type="monotone" dataKey="b" name={bName} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} animationDuration={1300} />}
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
        <Tooltip cursor={{ fill: "var(--surface-3)", radius: 6 }} content={(p) => <TooltipCard {...p} format={format} names={{ value: "Net" }} />} />
        <XAxis dataKey="label" hide />
        <Bar dataKey="value" radius={3} animationDuration={900}>
          {data.map((d) => <Cell key={d.label} fill={d.value >= 0 ? "var(--green)" : "var(--orange)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ColumnChart({ data, name, format = "money", height = 220, highlight }: { data: { label: string; value: number }[]; name: string; format?: ValueFormat; height?: number; highlight?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
        <XAxis dataKey="label" {...axis} dy={6} />
        <YAxis {...axis} width={56} tickFormatter={(v: number) => fmtAxis(format, v)} />
        <Tooltip cursor={{ fill: "var(--surface-3)", radius: 8 }} content={(p) => <TooltipCard {...p} format={format} names={{ value: name }} />} />
        <Bar dataKey="value" radius={[6, 6, 6, 6]} animationDuration={900}>
          {data.map((d) => <Cell key={d.label} fill={d.label === highlight ? "var(--ink)" : "var(--blue)"} fillOpacity={d.label === highlight ? 1 : 0.75} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
