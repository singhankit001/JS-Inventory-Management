import type { Repository } from "@/lib/data/provider";
import type { StockMovement } from "@/domain/types";
import type { Row } from "@/components/data/data-table";
import { indexBy } from "@/features/dashboards/shared";
import { MOVEMENT_TYPE, signedQty } from "./stock";

export const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type RangeKey = keyof typeof RANGES;
/** Rows sent to the browser. Totals always cover every matching movement. */
export const ROW_CAP = 600;

export interface LedgerQuery { range?: string; q?: string; f_type?: string; f_centre?: string; f_category?: string }

/**
 * The ledger is filtered and aggregated here, not in the browser: ~38k seed movements would be too heavy to ship.
 * Filters arrive as the table's own URL params (labels, e.g. f_type=Receipt) so a shared or reloaded link matches the server.
 */
export async function loadMovements(repo: Repository, query: LedgerQuery) {
  const today = repo.today();
  const range: RangeKey = query.range && query.range in RANGES ? (query.range as RangeKey) : "30d";
  const [movements, products, categories, centres] = await Promise.all([repo.movements(), repo.products(), repo.categories(), repo.centres()]);
  const pmap = indexBy(products, "id"), cats = indexBy(categories, "id"), cmap = indexBy(centres, "id");
  const from = new Date(today.getTime() - (RANGES[range] - 1) * 86_400_000).toISOString();
  const q = query.q?.trim().toLowerCase();

  const matches = movements.filter((m) => {
    if (m.occurredAt < from) return false;
    const p = pmap.get(m.productId)!;
    if (query.f_type && MOVEMENT_TYPE[m.type].label !== query.f_type) return false;
    if (query.f_centre && cmap.get(m.centreId)?.name !== query.f_centre) return false;
    if (query.f_category && cats.get(p.categoryId)?.name !== query.f_category) return false;
    return !q || [p.name, p.sku, cmap.get(m.centreId)?.name ?? "", m.reference ?? "", MOVEMENT_TYPE[m.type].label].some((s) => s.toLowerCase().includes(q));
  });

  const totals = summarise(matches, (id) => pmap.get(id)?.unitCost ?? 0);
  const latest = [...matches].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, ROW_CAP);

  const rows: Row[] = latest.map((m) => {
    const p = pmap.get(m.productId)!;
    const qty = signedQty(m);
    return {
      id: m.id,
      at: m.occurredAt,
      type: MOVEMENT_TYPE[m.type],
      product: { label: p.name, href: `/inventory/catalogue?q=${p.sku}` },
      category: cats.get(p.categoryId)?.name ?? "—",
      centre: { label: cmap.get(m.centreId)?.name ?? m.centreId, href: `/inventory/centres/${m.centreId}` },
      qty,
      value: qty * p.unitCost,
      reference: m.reference?.startsWith("gr-") ? { label: m.reference, href: `/receiving/receipts?q=${m.reference}` } : m.reference?.startsWith("count-") ? `Stock count ${m.reference.slice(6).replace("-", " · ")}` : m.reference ?? null,
    };
  });

  return { range, rows, matched: matches.length, capped: matches.length > ROW_CAP, totals, from };
}

/** Units and value per movement group, signed by their effect on stock. Value at current unit cost. */
export function summarise(movements: StockMovement[], unitCost: (productId: string) => number) {
  const groups = { receipt: { units: 0, value: 0, n: 0 }, consumption: { units: 0, value: 0, n: 0 }, adjustment: { units: 0, value: 0, n: 0 }, transfer: { units: 0, value: 0, n: 0 } };
  for (const m of movements) {
    const g = groups[m.type === "transfer_in" || m.type === "transfer_out" ? "transfer" : m.type];
    const q = signedQty(m);
    g.units += q; g.value += q * unitCost(m.productId); g.n++;
  }
  const all = Object.values(groups);
  return { ...groups, net: { units: all.reduce((s, g) => s + g.units, 0), value: all.reduce((s, g) => s + g.value, 0), n: movements.length } };
}
