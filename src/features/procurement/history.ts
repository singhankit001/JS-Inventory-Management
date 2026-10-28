import type { Product, PurchaseOrder, PurchaseOrderLine } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Row } from "@/components/data/data-table";
import { indexBy, lastPeriods } from "@/features/dashboards/shared";
import { PO_STATUS, poHref } from "./shared";
import { money, moneyCompact, monthLabel } from "@/lib/format";

/** Orders that committed money: issued onwards (drafts, unauthorised and cancelled orders never did). */
export const committed = (p: PurchaseOrder) => p.status === "issued" || p.status === "partially_received" || p.status === "received";

/** Quantity-weighted average unit price per month for one product (0 = not ordered that month). */
export function priceTrend(lines: PurchaseOrderLine[], pos: Map<string, PurchaseOrder>, productId: string, periods: string[]) {
  return periods.map((period) => {
    const ls = lines.filter((l) => l.productId === productId && pos.get(l.purchaseOrderId)?.createdAt.startsWith(period));
    const qty = ls.reduce((s, l) => s + l.quantity, 0);
    return { period, value: qty ? Math.round(ls.reduce((s, l) => s + l.quantity * l.unitPrice, 0) / qty) : 0, qty };
  });
}

export async function loadHistory(repo: Repository, productParam?: string) {
  const today = repo.today();
  const [pos, lines, suppliers, centres, products, categories] = await Promise.all([repo.purchaseOrders(), repo.purchaseOrderLines(), repo.suppliers(), repo.centres(), repo.products(), repo.categories()]);
  const smap = indexBy(suppliers, "id"), cmap = indexBy(centres, "id"), pmap = indexBy(products, "id");
  const periods = lastPeriods(today, 12);
  const inWindow = pos.filter((p) => committed(p) && p.createdAt.slice(0, 7) >= periods[0]!);
  const pomap = indexBy(inWindow, "id");
  const wLines = lines.filter((l) => pomap.has(l.purchaseOrderId));
  const spend = inWindow.reduce((s, p) => s + p.total, 0);

  const bySupplier = new Map<string, number>();
  for (const p of inWindow) bySupplier.set(p.supplierId, (bySupplier.get(p.supplierId) ?? 0) + p.total);
  const byCategory = new Map<string, number>();
  for (const l of wLines) { const c = pmap.get(l.productId)?.categoryId ?? "?"; byCategory.set(c, (byCategory.get(c) ?? 0) + l.quantity * l.unitPrice); }
  const qtyOf = new Map<string, number>();
  for (const l of wLines) qtyOf.set(l.productId, (qtyOf.get(l.productId) ?? 0) + l.quantity);
  const product: Product | undefined = pmap.get(productParam ?? "") ?? pmap.get([...qtyOf].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "");
  const trend = product ? priceTrend(wLines, pomap, product.id, periods) : [];
  const priced = trend.filter((t) => t.qty);

  const rows: Row[] = [...inWindow].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => ({
    id: p.id, number: { label: p.number, href: poHref(p.id) }, date: p.createdAt, supplier: smap.get(p.supplierId)?.name ?? p.supplierId,
    centre: cmap.get(p.centreId)?.name ?? p.centreId, status: PO_STATUS[p.status], total: p.total, variance: p.priceVariance,
  }));

  return {
    headline: {
      spend: moneyCompact(spend), orders: inWindow.length, avg: moneyCompact(inWindow.length ? spend / inWindow.length : 0),
      variance: inWindow.reduce((s, p) => s + p.priceVariance, 0),
    },
    months: periods.map((period) => ({ label: monthLabel(period), value: inWindow.filter((p) => p.createdAt.startsWith(period)).reduce((s, p) => s + p.total, 0) })),
    suppliers: [...bySupplier].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ label: smap.get(id)?.name ?? id, value: v, display: moneyCompact(v), tone: "blue" as const })),
    categories: categories.filter((c) => byCategory.get(c.id)).map((c) => ({ label: c.name, value: byCategory.get(c.id)!, display: moneyCompact(byCategory.get(c.id)!), tone: c.color })).sort((a, b) => b.value - a.value),
    product: product && {
      id: product.id, name: product.name, list: money(product.unitCost),
      // Months with no order carry the previous price forward so the line does not dip to zero.
      trend: trend.map((t, i) => ({ label: monthLabel(t.period), a: t.value || trend.slice(0, i).reverse().find((x) => x.value)?.value || priced[0]?.value || 0, b: product.unitCost })),
      change: priced.length > 1 ? priced.at(-1)!.value / priced[0]!.value - 1 : 0,
    },
    products: products.filter((p) => qtyOf.has(p.id)).map((p) => ({ id: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label)),
    rows,
  };
}
