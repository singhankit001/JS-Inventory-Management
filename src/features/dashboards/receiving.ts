import type { GoodsReceipt, GoodsReceiptLine, PurchaseOrder } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { dayOffset, hourOf, indexBy, poOutstanding } from "./shared";
import { count, shortDate, time } from "@/lib/format";

/**
 * Over-delivery tolerance: a line may accept up to 10% more than is outstanding (rounded up, so 1 extra unit on small
 * lines), and nothing once it is complete. Beyond that the surplus goes back with the driver.
 */
export const maxReceivable = (outstanding: number) => outstanding + Math.ceil(outstanding * 0.1);

export interface LineCount { outstanding: number; receivedQty: number; damagedQty: number }

/** Why one counted line cannot be saved, or undefined when it is valid. Shared by the form and the server. */
export function lineError({ outstanding, receivedQty, damagedQty }: LineCount): string | undefined {
  if (![receivedQty, damagedQty].every((n) => Number.isInteger(n) && n >= 0)) return "Enter whole numbers of 0 or more";
  if (damagedQty > receivedQty) return "Damaged cannot exceed received";
  if (receivedQty > maxReceivable(outstanding)) return `At most ${maxReceivable(outstanding)} can be accepted (10% over-delivery)`;
}

/**
 * Outcome of one delivery, counted line by line against what each line still owes. Any shortfall, surplus or damage
 * flags a discrepancy; the PO closes only when no line still owes good units (damaged units stay owed until replaced).
 * `lines` must cover every line with something outstanding — the server enforces that.
 */
export function receiptOutcome(lines: LineCount[]) {
  const per = lines.map((l) => ({
    short: Math.max(0, l.outstanding - l.receivedQty),
    over: Math.max(0, l.receivedQty - l.outstanding),
    damaged: l.damagedQty,
    remaining: Math.max(0, l.outstanding - (l.receivedQty - l.damagedQty)),
  }));
  const total = (f: (x: (typeof per)[number]) => number) => per.reduce((s, x) => s + f(x), 0);
  const status: GoodsReceipt["status"] = per.some((x) => x.short || x.over || x.damaged) ? "discrepancy" : "confirmed";
  const poStatus: PurchaseOrder["status"] = per.every((x) => x.remaining === 0) ? "received" : "partially_received";
  return {
    status, poStatus, lines: per,
    ordered: lines.reduce((s, l) => s + l.outstanding, 0), received: lines.reduce((s, l) => s + l.receivedQty, 0),
    short: total((x) => x.short), over: total((x) => x.over), damaged: total((x) => x.damaged), remaining: total((x) => x.remaining),
  };
}

/** Units short and damaged on one receipt, from its lines. */
export function receiptIssues(lines: GoodsReceiptLine[]) {
  return { short: lines.reduce((s, l) => s + Math.max(0, l.orderedQty - l.receivedQty), 0), damaged: lines.reduce((s, l) => s + l.damagedQty, 0) };
}

export const RECEIPT_STATUS: Record<GoodsReceipt["status"], { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed", tone: "green" },
  discrepancy: { label: "Discrepancy", tone: "amber" },
  pending_confirmation: { label: "Pending", tone: "blue" },
};

export { dayOffset };

export function deliveryBadge(offset: number): { label: string; tone: Tone } {
  if (offset < 0) return { label: `${-offset}d overdue`, tone: "red" };
  if (offset === 0) return { label: "Today", tone: "blue" };
  return { label: offset === 1 ? "Tomorrow" : `In ${offset} days`, tone: "neutral" };
}

