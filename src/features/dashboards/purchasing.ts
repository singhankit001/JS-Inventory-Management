import type { PurchaseOrder, SupplierQuotation } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { dayOffset, hourOf, indexBy, poOutstanding } from "./shared";
import { moneyCompact, percent, relative, shortDate } from "@/lib/format";

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days an order is past its expected date (0 when not yet due). */
export const daysLate = (expectedAt: string, today: Date) => Math.max(0, Math.round((startOfDay(today) - startOfDay(new Date(expectedAt))) / DAY));

/**
 * Per product: lowest priced quotation versus the others. Only received/accepted quotes carry a usable price —
 * "requested" is still awaiting the supplier and "declined" is out of the running.
 */
export function bestPrices(quotes: SupplierQuotation[]) {
  const byProduct = new Map<string, SupplierQuotation[]>();
  for (const q of quotes) {
    if (q.status !== "received" && q.status !== "accepted") continue;
    byProduct.set(q.productId, [...(byProduct.get(q.productId) ?? []), q]);
  }
  return [...byProduct.entries()].map(([productId, qs]) => {
    const sorted = [...qs].sort((a, b) => a.unitPrice - b.unitPrice);
    const best = sorted[0]!;
    const highest = sorted.at(-1)!.unitPrice;
    const saving = highest - best.unitPrice;
    return { productId, best, others: sorted.slice(1), quotes: sorted.length, highest, saving, savingRatio: highest ? saving / highest : 0 };
  });
}

export const PO_STAGES: { status: PurchaseOrder["status"]; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "awaiting_authorisation", label: "Awaiting authorisation" },
  { status: "issued", label: "Issued" },
  { status: "partially_received", label: "Partially received" },
  { status: "received", label: "Received · 30 days" },
];

