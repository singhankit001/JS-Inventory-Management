import type { GoodsReceipt, PurchaseOrder } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { hourOf, indexBy } from "./shared";
import { count, shortDate, time } from "@/lib/format";

// shortcut: Phase 1 POs carry no line items, so ordered units are estimated at ₹500 a unit; Phase 2 reads PO lines.
export const orderedUnits = (po: Pick<PurchaseOrder, "total">) => Math.max(1, Math.round(po.total / 500_00));

/** Any shortfall, surplus or damage flags a discrepancy; the PO stays open until every good unit has arrived. */
export function receiptOutcome(ordered: number, received: number, damaged: number) {
  const status: GoodsReceipt["status"] = received !== ordered || damaged > 0 ? "discrepancy" : "confirmed";
  const poStatus: PurchaseOrder["status"] = received - damaged >= ordered ? "received" : "partially_received";
  return { status, poStatus, short: Math.max(0, ordered - received), over: Math.max(0, received - ordered) };
}

export const RECEIPT_STATUS: Record<GoodsReceipt["status"], { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed", tone: "green" },
  discrepancy: { label: "Discrepancy", tone: "amber" },
  pending_confirmation: { label: "Pending", tone: "blue" },
};

/** Whole days from `today` (local midnight) to the calendar day of `iso`. Negative = past. */
export const dayOffset = (iso: string, today: Date) => Math.round((new Date(new Date(iso).toDateString()).getTime() - today.getTime()) / 86_400_000);

export function deliveryBadge(offset: number): { label: string; tone: Tone } {
  if (offset < 0) return { label: `${-offset}d overdue`, tone: "red" };
  if (offset === 0) return { label: "Today", tone: "blue" };
  return { label: offset === 1 ? "Tomorrow" : `In ${offset} days`, tone: "neutral" };
}

export async function loadReceiving(repo: Repository) {
  const today = repo.today();
  const [centres, pos, receipts, suppliers] = await Promise.all([repo.centres(), repo.purchaseOrders(), repo.receipts(), repo.suppliers()]);
  const smap = indexBy(suppliers, "id");
  const cmap = indexBy(centres, "id");
  const pomap = indexBy(pos, "id");
  const multiCentre = centres.length > 1;
  const where = (centreId: string) => (multiCentre ? `${cmap.get(centreId)?.name} · ` : "");

  const expected = pos.filter((p) => p.status === "issued").sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
  const off = (p: PurchaseOrder) => dayOffset(p.expectedAt, today);
  const overdue = expected.filter((p) => off(p) < 0);
  const dueToday = expected.filter((p) => off(p) === 0);
  const thisWeek = expected.filter((p) => off(p) >= 0 && off(p) <= 6);

  const sorted = [...receipts].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const recent = sorted.filter((r) => dayOffset(r.receivedAt, today) >= -30);
  const decided = recent.filter((r) => r.status !== "pending_confirmation");
  const clean = decided.filter((r) => r.status === "confirmed").length;
  const shortOf = (r: GoodsReceipt) => Math.max(0, r.orderedQty - r.receivedQty);
  const short = recent.reduce((s, r) => s + shortOf(r), 0);
  const damaged = recent.reduce((s, r) => s + r.damagedQty, 0);
  const receiptsToday = sorted.filter((r) => dayOffset(r.receivedAt, today) === 0);
  const last14 = Array.from({ length: 14 }, (_, i) => i - 13);

  const bySupplier = new Map<string, { short: number; damaged: number; receipts: number }>();
  for (const r of recent) {
    const sid = pomap.get(r.purchaseOrderId)?.supplierId;
    if (!sid) continue;
    const row = bySupplier.get(sid) ?? { short: 0, damaged: 0, receipts: 0 };
    row.short += shortOf(r);
    row.damaged += r.damagedQty;
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
      issuesSpark: last14.map((d) => sorted.filter((r) => dayOffset(r.receivedAt, today) === d).reduce((s, r) => s + shortOf(r) + r.damagedQty, 0)),
    },
    week: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return { key: d.toDateString(), weekday: d.toLocaleDateString("en-IN", { weekday: "short" }), day: d.getDate(), count: thisWeek.filter((p) => off(p) === i).length };
    }),
    schedule: [...overdue, ...thisWeek].map((p) => ({
      id: p.id, title: `${p.number} · ${supplierName(p)}`, sub: `${where(p.centreId)}${shortDate(p.expectedAt)}, ${time(p.expectedAt)} · ~${count(orderedUnits(p))} units`, badge: deliveryBadge(off(p)),
    })),
    later: expected.length - overdue.length - thisWeek.length,
    receipts: sorted.slice(0, 6).map((r) => {
      const po = pomap.get(r.purchaseOrderId);
      const detail = [shortOf(r) && `${shortOf(r)} short`, r.damagedQty && `${r.damagedQty} damaged`].filter(Boolean).join(", ");
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
    options: expected.map((p) => ({
      id: p.id, label: `${p.number} · ${supplierName(p)}`, centre: cmap.get(p.centreId)?.name ?? "", expected: shortDate(p.expectedAt), overdue: off(p) < 0, ordered: orderedUnits(p),
    })),
  };
}

export type ReceivingData = Awaited<ReturnType<typeof loadReceiving>>;
