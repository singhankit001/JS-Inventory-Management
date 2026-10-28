import type { GoodsReceipt, GoodsReceiptLine, PurchaseOrder } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Row } from "@/components/data/data-table";
import { dayOffset, indexBy, lastPeriods, outstandingByLine } from "@/features/dashboards/shared";
import { poHref, productHref, receiptHref, supplierHref } from "@/features/procurement/shared";
import { lineIssues } from "./receipts";
import { monthLabel } from "@/lib/format";

export interface Discrepancy { line: GoodsReceiptLine; receipt: GoodsReceipt; po: PurchaseOrder; short: number; over: number; damaged: number; open: boolean }

/**
 * Every counted line with a shortfall, surplus or damage. Short or damaged units stay open while the PO line still owes
 * good units (and the PO is live); a later delivery that makes them good resolves them. Over-deliveries within tolerance
 * were accepted at the door, so they are resolved on receipt.
 */
export function discrepancies(lines: GoodsReceiptLine[], receipts: GoodsReceipt[], pos: PurchaseOrder[], owed: Map<string, number>): Discrepancy[] {
  const rmap = indexBy(receipts, "id"), pomap = indexBy(pos, "id");
  return lines.flatMap((line) => {
    const x = lineIssues(line);
    const receipt = rmap.get(line.receiptId), po = receipt && pomap.get(receipt.purchaseOrderId);
    if (!receipt || !po || !(x.short || x.over || x.damaged)) return [];
    const open = (x.short > 0 || x.damaged > 0) && (owed.get(line.purchaseOrderLineId) ?? 0) > 0 && po.status !== "cancelled";
    return [{ line, receipt, po, ...x, open }];
  });
}

/** Totals, per-supplier units and a monthly trend (units short + over + damaged). */
export function aggregate(ds: Discrepancy[], today: Date, months = 6) {
  const sum = (f: (d: Discrepancy) => number) => ds.reduce((s, d) => s + f(d), 0);
  const bySupplier = new Map<string, { short: number; over: number; damaged: number; open: number }>();
  for (const d of ds) {
    const row = bySupplier.get(d.po.supplierId) ?? { short: 0, over: 0, damaged: 0, open: 0 };
    row.short += d.short; row.over += d.over; row.damaged += d.damaged; row.open += d.open ? 1 : 0;
    bySupplier.set(d.po.supplierId, row);
  }
  const trend = lastPeriods(today, months).map((p) => ({ label: monthLabel(p), value: ds.filter((d) => d.receipt.receivedAt.startsWith(p)).reduce((s, d) => s + d.short + d.over + d.damaged, 0) }));
  return { short: sum((d) => d.short), over: sum((d) => d.over), damaged: sum((d) => d.damaged), open: ds.filter((d) => d.open).length, resolved: ds.filter((d) => !d.open).length, bySupplier, trend };
}

export async function loadDiscrepancies(repo: Repository) {
  const today = repo.today();
  const [receipts, rLines, pos, poLines, suppliers, centres, products] = await Promise.all([repo.receipts(), repo.receiptLines(), repo.purchaseOrders(), repo.purchaseOrderLines(), repo.suppliers(), repo.centres(), repo.products()]);
  const smap = indexBy(suppliers, "id"), cmap = indexBy(centres, "id"), pmap = indexBy(products, "id");
  const recent = new Set(receipts.filter((r) => dayOffset(r.receivedAt, today) >= -180).map((r) => r.id));
  const ds = discrepancies(rLines.filter((l) => recent.has(l.receiptId)), receipts, pos, outstandingByLine(poLines, rLines))
    .sort((a, b) => Number(b.open) - Number(a.open) || b.receipt.receivedAt.localeCompare(a.receipt.receivedAt));
  const agg = aggregate(ds, today);

  const rows: Row[] = ds.map((d) => {
    const p = pmap.get(d.line.productId);
    const type = d.damaged ? "Damaged" : d.short ? "Short" : "Over";
    return {
      id: d.line.id, date: d.receipt.receivedAt, receipt: { label: d.receipt.id.toUpperCase(), href: receiptHref(d.receipt.id) }, po: { label: d.po.number, href: poHref(d.po.id) },
      supplier: { label: smap.get(d.po.supplierId)?.name ?? d.po.supplierId, href: supplierHref(d.po.supplierId) },
      centre: cmap.get(d.po.centreId)?.name ?? d.po.centreId,
      product: p ? { label: p.name, href: productHref(p.sku) } : d.line.productId,
      type: { label: [d.short && `${d.short} short`, d.over && `${d.over} over`, d.damaged && `${d.damaged} damaged`].filter(Boolean).join(", "), tone: type === "Over" ? "violet" : "amber" },
      kind: type, units: d.short + d.over + d.damaged,
      status: d.open ? { label: "Open", tone: "red" } : { label: "Resolved", tone: "green" },
    };
  });

  return {
    rows, totals: agg,
    suppliers: [...agg.bySupplier].sort((a, b) => (b[1].short + b[1].over + b[1].damaged) - (a[1].short + a[1].over + a[1].damaged)).map(([id, v]) => ({
      label: smap.get(id)?.name ?? id, sub: `${v.short} short · ${v.over} over · ${v.damaged} damaged${v.open ? ` · ${v.open} open` : ""}`,
      value: v.short + v.over + v.damaged, display: `${v.short + v.over + v.damaged} units`, tone: "orange" as const,
    })),
  };
}
