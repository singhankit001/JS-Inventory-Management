import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { indexBy, lastPeriods } from "@/features/dashboards/shared";
import { count, moneyCompact, monthLabel, percent } from "@/lib/format";
import { fullMonth, seasonalForecast, seasonalIndex } from "./forecast";

export const FORECAST_METHOD = [
  "History: consumption at catalogue cost for the last 12 months; this month is scaled to a full month by elapsed days.",
  "Each future month = the same month last year averaged with its neighbours (a seasonal moving average).",
  "The band covers ±1.28 × the month-to-month noise around that average — roughly 80% of past months fell inside it.",
];

export async function loadConsumption(repo: Repository) {
  const today = repo.today();
  const [movements, products, categories, centres] = await Promise.all([repo.movements(), repo.products(), repo.categories(), repo.centres()]);
  const pmap = indexBy(products, "id");
  const periods = lastPeriods(today, 12);
  const idx = new Map(periods.map((p, i) => [p, i]));
  const blank = () => Array.from({ length: 12 }, () => 0);

  const value = blank(), units = blank();
  const byCat = new Map<string, { value: number[]; units: number }>();
  const byCentre = new Map<string, { value: number; units: number }>();
  const byProduct = new Map<string, { value: number; units: number }>();
  for (const m of movements) {
    const i = idx.get(m.occurredAt.slice(0, 7));
    if (m.type !== "consumption" || i === undefined) continue;
    const p = pmap.get(m.productId);
    const v = m.quantity * (p?.unitCost ?? 0);
    value[i] = value[i]! + v; units[i] = units[i]! + m.quantity;
    if (p) { const c = byCat.get(p.categoryId) ?? { value: blank(), units: 0 }; c.value[i] = c.value[i]! + v; c.units += m.quantity; byCat.set(p.categoryId, c); }
    const ce = byCentre.get(m.centreId) ?? { value: 0, units: 0 }; ce.value += v; ce.units += m.quantity; byCentre.set(m.centreId, ce);
    const pr = byProduct.get(m.productId) ?? { value: 0, units: 0 }; pr.value += v; pr.units += m.quantity; byProduct.set(m.productId, pr);
  }

  const full = (xs: number[]) => xs.map((v, i) => (i === 11 ? fullMonth(v, today) : v));
  const nextLabels = [1, 2, 3].map((k) => monthLabel(lastPeriods(new Date(today.getFullYear(), today.getMonth() + k, 1), 1)[0]!));
  const network = seasonalForecast(full(value));
  const index = seasonalIndex(full(value));
  const avg = network.points.reduce((s, p) => s + p.value, 0) / 3 || 1;
  const total = value.reduce((a, b) => a + b, 0) || 1;

  const bars = (rows: { key: string; label: string; value: number; units: number; tone?: Tone }[]) => rows.sort((a, b) => b.value - a.value).slice(0, 10).map((r) => ({
    label: r.label, sub: `${count(r.units)} units · ${percent(r.value / total)}`, value: r.value, display: moneyCompact(r.value), tone: r.tone ?? ("blue" as Tone),
  }));

  return {
    kpis: {
      lastMonth: value.at(-2) ?? 0, lastMonthLabel: monthLabel(periods.at(-2)!),
      mtd: value.at(-1) ?? 0, projected: full(value).at(-1)!,
      next: network.points[0]!.value, nextLabel: nextLabels[0]!, nextLow: network.points[0]!.low, nextHigh: network.points[0]!.high,
      confidence: Math.max(0, 1 - network.spread / avg),
    },
    views: {
      value: periods.map((p, i) => ({ label: monthLabel(p), a: value[i]! })),
      units: periods.map((p, i) => ({ label: monthLabel(p), a: units[i]! })),
    },
    breakdown: [
      { key: "category", label: "Category", rows: bars(categories.map((c) => ({ key: c.id, label: c.name, value: byCat.get(c.id)?.value.reduce((a, b) => a + b, 0) ?? 0, units: byCat.get(c.id)?.units ?? 0, tone: c.color as Tone }))) },
      { key: "centre", label: "Centre", rows: bars(centres.map((c) => ({ key: c.id, label: c.name, value: byCentre.get(c.id)?.value ?? 0, units: byCentre.get(c.id)?.units ?? 0 }))) },
      { key: "product", label: "Product", rows: bars(products.map((p) => ({ key: p.id, label: p.name, value: byProduct.get(p.id)?.value ?? 0, units: byProduct.get(p.id)?.units ?? 0 }))) },
    ],
    seasonality: periods.map((p, i) => ({ period: p, label: monthLabel(p), index: index[i]!, partial: i === 11 })),
    forecast: {
      history: periods.map((p, i) => ({ label: monthLabel(p), value: full(value)[i]! })),
      points: network.points.map((p, i) => ({ ...p, label: nextLabels[i]! })),
      spread: network.spread,
    },
    byCategory: categories.map((c) => {
      const h = byCat.get(c.id)?.value ?? blank();
      const f = seasonalForecast(full(h));
      return {
        id: c.id, category: { label: c.name, tone: c.color as Tone },
        m1: f.points[0]!.value, m2: f.points[1]!.value, m3: f.points[2]!.value,
        band: `± ${moneyCompact(f.spread)}`, last: h.slice(-4, -1).reduce((a, b) => a + b, 0),
      };
    }),
    nextLabels,
  };
}
