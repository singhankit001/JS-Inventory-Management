import type { GoodsReceiptLine, ID, Invoice, Paise, Payment, PurchaseOrderLine } from "@/domain/types";
import { ageingBucket } from "@/features/dashboards/finance";

export { AGEING, ageingBucket, type AgeingKey } from "@/features/dashboards/finance";

/** Whole calendar days past due (negative = days until due). Same day-counting as `ageingBucket`. */
export function daysPastDue(dueAt: string, today: Date) {
  const due = new Date(dueAt);
  return Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())) / 86_400_000);
}

export const isOverdue = (i: Pick<Invoice, "dueAt" | "status">, today: Date) => i.status !== "paid" && ageingBucket(i.dueAt, today) !== "current";

export interface MatchLine {
  id: ID; productId: ID; orderedQty: number; unitPrice: Paise;
  /** Good units = received − damaged, across every receipt for the line. */
  receivedQty: number; damagedQty: number;
  /** What the line may be billed at: good units × PO price. */
  billable: Paise;
  flag: "ok" | "short" | "over" | "damaged" | "not_received";
}

/**
 * Three-way match inputs per PO line: ordered (PO) vs good units received (GRN lines) at PO price. Invoices carry only a
 * billed total, so the billed side is compared at invoice level: variance = billed − Σ billable.
 * shortcut: line-level billed quantities arrive with Document Intelligence (invoice OCR); until then the seed's
 * Invoice.match is the authoritative match result and this table explains it.
 */
export function threeWayMatch(lines: PurchaseOrderLine[], receiptLines: GoodsReceiptLine[], billed: Paise) {
  const rows: MatchLine[] = lines.map((l) => {
    const rl = receiptLines.filter((r) => r.purchaseOrderLineId === l.id);
    const received = rl.reduce((s, r) => s + r.receivedQty, 0);
    const damaged = rl.reduce((s, r) => s + r.damagedQty, 0);
    const good = received - damaged;
    const flag: MatchLine["flag"] = !rl.length ? "not_received" : damaged > 0 ? "damaged" : good < l.quantity ? "short" : good > l.quantity ? "over" : "ok";
    return { id: l.id, productId: l.productId, orderedQty: l.quantity, unitPrice: l.unitPrice, receivedQty: good, damagedQty: damaged, billable: good * l.unitPrice, flag };
  });
  const poTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const billable = rows.reduce((s, r) => s + r.billable, 0);
  return { rows, poTotal, billable, billed, variance: billed - billable };
}

export interface ReconException { invoiceId: ID; kind: "short_paid" | "over_paid" | "paid_without_payment" | "unmatched"; delta: Paise }

/** Paid invoices whose payments do not add up to the billed amount, plus open invoices with no goods receipt to match. */
export function reconciliationExceptions(invoices: Invoice[], payments: Payment[]): ReconException[] {
  const paid = new Map<ID, number>();
  for (const p of payments) paid.set(p.invoiceId, (paid.get(p.invoiceId) ?? 0) + p.amount);
  return invoices.flatMap((i): ReconException[] => {
    const p = paid.get(i.id) ?? 0;
    if (i.status === "paid" && !paid.has(i.id)) return [{ invoiceId: i.id, kind: "paid_without_payment", delta: i.amount }];
    if (i.status === "paid" && p !== i.amount) return [{ invoiceId: i.id, kind: p < i.amount ? "short_paid" : "over_paid", delta: p - i.amount }];
    if (i.status !== "paid" && i.match === "unmatched") return [{ invoiceId: i.id, kind: "unmatched", delta: 0 }];
    return [];
  });
}

export const RECON_LABEL: Record<ReconException["kind"], string> = {
  short_paid: "Paid less than billed", over_paid: "Paid more than billed", paid_without_payment: "Marked paid, no payment", unmatched: "No goods receipt",
};