export async function loadPurchasing(repo: Repository) {
  const today = repo.today();
  const [centres, products, suppliers, quotations, pos, requests, requestItems, audit, users, poLines, receipts, receiptLines] = await Promise.all([
    repo.centres(), repo.products(), repo.suppliers(), repo.quotations(), repo.purchaseOrders(), repo.requests(), repo.requestItems(), repo.audit(), repo.users(),
    repo.purchaseOrderLines(), repo.receipts(), repo.receiptLines(),
  ]);
  const pmap = indexBy(products, "id");
  const cmap = indexBy(centres, "id");
  const smap = indexBy(suppliers, "id");
  const umap = indexBy(users, "id");

  // Approved by Head Office but not yet turned into a purchase order.
  const queue = requests.filter((r) => r.status === "approved").sort((a, b) => (a.priority === b.priority ? (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "") : a.priority === "emergency" ? -1 : 1));
  const queueValue = queue.reduce((s, r) => s + r.total, 0);

  const live = pos.filter((p) => p.status !== "cancelled");
  const { byPo } = poOutstanding(poLines, receiptLines);
  const lastReceipt = new Map<string, string>();
  for (const r of receipts) if ((lastReceipt.get(r.purchaseOrderId) ?? "") < r.receivedAt) lastReceipt.set(r.purchaseOrderId, r.receivedAt);
  const inPipeline = (p: PurchaseOrder) => p.status !== "received" || dayOffset(lastReceipt.get(p.id) ?? p.expectedAt, today) >= -30;
  const openPOs = live.filter((p) => ["draft", "awaiting_authorisation", "issued", "partially_received"].includes(p.status));
  const issued = live.filter((p) => p.status === "issued");
  const delayed = issued.map((p) => ({ po: p, late: daysLate(p.expectedAt, today) })).filter((x) => x.late > 0).sort((a, b) => b.late - a.late);

  const qCount = (s: SupplierQuotation["status"]) => quotations.filter((q) => q.status === s).length;
  const prices = bestPrices(quotations).sort((a, b) => b.savingRatio - a.savingRatio);
  const compared = prices.filter((p) => p.quotes > 1);
  const avgSaving = compared.length ? compared.reduce((s, p) => s + p.savingRatio, 0) / compared.length : 0;
  const expiringSoon = quotations.filter((q) => q.status === "received" && new Date(q.validUntil).getTime() - today.getTime() <= 7 * DAY).length;

  // Variance only exists once a price is committed, i.e. from authorisation onwards; last 30 days of orders.
  const varianceRows = live.filter((p) => p.status !== "draft" && dayOffset(p.createdAt, today) >= -30).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const netVariance = varianceRows.reduce((s, p) => s + p.priceVariance, 0);

  const todaysEvents = [
    ...live.filter((p) => p.status === "issued" && dayOffset(p.expectedAt, today) === 0).map((p) => ({ id: p.id, hour: hourOf(p.expectedAt), label: `${p.number} delivery · ${cmap.get(p.centreId)?.name}`, tone: "blue" as Tone })),
    ...audit.filter((e) => new Date(e.occurredAt).toDateString() === today.toDateString()).map((e) => ({ id: e.id, hour: hourOf(e.occurredAt), label: `${umap.get(e.actorId)?.name ?? "Someone"} ${e.action}`, tone: "green" as Tone })),
  ];

  return {
    welcome: {
      queue: queue.length,
      queueValue: moneyCompact(queueValue),
      awaitingReply: qCount("requested"),
      delayed: delayed.length,
      deliveriesToday: todaysEvents.filter((e) => e.tone === "blue").length,
      events: todaysEvents,
      nowHour: new Date().getHours() + new Date().getMinutes() / 60,
    },
    onSchedule: issued.length ? 1 - delayed.length / issued.length : 1,
    kpis: {
      queue: queue.length,
      queueValue: moneyCompact(queueValue),
      emergency: queue.filter((r) => r.priority === "emergency").length,
      awaitingReply: qCount("requested"),
      toReview: qCount("received"),
      openPOs: openPOs.length,
      openValue: openPOs.reduce((s, p) => s + byPo(p).value, 0),
      delayed: delayed.length,
      worstLate: delayed[0]?.late ?? 0,
    },
    variance: {
      net: netVariance,
      over: varianceRows.filter((p) => p.priceVariance > 0).length,
      under: varianceRows.filter((p) => p.priceVariance < 0).length,
      // Flipped so bars above the line are savings (green) and below are overpayments (orange).
      // One bar per day over the window (net of that day's POs), so a busy month stays readable.
      bars: Array.from({ length: 31 }, (_, i) => i - 30).map((off) => {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off);
        return { label: shortDate(d.toISOString()), value: -varianceRows.filter((p) => dayOffset(p.createdAt, today) === off).reduce((t, p) => t + p.priceVariance, 0) };
      }),
    },
    pipeline: PO_STAGES.map((s) => {
      const rows = live.filter((p) => p.status === s.status && inPipeline(p));
      return { ...s, count: rows.length, value: rows.length ? moneyCompact(rows.reduce((t, p) => t + p.total, 0)) : "—" };
    }),
    queue: queue.map((r) => {
      const lines = requestItems.filter((i) => i.requestId === r.id).length;
      return {
        id: r.id, title: cmap.get(r.centreId)?.name ?? r.centreId, href: "/requests",
        sub: [lines ? `${lines} lines` : null, r.submittedAt ? `submitted ${relative(r.submittedAt, today)}` : null].filter(Boolean).join(" · "),
        value: moneyCompact(r.total),
        badge: r.priority === "emergency" ? { label: "Emergency", tone: "red" as Tone } : { label: "Routine", tone: "neutral" as Tone },
      };
    }),
    quotes: {
      segments: ([["requested", "Awaiting reply", "neutral"], ["received", "Received", "slate"], ["accepted", "Accepted", "blue"], ["declined", "Declined", "orange"]] as const)
        .map(([s, label, tone]) => ({ label, value: qCount(s), tone: tone as Tone }))
        .filter((s) => s.value > 0),
      total: quotations.length,
      productsCompared: compared.length,
      avgSaving: percent(avgSaving),
      expiringSoon,
    },
    prices: prices.map((p) => {
      const list = pmap.get(p.productId)?.unitCost ?? 0;
      return {
        id: p.productId,
        product: pmap.get(p.productId)?.name ?? p.productId,
        supplier: smap.get(p.best.supplierId)?.name ?? p.best.supplierId,
        quotes: p.quotes,
        best: p.best.unitPrice,
        next: p.others[0]?.unitPrice ?? null,
        saving: p.quotes > 1 ? p.saving : null,
        savingPct: p.quotes > 1 ? percent(p.savingRatio) : "Single quote",
        vsList: list ? `${p.best.unitPrice <= list ? "−" : "+"}${percent(Math.abs(p.best.unitPrice / list - 1))}` : "—",
      };
    }),
    delayed: delayed.slice(0, 5).map(({ po, late }) => ({
      id: po.id, title: `${po.number} · ${smap.get(po.supplierId)?.name ?? po.supplierId}`, href: "/procurement/orders",
      sub: `${cmap.get(po.centreId)?.name} · expected ${shortDate(po.expectedAt)} · ${byPo(po).units} units · ${moneyCompact(po.total)}`,
      badge: { label: `${late}d late`, tone: "red" as Tone },
    })),
    suppliers: [...suppliers].sort((a, b) => b.onTimeRate - a.onTimeRate).map((s) => ({
      id: s.id, name: s.name, onTime: s.onTimeRate, quality: s.qualityScore, lead: s.avgLeadDays, status: s.status,
      open: openPOs.filter((p) => p.supplierId === s.id).length,
      late: delayed.filter((d) => d.po.supplierId === s.id).length,
    })),
  };
}
