import type { GoodsReceipt, MonthlyRequest, PurchaseOrder, SupplierQuotation } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import { dayOffset, indexBy, lastPeriods, poOutstanding } from "@/features/dashboards/shared";
import { daysLate } from "@/features/dashboards/purchasing";
import { daysBetween, poHref } from "./shared";
import { monthLabel, moneyCompact, relative, shortDate } from "@/lib/format";

export interface StageItem { id: string; title: string; sub: string; href: string }
export interface Stage { key: string; label: string; hint: string; count: number; value: number | null; items: StageItem[]; href: string }

interface Names { centre: (id: string) => string; supplier: (id: string) => string; product: (id: string) => string; outstanding: (po: PurchaseOrder) => number }

/** Last receipt per PO — when a received order was completed. */
export function completedAt(receipts: Pick<GoodsReceipt, "purchaseOrderId" | "receivedAt">[]) {
  const last = new Map<string, string>();
  for (const r of receipts) if ((last.get(r.purchaseOrderId) ?? "") < r.receivedAt) last.set(r.purchaseOrderId, r.receivedAt);
  return last;
}

/**
 * Six stages from approved request to receipt. Counts and values are of what sits in each stage now; "received" keeps the
 * last 30 days. Items are the oldest (or soonest-expiring quotes) first, so the board shows what is stuck.
 */
export function pipelineStages({ requests, quotes, pos, receipts }: { requests: MonthlyRequest[]; quotes: SupplierQuotation[]; pos: PurchaseOrder[]; receipts: GoodsReceipt[] }, today: Date, n: Names): Stage[] {
  const done = completedAt(receipts);
  const age = (iso: string) => relative(iso, today);
  const poStage = (key: string, label: string, hint: string, statuses: PurchaseOrder["status"][], sortKey: (p: PurchaseOrder) => string, sub: (p: PurchaseOrder) => string, href: string): Stage => {
    const rows = pos.filter((p) => statuses.includes(p.status) && (p.status !== "received" || dayOffset(done.get(p.id) ?? p.expectedAt, today) >= -30));
    return {
      key, label, hint, href, count: rows.length,
      value: rows.reduce((s, p) => s + (p.status === "partially_received" ? n.outstanding(p) : p.total), 0),
      items: [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b))).slice(0, 3).map((p) => ({ id: p.id, title: `${p.number} · ${n.supplier(p.supplierId)}`, sub: sub(p), href: poHref(p.id) })),
    };
  };
  const approved = requests.filter((r) => r.status === "approved");
  const openQuotes = quotes.filter((q) => q.status === "requested" || q.status === "received");
  return [
    {
      key: "approved", label: "Approved requests", hint: "Approved by Head Office, not yet ordered", href: "/requests", count: approved.length,
      value: approved.reduce((s, r) => s + r.total, 0),
      items: [...approved].sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "")).slice(0, 3)
        .map((r) => ({ id: r.id, title: n.centre(r.centreId), sub: `${r.priority === "emergency" ? "Emergency · " : ""}submitted ${r.submittedAt ? age(r.submittedAt) : "—"}`, href: `/requests/${r.id}` })),
    },
    {
      key: "quotation", label: "Quotations", hint: "Awaiting a reply or a decision", href: "/procurement/compare", count: openQuotes.length, value: null,
      items: [...openQuotes].sort((a, b) => a.validUntil.localeCompare(b.validUntil)).slice(0, 3)
        .map((q) => ({ id: q.id, title: n.product(q.productId), sub: `${n.supplier(q.supplierId)} · ${q.status === "requested" ? "awaiting reply" : `valid until ${shortDate(q.validUntil)}`}`, href: `/procurement/compare?product=${q.productId}` })),
    },
    poStage("authorisation", "Awaiting authorisation", "Drafts and POs waiting for an authoriser", ["draft", "awaiting_authorisation"], (p) => p.createdAt, (p) => `${p.status === "draft" ? "Draft" : "Raised"} ${age(p.createdAt)} · ${moneyCompact(p.total)}`, "/procurement/orders?f_status=Awaiting+authorisation"),
    poStage("issued", "Issued", "With the supplier, not yet delivered", ["issued"], (p) => p.expectedAt, (p) => { const late = daysLate(p.expectedAt, today); return late ? `${late}d late · ${n.centre(p.centreId)}` : `Due ${shortDate(p.expectedAt)} · ${n.centre(p.centreId)}`; }, "/receiving/deliveries"),
    poStage("partial", "Part received", "Balance still owed by the supplier", ["partially_received"], (p) => p.createdAt, (p) => `Raised ${age(p.createdAt)} · ${moneyCompact(n.outstanding(p))} owed`, "/procurement/orders?f_status=Part+received"),
    poStage("received", "Received · 30 days", "Closed against goods receipts", ["received"], (p) => done.get(p.id) ?? "", (p) => `Closed ${age(done.get(p.id) ?? p.expectedAt)} · ${n.centre(p.centreId)}`, "/receiving/receipts"),
  ];
}

/** Average days from PO raised to final receipt, by month of completion (received POs only). */
export function cycleTimes(pos: PurchaseOrder[], receipts: GoodsReceipt[], today: Date, months = 6) {
  const done = completedAt(receipts);
  const buckets = new Map(lastPeriods(today, months).map((p) => [p, [] as number[]]));
  for (const p of pos) {
    const end = done.get(p.id);
    if (p.status !== "received" || !end) continue;
    buckets.get(end.slice(0, 7))?.push(daysBetween(p.createdAt, end));
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
  return [...buckets].map(([period, xs]) => ({ period, label: monthLabel(period), value: avg(xs), orders: xs.length }));
}

export async function loadPipeline(repo: Repository) {
  const today = repo.today();
  const [requests, quotes, pos, receipts, lines, rLines, centres, suppliers, products] = await Promise.all([
    repo.requests(), repo.quotations(), repo.purchaseOrders(), repo.receipts(), repo.purchaseOrderLines(), repo.receiptLines(), repo.centres(), repo.suppliers(), repo.products(),
  ]);
  const cmap = indexBy(centres, "id"), smap = indexBy(suppliers, "id"), pmap = indexBy(products, "id");
  const { byPo } = poOutstanding(lines, rLines);
  const stages = pipelineStages({ requests, quotes, pos, receipts }, today, {
    centre: (id) => cmap.get(id)?.name ?? id, supplier: (id) => smap.get(id)?.name ?? id, product: (id) => pmap.get(id)?.name ?? id, outstanding: (p) => byPo(p).value,
  });
  const cycle = cycleTimes(pos, receipts, today);
  const recent = cycle.filter((c) => c.orders);
  const latest = recent.at(-1), previous = recent.at(-2);
  const issued = pos.filter((p) => p.status === "issued");
  const late = issued.filter((p) => daysLate(p.expectedAt, today) > 0);
  const inFlight = stages.filter((s) => ["authorisation", "issued", "partial"].includes(s.key));
  return {
    stages,
    cycle,
    headline: {
      inFlight: inFlight.reduce((s, x) => s + x.count, 0),
      inFlightValue: moneyCompact(inFlight.reduce((s, x) => s + (x.value ?? 0), 0)),
      cycleDays: latest?.value ?? 0,
      cycleDelta: latest && previous ? Math.round((latest.value - previous.value) * 10) / 10 : 0,
      late: late.length,
      onSchedule: issued.length ? 1 - late.length / issued.length : 1,
    },
  };
}
