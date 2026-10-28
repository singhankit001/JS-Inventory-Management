import type { GoodsReceipt, PurchaseOrder } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import { dayOffset, indexBy, lastPeriods } from "@/features/dashboards/shared";
import { completedAt } from "./pipeline";
import { PO_STATUS, poHref, QUOTE_STATUS, SUPPLIER_STATUS } from "./shared";
import { money, moneyCompact, monthLabel, shortDate } from "@/lib/format";

/**
 * Monthly delivery performance for one supplier: on-time = first delivery on or before the expected day (same rule as the
 * seeded scorecard), clean = receipts with no damaged units. Percentages 0–100; months without deliveries are 0 with n = 0.
 */
export function supplierTrend(pos: PurchaseOrder[], receipts: GoodsReceipt[], supplierId: string, today: Date, months = 6) {
  const mine = new Set(pos.filter((p) => p.supplierId === supplierId).map((p) => p.id));
  const rs = receipts.filter((r) => mine.has(r.purchaseOrderId));
  const first = new Map<string, string>();
  for (const r of rs) if (!first.has(r.purchaseOrderId) || r.receivedAt < first.get(r.purchaseOrderId)!) first.set(r.purchaseOrderId, r.receivedAt);
  const pmap = indexBy(pos, "id");
  const day = (iso: string) => new Date(new Date(iso).toDateString()).getTime();
  return lastPeriods(today, months).map((period) => {
    const firsts = [...first].filter(([, at]) => at.startsWith(period));
    const onTime = firsts.filter(([id, at]) => day(at) <= day(pmap.get(id)!.expectedAt)).length;
    const inMonth = rs.filter((r) => r.receivedAt.startsWith(period));
    const clean = inMonth.filter((r) => r.damagedQty === 0).length;
    return { label: monthLabel(period), a: firsts.length ? Math.round((onTime / firsts.length) * 100) : 0, b: inMonth.length ? Math.round((clean / inMonth.length) * 100) : 0, n: inMonth.length };
  });
}

export async function loadSuppliers(repo: Repository, opts: { supplier?: string; edit?: string }) {
  const today = repo.today();
  const [suppliers, categories, pos, receipts, quotes, products] = await Promise.all([repo.suppliers(), repo.categories(), repo.purchaseOrders(), repo.receipts(), repo.quotations(), repo.products()]);
  const catmap = indexBy(categories, "id"), pmap = indexBy(products, "id");
  const recent = pos.filter((p) => p.status !== "cancelled" && dayOffset(p.createdAt, today) >= -365);
  const delivered = new Set(receipts.map((r) => r.purchaseOrderId));

  const cards = [...suppliers].sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name)).map((s) => {
    const mine = recent.filter((p) => p.supplierId === s.id);
    return {
      id: s.id, name: s.name, status: SUPPLIER_STATUS[s.status],
      categories: s.categoryIds.map((c) => catmap.get(c)?.name ?? c),
      // Scores without our own deliveries come from onboarding references, so they are labelled as such.
      history: pos.some((p) => p.supplierId === s.id && delivered.has(p.id)),
      onTime: s.onTimeRate, quality: s.qualityScore, lead: s.avgLeadDays,
      spend: mine.reduce((t, p) => t + p.total, 0),
      open: pos.filter((p) => p.supplierId === s.id && ["draft", "awaiting_authorisation", "issued", "partially_received"].includes(p.status)).length,
    };
  });

  const s = opts.supplier ? suppliers.find((x) => x.id === opts.supplier) : undefined;
  const done = completedAt(receipts);
  const detail = s && {
    id: s.id, name: s.name, card: cards.find((c) => c.id === s.id)!,
    trend: supplierTrend(pos, receipts, s.id, today),
    open: pos.filter((p) => p.supplierId === s.id && ["draft", "awaiting_authorisation", "issued", "partially_received"].includes(p.status))
      .sort((a, b) => a.expectedAt.localeCompare(b.expectedAt))
      .map((p) => ({ id: p.id, title: p.number, sub: `${moneyCompact(p.total)} · expected ${shortDate(p.expectedAt)}`, href: poHref(p.id), badge: PO_STATUS[p.status] })),
    lastDelivered: pos.filter((p) => p.supplierId === s.id && done.has(p.id)).map((p) => done.get(p.id)!).sort().at(-1),
    quotes: quotes.filter((q) => q.supplierId === s.id).sort((a, b) => a.status.localeCompare(b.status)).map((q) => ({
      id: q.id, title: pmap.get(q.productId)?.name ?? q.productId, href: `/procurement/compare?product=${q.productId}`,
      sub: q.status === "requested" ? "Awaiting the supplier's price" : `${money(q.unitPrice)} · valid until ${shortDate(q.validUntil)}`, badge: QUOTE_STATUS[q.status],
    })),
    // shortcut: the supplier master has no contact fields yet; a demo address on the reserved .example domain stands in.
    contact: `orders@${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.example`,
  };

  const editing = opts.edit ? (opts.edit === "new" ? { id: undefined, name: "", categoryIds: [] as string[], status: "pending" as const, avgLeadDays: 5 } : suppliers.find((x) => x.id === opts.edit)) : undefined;
  return {
    cards, detail,
    form: editing ? { supplier: { id: editing.id, name: editing.name, categoryIds: editing.categoryIds, status: editing.status, avgLeadDays: Math.round(editing.avgLeadDays) }, categories: categories.map((c) => ({ id: c.id, name: c.name })) } : undefined,
    totals: { approved: suppliers.filter((x) => x.status === "approved").length, pending: suppliers.filter((x) => x.status === "pending").length, spend: moneyCompact(recent.reduce((t, p) => t + p.total, 0)) },
  };
}

export type SupplierFormData = NonNullable<Awaited<ReturnType<typeof loadSuppliers>>["form"]>;
