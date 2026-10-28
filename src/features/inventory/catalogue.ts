import type { Repository } from "@/lib/data/provider";
import type { SupplierQuotation } from "@/domain/types";
import type { Tone } from "@/components/ui/badge";
import type { Row } from "@/components/data/data-table";
import { consumptionSeries, indexBy, stockState } from "@/features/dashboards/shared";
import { count, money, shortDate } from "@/lib/format";
import { STATE_BADGE } from "./stock";

const QUOTE_STATUS: Record<SupplierQuotation["status"], { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "neutral" }, received: { label: "Received", tone: "blue" }, accepted: { label: "Accepted", tone: "green" }, declined: { label: "Declined", tone: "slate" },
};

export interface ProductDetail {
  id: string; sku: string; name: string; category: string; uom: string; unitCost: string; reorderPoint: number; status: string;
  totalOnHand: number; centresBelow: number;
  stock: { centreId: string; centre: string; onHand: number; state: { label: string; tone: Tone } }[];
  quotes: { id: string; supplierId: string; supplier: string; price: string; validUntil: string; expired: boolean; status: { label: string; tone: Tone } }[];
  usage: number[]; usageLabel: string;
}

export async function loadCatalogue(repo: Repository) {
  const today = repo.today();
  const [products, categories, uoms, quotations, suppliers, balances, movements, centres] = await Promise.all([
    repo.products(), repo.categories(), repo.uoms(), repo.quotations(), repo.suppliers(), repo.balances(), repo.movements(), repo.centres(),
  ]);
  const cats = indexBy(categories, "id"), units = indexBy(uoms, "id"), sups = indexBy(suppliers, "id"), cmap = indexBy(centres, "id");
  const todayIso = today.toISOString();
  // A quote can be bought against only once received/accepted and still valid.
  const usable = (q: SupplierQuotation) => (q.status === "received" || q.status === "accepted") && q.validUntil >= todayIso;

  const details: ProductDetail[] = products.map((p) => {
    const rows = balances.filter((b) => b.productId === p.id);
    const quotes = quotations.filter((q) => q.productId === p.id).sort((a, b) => a.unitPrice - b.unitPrice);
    const usage = consumptionSeries(movements.filter((m) => m.productId === p.id), new Map([[p.id, p]]), today, 12);
    return {
      id: p.id, sku: p.sku, name: p.name, category: cats.get(p.categoryId)?.name ?? "—", uom: units.get(p.uomId)?.name ?? p.uomId,
      unitCost: money(p.unitCost), reorderPoint: p.reorderPoint, status: p.status,
      totalOnHand: rows.reduce((s, b) => s + b.onHand, 0),
      centresBelow: rows.filter((b) => b.onHand <= p.reorderPoint).length,
      stock: rows.map((b) => ({ centreId: b.centreId, centre: cmap.get(b.centreId)?.name ?? b.centreId, onHand: b.onHand, state: STATE_BADGE[stockState(b.onHand, p.reorderPoint)] }))
        .sort((a, b) => a.onHand - b.onHand),
      quotes: quotes.map((q) => ({
        id: q.id, supplierId: q.supplierId, supplier: sups.get(q.supplierId)?.name ?? q.supplierId, price: money(q.unitPrice),
        validUntil: shortDate(q.validUntil), expired: q.validUntil < todayIso, status: QUOTE_STATUS[q.status],
      })),
      usage: usage.map((u) => u.units),
      usageLabel: `${count(usage.reduce((s, u) => s + u.units, 0))} used in 12 months`,
    };
  });

  const rows: Row[] = products.map((p) => {
    const best = quotations.filter((q) => q.productId === p.id && usable(q)).sort((a, b) => a.unitPrice - b.unitPrice)[0];
    return {
      id: p.id,
      sku: p.sku,
      name: { label: p.name, href: `/inventory/catalogue?product=${p.id}` },
      category: cats.get(p.categoryId)?.name ?? "—",
      uom: units.get(p.uomId)?.code ?? p.uomId,
      unitCost: p.unitCost,
      reorder: p.reorderPoint,
      status: p.status === "active" ? { label: "Active", tone: "green" } : { label: "Discontinued", tone: "neutral" },
      bestQuote: best?.unitPrice ?? null,
    };
  });

  return { rows, details, active: products.filter((p) => p.status === "active").length, categories: categories.length, quoted: rows.filter((r) => r.bestQuote !== null).length };
}
