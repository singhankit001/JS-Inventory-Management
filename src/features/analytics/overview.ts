import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { consumptionSeries, indexBy, lastPeriods } from "@/features/dashboards/shared";
import { moneyCompact, monthLabel, percent } from "@/lib/format";

export const centreHref = (id: string) => `/inventory/centres/${id}`;

export async function loadAnalyticsOverview(repo: Repository) {
  const today = repo.today();
  const [centres, budgets, movements, products, categories] = await Promise.all([repo.centres(), repo.budgets(), repo.movements(), repo.products(), repo.categories()]);
  const pmap = indexBy(products, "id");
  const periods = lastPeriods(today, 12);
  const inWindow = new Set(periods);
  const thisPeriod = periods.at(-1)!;
  const sumBy = (p: string, f: (b: (typeof budgets)[number]) => number) => budgets.filter((b) => b.period === p).reduce((s, b) => s + f(b), 0);
  const spend = periods.map((p) => sumBy(p, (b) => b.spent));
  const alloc = periods.map((p) => sumBy(p, (b) => b.allocated));
  const consumption = consumptionSeries(movements, pmap, today, 12);
  const best = spend.slice(0, -1).reduce((bi, v, i, xs) => (v > xs[bi]! ? i : bi), 0);
  const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  // Centre-months within allocation, completed months only (the current month is still filling up).
  const closed = budgets.filter((b) => inWindow.has(b.period) && b.period !== thisPeriod);
  const within = closed.filter((b) => b.spent <= b.allocated).length;

  const consumedBy = new Map<string, number>(), consumedCat = new Map<string, number>(), consumedProduct = new Map<string, { units: number; value: number }>();
  for (const m of movements) {
    if (m.type !== "consumption" || !inWindow.has(m.occurredAt.slice(0, 7))) continue;
    const p = pmap.get(m.productId);
    const v = m.quantity * (p?.unitCost ?? 0);
    consumedBy.set(m.centreId, (consumedBy.get(m.centreId) ?? 0) + v);
    if (p) consumedCat.set(p.categoryId, (consumedCat.get(p.categoryId) ?? 0) + v);
    const row = consumedProduct.get(m.productId) ?? { units: 0, value: 0 };
    row.units += m.quantity; row.value += v;
    consumedProduct.set(m.productId, row);
  }

  const centreRows = centres.map((c) => {
    const bs = budgets.filter((b) => b.centreId === c.id && inWindow.has(b.period));
    const spent = bs.reduce((s, b) => s + b.spent, 0), allocated = bs.reduce((s, b) => s + b.allocated, 0);
    return { c, spent, allocated, ratio: allocated ? spent / allocated : 0, consumed: consumedBy.get(c.id) ?? 0 };
  }).sort((a, b) => b.ratio - a.ratio);

  return {
    kpis: {
      spend: total(spend), bestLabel: `${monthLabel(periods[best]!)} ${moneyCompact(spend[best]!)}`,
      consumed: total(consumption.map((x) => x.value)), units: total(consumption.map((x) => x.units)),
      monthUse: alloc.at(-1) ? spend.at(-1)! / alloc.at(-1)! : 0, monthSpend: spend.at(-1)!,
      yearUse: total(alloc) ? total(spend) / total(alloc) : 0, spark: spend,
    },
    views: {
      spend: periods.map((p, i) => ({ label: monthLabel(p), a: spend[i]!, b: alloc[i]! })),
      consumption: consumption.map((x) => ({ label: x.label, a: x.value })),
      units: consumption.map((x) => ({ label: x.label, a: x.units })),
    },
    onBudget: { value: closed.length ? within / closed.length : 1, within, total: closed.length },
    centreBars: centreRows.slice(0, 8).map((r) => ({
      label: r.c.name, sub: `${percent(r.ratio)} of allocation`, value: r.spent, marker: r.allocated, display: moneyCompact(r.spent), tone: (r.ratio > 1 ? "orange" : "blue") as Tone,
    })),
    categories: categories.map((c) => ({ label: c.name, tone: c.color as Tone, value: consumedCat.get(c.id) ?? 0, display: moneyCompact(consumedCat.get(c.id) ?? 0) })).filter((s) => s.value > 0).sort((a, b) => b.value - a.value),
    topProducts: [...consumedProduct.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 6).map(([id, r]) => ({
      id, title: pmap.get(id)?.name ?? id, sub: `${r.units.toLocaleString("en-IN")} units in 12 months`, value: moneyCompact(r.value), href: `/inventory/catalogue?q=${pmap.get(id)?.sku ?? ""}`,
    })),
    centreTable: centreRows.map((r) => ({
      id: r.c.id, centre: { label: r.c.name, href: centreHref(r.c.id) }, city: r.c.city, spent: r.spent, avg: Math.round(r.spent / 12), budget: r.c.monthlyBudget,
      use: { label: percent(r.ratio), tone: (r.ratio > 1 ? "orange" : r.ratio > 0.9 ? "amber" : "green") as Tone }, consumed: r.consumed,
    })),
  };
}
