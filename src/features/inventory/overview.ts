import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { consumptionSeries, indexBy, lastPeriods, stockState, valuation } from "@/features/dashboards/shared";
import { count, moneyCompact, monthLabel, percent } from "@/lib/format";
import { signedQty } from "./stock";

export const healthTone = (ratio: number): Tone => (ratio >= 0.8 ? "green" : ratio >= 0.6 ? "amber" : "red");

export async function loadInventoryOverview(repo: Repository) {
  const today = repo.today();
  const [centres, products, categories, balances, movements] = await Promise.all([repo.centres(), repo.products(), repo.categories(), repo.balances(), repo.movements()]);
  const pmap = indexBy(products, "id");
  const totalValue = valuation(balances, pmap);
  const states = balances.map((b) => stockState(b.onHand, pmap.get(b.productId)!.reorderPoint));
  const health = { healthy: states.filter((s) => s === "healthy").length, low: states.filter((s) => s === "low").length, critical: states.filter((s) => s === "critical").length };

  // Month-end stock value, walked back from today's valuation (at current unit cost) by each month's net movement value.
  const periods = lastPeriods(today, 12);
  const net = new Map(periods.map((p) => [p, 0]));
  for (const m of movements) {
    const p = m.occurredAt.slice(0, 7);
    if (net.has(p)) net.set(p, net.get(p)! + signedQty(m) * (pmap.get(m.productId)?.unitCost ?? 0));
  }
  const stockValue: number[] = [];
  for (let i = periods.length - 1, v = totalValue; i >= 0; v -= net.get(periods[i]!)!, i--) stockValue.unshift(v);
  const consumption = consumptionSeries(movements, pmap, today, 12);

  // Top movers: units used in the last 30 days vs the 30 before.
  const d30 = new Date(today.getTime() - 30 * 86_400_000).toISOString(), d60 = new Date(today.getTime() - 60 * 86_400_000).toISOString();
  const used = new Map<string, { now: number; before: number }>();
  for (const m of movements) {
    if (m.type !== "consumption" || m.occurredAt < d60) continue;
    const u = used.get(m.productId) ?? { now: 0, before: 0 };
    if (m.occurredAt >= d30) u.now += m.quantity; else u.before += m.quantity;
    used.set(m.productId, u);
  }
  const movers = [...used].map(([id, u]) => ({ p: pmap.get(id)!, ...u })).sort((a, b) => b.now * b.p.unitCost - a.now * a.p.unitCost).slice(0, 6);

  const centreRows = centres.map((c) => {
    const rows = balances.filter((b) => b.centreId === c.id);
    const healthy = rows.filter((b) => stockState(b.onHand, pmap.get(b.productId)!.reorderPoint) === "healthy").length;
    const ratio = rows.length ? healthy / rows.length : 0;
    return { c, value: valuation(rows, pmap), ratio, below: rows.length - healthy };
  }).sort((a, b) => b.value - a.value);

  return {
    centreCount: centres.length,
    totalValue,
    units: balances.reduce((s, b) => s + b.onHand, 0),
    skuPairs: balances.length,
    health,
    healthyRatio: balances.length ? health.healthy / balances.length : 0,
    valueSpark: stockValue,
    valueChange: stockValue.at(-2) ? totalValue / stockValue.at(-2)! - 1 : 0,
    unitsSpark: consumption.map((c) => c.units),
    trend: [
      { key: "value", label: "Stock value", kind: "trend" as const, data: stockValue.map((v, i) => ({ label: monthLabel(periods[i]!), a: v, b: consumption[i]!.value })), format: "money" as const, aName: "Month-end stock value", bName: "Consumed that month" },
      { key: "units", label: "Units used", kind: "column" as const, data: consumption.map((c) => ({ label: c.label, a: c.units })), format: "count" as const, aName: "Units consumed" },
    ],
    categories: categories.map((cat) => {
      const value = valuation(balances.filter((b) => pmap.get(b.productId)!.categoryId === cat.id), pmap);
      return { label: cat.name, value, tone: cat.color as Tone, display: moneyCompact(value) };
    }).sort((a, b) => b.value - a.value),
    centres: centreRows.map(({ c, value, ratio, below }) => ({
      id: c.id, title: c.name, sub: `${c.city} · ${below} SKU${below === 1 ? "" : "s"} at or below reorder`, value: moneyCompact(value),
      badge: { label: `${percent(ratio)} healthy`, tone: healthTone(ratio) }, href: `/inventory/centres/${c.id}`,
    })),
    movers: movers.map(({ p, now, before }) => {
      const change = before ? now / before - 1 : 0;
      return {
        id: p.id, title: p.name, sub: `${count(now)} used · ${moneyCompact(now * p.unitCost)}`, href: `/inventory/catalogue?q=${p.sku}`,
        badge: { label: before ? `${change >= 0 ? "+" : "−"}${percent(Math.abs(change))}` : "New", tone: (change > 0.15 ? "orange" : "neutral") as Tone },
      };
    }),
  };
}
