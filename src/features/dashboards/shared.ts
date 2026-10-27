import type { Centre, MonthlyRequest, Product, StockBalance, StockMovement } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { CellState, CentreSummary } from "@/components/dashboard/inventory";
import type { Tone } from "@/components/ui/badge";
import { count, moneyCompact, monthLabel } from "@/lib/format";
import { period } from "@/lib/data/seed";

export const CENTRE_TONES: Tone[] = ["blue", "orange", "green", "violet", "amber"];

/** critical ≤ half the reorder point < low ≤ reorder point < healthy */
export function stockState(onHand: number, reorderPoint: number): Exclude<CellState, "incoming"> {
  if (onHand <= Math.floor(reorderPoint / 2)) return "critical";
  if (onHand <= reorderPoint) return "low";
  return "healthy";
}

export const indexBy = <T, K extends keyof T>(rows: T[], key: K) => new Map(rows.map((r) => [r[key] as unknown as string, r]));

export function valuation(balances: StockBalance[], products: Map<string, Product>) {
  return balances.reduce((s, b) => s + b.onHand * (products.get(b.productId)?.unitCost ?? 0), 0);
}

/** Last `months` periods, oldest first, including the current month. */
export function lastPeriods(today: Date, months: number) {
  return Array.from({ length: months }, (_, i) => period(new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1)));
}

/** Consumption value (paise) and units per month. */
export function consumptionSeries(movements: StockMovement[], products: Map<string, Product>, today: Date, months = 12) {
  const periods = lastPeriods(today, months);
  const byPeriod = new Map(periods.map((p) => [p, { value: 0, units: 0 }]));
  for (const m of movements) {
    if (m.type !== "consumption") continue;
    const bucket = byPeriod.get(m.occurredAt.slice(0, 7));
    if (!bucket) continue;
    bucket.units += m.quantity;
    bucket.value += m.quantity * (products.get(m.productId)?.unitCost ?? 0);
  }
  return periods.map((p) => ({ period: p, label: monthLabel(p), ...byPeriod.get(p)! }));
}

export function lowStock(balances: StockBalance[], products: Map<string, Product>) {
  return balances
    .map((b) => {
      const p = products.get(b.productId)!;
      return { balance: b, product: p, state: stockState(b.onHand, p.reorderPoint) };
    })
    .filter((x) => x.state !== "healthy")
    .sort((a, b) => a.balance.onHand / a.product.reorderPoint - b.balance.onHand / b.product.reorderPoint);
}

export async function centreSummaries(repo: Repository, centres: Centre[]): Promise<CentreSummary[]> {
  const [balances, products] = await Promise.all([repo.balances(), repo.products()]);
  const pmap = indexBy(products, "id");
  return centres.map((c, i) => {
    const rows = balances.filter((b) => b.centreId === c.id);
    const cells = rows.map((b) => {
      const p = pmap.get(b.productId)!;
      return { productId: p.id, name: p.name, categoryId: p.categoryId, onHand: b.onHand, state: stockState(b.onHand, p.reorderPoint) };
    });
    const attention = lowStock(rows, pmap).slice(0, 3);
    return {
      id: c.id, code: c.code, name: c.name, city: c.city, tone: CENTRE_TONES[i % CENTRE_TONES.length]!,
      cells,
      stockValue: moneyCompact(valuation(rows, pmap)),
      units: count(rows.reduce((s, b) => s + b.onHand, 0)),
      skus: rows.length,
      topItems: attention.map((a) => ({
        id: `${c.id}-${a.product.id}`, title: a.product.name, sub: `${a.balance.onHand} on hand · reorder at ${a.product.reorderPoint}`,
        badge: a.state === "critical" ? { label: "Critical", tone: "red" as const } : { label: "Low", tone: "amber" as const },
      })),
    };
  });
}

export const REQUEST_STATUS: Record<MonthlyRequest["status"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "blue" },
  revision_requested: { label: "Needs revision", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  ordered: { label: "Ordered", tone: "violet" },
  fulfilled: { label: "Fulfilled", tone: "slate" },
};

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const firstName = (name: string) => name.split(" ")[0] ?? name;

export const dateEyebrow = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

/** Fractional hour of an ISO time, in the server's locale time. */
export const hourOf = (iso: string) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
