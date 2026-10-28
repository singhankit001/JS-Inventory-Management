import type { GoodsReceiptLine } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Row } from "@/components/data/data-table";
import type { Tone } from "@/components/ui/badge";
import { indexBy } from "@/features/dashboards/shared";
import { loadReceiving, RECEIPT_STATUS } from "@/features/dashboards/receiving";
import { centreHref, poHref, productHref, receiptHref, supplierHref } from "@/features/procurement/shared";
import { shortDate, time } from "@/lib/format";

/** Per counted line: units short of / over what was outstanding on arrival, and damaged. */
export const lineIssues = (l: Pick<GoodsReceiptLine, "orderedQty" | "receivedQty" | "damagedQty">) => ({
  short: Math.max(0, l.orderedQty - l.receivedQty), over: Math.max(0, l.receivedQty - l.orderedQty), damaged: l.damagedQty,
});

export function lineVerdict(l: Pick<GoodsReceiptLine, "orderedQty" | "receivedQty" | "damagedQty">): { label: string; tone: Tone } {
  const x = lineIssues(l);
  const parts = [x.short && `${x.short} short`, x.over && `${x.over} over`, x.damaged && `${x.damaged} damaged`].filter(Boolean);
  return parts.length ? { label: parts.join(", "), tone: x.damaged || x.short ? "amber" : "violet" } : { label: "Matches", tone: "green" };
}

export const receiptNumber = (id: string) => id.toUpperCase();

export async function loadReceipts(repo: Repository, opts: { receipt?: string; record?: string; canRecord: boolean }) {
  const [receipts, rLines, pos, suppliers, centres, products, users, uoms] = await Promise.all([
    repo.receipts(), repo.receiptLines(), repo.purchaseOrders(), repo.suppliers(), repo.centres(), repo.products(), repo.users(), repo.uoms(),
  ]);
  const pomap = indexBy(pos, "id"), smap = indexBy(suppliers, "id"), cmap = indexBy(centres, "id"), pmap = indexBy(products, "id"), umap = indexBy(users, "id"), uommap = indexBy(uoms, "id");
  const linesOf = new Map<string, GoodsReceiptLine[]>();
  for (const l of rLines) linesOf.set(l.receiptId, [...(linesOf.get(l.receiptId) ?? []), l]);
  const sorted = [...receipts].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const rows: Row[] = sorted.map((r) => {
    const po = pomap.get(r.purchaseOrderId);
    const short = (linesOf.get(r.id) ?? []).reduce((s, l) => s + lineIssues(l).short, 0);
    return {
      id: r.id, receipt: { label: receiptNumber(r.id), href: receiptHref(r.id) }, date: r.receivedAt,
      po: po ? { label: po.number, href: poHref(po.id) } : r.purchaseOrderId,
      supplier: po ? smap.get(po.supplierId)?.name ?? po.supplierId : "—", centre: cmap.get(r.centreId)?.name ?? r.centreId,
      status: RECEIPT_STATUS[r.status], ordered: r.orderedQty, received: r.receivedQty, damaged: r.damagedQty, short,
    };
  });

  const r = opts.receipt ? receipts.find((x) => x.id === opts.receipt) : undefined;
  const detail = r && (() => {
    const po = pomap.get(r.purchaseOrderId);
    return {
      id: r.id, number: receiptNumber(r.id), status: RECEIPT_STATUS[r.status], when: `${shortDate(r.receivedAt)}, ${time(r.receivedAt)}`,
      receivedBy: umap.get(r.receivedBy)?.name ?? "Unknown user",
      po: po ? { label: po.number, href: poHref(po.id) } : undefined,
      supplier: po ? { label: smap.get(po.supplierId)?.name ?? po.supplierId, href: supplierHref(po.supplierId) } : undefined,
      centre: { label: cmap.get(r.centreId)?.name ?? r.centreId, href: centreHref(r.centreId) },
      totals: { ordered: r.orderedQty, received: r.receivedQty, damaged: r.damagedQty },
      lines: (linesOf.get(r.id) ?? []).map((l) => {
        const p = pmap.get(l.productId);
        return { id: l.id, product: p?.name ?? l.productId, href: p ? productHref(p.sku) : undefined, uom: uommap.get(p?.uomId ?? "")?.code ?? "", ordered: l.orderedQty, received: l.receivedQty, damaged: l.damagedQty, verdict: lineVerdict(l) };
      }),
    };
  })();

  // The item-level form takes every receivable PO; a PO picked from Deliveries is listed first.
  const options = opts.canRecord && opts.record ? (await loadReceiving(repo)).options.sort((a, b) => Number(b.id === opts.record) - Number(a.id === opts.record)) : undefined;
  const picked = options?.find((o) => o.id === opts.record);

  return {
    rows, detail, options, picked: picked?.label,
    counts: { total: receipts.length, discrepancy: receipts.filter((x) => x.status === "discrepancy").length, pending: receipts.filter((x) => x.status === "pending_confirmation").length },
  };
}

export type ReceiptDetail = NonNullable<Awaited<ReturnType<typeof loadReceipts>>["detail"]>;