export async function loadReceiving(repo: Repository) {
  const today = repo.today();
  const [centres, pos, receipts, suppliers, poLines, rLines, products, uoms] = await Promise.all([
    repo.centres(), repo.purchaseOrders(), repo.receipts(), repo.suppliers(), repo.purchaseOrderLines(), repo.receiptLines(), repo.products(), repo.uoms(),
  ]);
  const smap = indexBy(suppliers, "id");
  const cmap = indexBy(centres, "id");
  const pomap = indexBy(pos, "id");
  const pmap = indexBy(products, "id");
  const umap = indexBy(uoms, "id");
  const { owed, byPo } = poOutstanding(poLines, rLines);
  const linesByReceipt = new Map<string, GoodsReceiptLine[]>();
  for (const l of rLines) linesByReceipt.set(l.receiptId, [...(linesByReceipt.get(l.receiptId) ?? []), l]);
  const issuesOf = (r: GoodsReceipt) => receiptIssues(linesByReceipt.get(r.id) ?? []);
  const multiCentre = centres.length > 1;
  const where = (centreId: string) => (multiCentre ? `${cmap.get(centreId)?.name} · ` : "");

  const expected = pos.filter((p) => p.status === "issued").sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
  const off = (p: PurchaseOrder) => dayOffset(p.expectedAt, today);
  const overdue = expected.filter((p) => off(p) < 0);
  const dueToday = expected.filter((p) => off(p) === 0);
  const thisWeek = expected.filter((p) => off(p) >= 0 && off(p) <= 6);
  // Part-delivered orders can be received against too; their balance has no booked date.
  const receivable = [...expected, ...pos.filter((p) => p.status === "partially_received").sort((a, b) => a.expectedAt.localeCompare(b.expectedAt))];

  const sorted = [...receipts].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const recent = sorted.filter((r) => dayOffset(r.receivedAt, today) >= -30);
  const decided = recent.filter((r) => r.status !== "pending_confirmation");
  const clean = decided.filter((r) => r.status === "confirmed").length;
  const short = recent.reduce((s, r) => s + issuesOf(r).short, 0);
  const damaged = recent.reduce((s, r) => s + issuesOf(r).damaged, 0);
  const receiptsToday = sorted.filter((r) => dayOffset(r.receivedAt, today) === 0);
  const last14 = Array.from({ length: 14 }, (_, i) => i - 13);

  const bySupplier = new Map<string, { short: number; damaged: number; receipts: number }>();
  for (const r of recent) {
    const sid = pomap.get(r.purchaseOrderId)?.supplierId;
    if (!sid) continue;
    const row = bySupplier.get(sid) ?? { short: 0, damaged: 0, receipts: 0 };
    const x = issuesOf(r);
    row.short += x.short;
    row.damaged += x.damaged;
    row.receipts += 1;
    bySupplier.set(sid, row);
  }

  const supplierName = (p?: PurchaseOrder) => (p ? smap.get(p.supplierId)?.name ?? "Supplier" : "Unknown PO");

  return {
    centreLabel: multiCentre ? `${centres.length} centres` : centres[0]?.name ?? "No centre assigned",
    welcome: {
      dueToday: dueToday.length,
      week: thisWeek.length,
      overdue: overdue.length,
      events: [
        ...dueToday.map((p) => ({ id: p.id, hour: hourOf(p.expectedAt), label: `${p.number} due · ${supplierName(p)}`, tone: "blue" as Tone })),
        ...receiptsToday.map((r) => ({ id: r.id, hour: hourOf(r.receivedAt), label: `${pomap.get(r.purchaseOrderId)?.number ?? "PO"} received · ${RECEIPT_STATUS[r.status].label}`, tone: (r.status === "confirmed" ? "green" : "amber") as Tone })),
      ],
      nowHour: new Date().getHours() + new Date().getMinutes() / 60,
    },
    accuracy: { rate: decided.length ? clean / decided.length : 1, receipts: recent.length, discrepancies: decided.length - clean, pending: recent.length - decided.length },
    kpis: {
      dueToday: dueToday.length,
      overdue: overdue.length,
      oldestOverdue: overdue.length ? -off(overdue[0]!) : 0,
      receipts14: last14.reduce((s, d) => s + sorted.filter((r) => dayOffset(r.receivedAt, today) === d).length, 0),
      receiptsSpark: last14.map((d) => sorted.filter((r) => dayOffset(r.receivedAt, today) === d).length),
      receiptsToday: receiptsToday.length,
      issues: short + damaged,
      short,
      damaged,
      issuesSpark: last14.map((d) => sorted.filter((r) => dayOffset(r.receivedAt, today) === d).reduce((s, r) => { const x = issuesOf(r); return s + x.short + x.damaged; }, 0)),
    },
    week: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return { key: d.toDateString(), weekday: d.toLocaleDateString("en-IN", { weekday: "short" }), day: d.getDate(), count: thisWeek.filter((p) => off(p) === i).length };
    }),
    schedule: [...overdue, ...thisWeek].map((p) => ({
      id: p.id, title: `${p.number} · ${supplierName(p)}`, sub: `${where(p.centreId)}${shortDate(p.expectedAt)}, ${time(p.expectedAt)} · ${count(byPo(p).units)} units`, badge: deliveryBadge(off(p)),
    })),
    later: expected.length - overdue.length - thisWeek.length,
    receipts: sorted.slice(0, 6).map((r) => {
      const po = pomap.get(r.purchaseOrderId);
      const x = issuesOf(r);
      const detail = [x.short && `${x.short} short`, x.damaged && `${x.damaged} damaged`].filter(Boolean).join(", ");
      return {
        id: r.id, title: `${po?.number ?? r.purchaseOrderId} · ${supplierName(po)}`,
        sub: `${where(r.centreId)}${count(r.receivedQty)} of ${count(r.orderedQty)} received${detail ? ` · ${detail}` : ""} · ${shortDate(r.receivedAt)}`,
        badge: RECEIPT_STATUS[r.status],
      };
    }),
    suppliers: [...bySupplier]
      .filter(([, v]) => v.short + v.damaged > 0)
      .sort((a, b) => b[1].short + b[1].damaged - (a[1].short + a[1].damaged))
      .map(([sid, v]) => ({ label: smap.get(sid)?.name ?? sid, sub: `${v.short} short · ${v.damaged} damaged`, value: v.short + v.damaged, display: `${v.short + v.damaged} units`, tone: "orange" as Tone })),
    options: receivable.map((p) => ({
      id: p.id, label: `${p.number} · ${supplierName(p)}`, centre: cmap.get(p.centreId)?.name ?? "", expected: shortDate(p.expectedAt),
      overdue: p.status === "issued" && off(p) < 0, partial: p.status === "partially_received",
      lines: poLines.filter((l) => l.purchaseOrderId === p.id && owed.get(l.id)! > 0).map((l) => {
        const product = pmap.get(l.productId);
        return { id: l.id, product: product?.name ?? l.productId, uom: umap.get(product?.uomId ?? "")?.code ?? "", ordered: l.quantity, outstanding: owed.get(l.id)! };
      }),
    })),
  };
}

export type ReceivingData = Awaited<ReturnType<typeof loadReceiving>>;
