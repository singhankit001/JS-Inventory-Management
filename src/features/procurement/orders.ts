import type { Invoice } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Actor } from "@/lib/auth/policy";
import type { Row } from "@/components/data/data-table";
import type { Tone } from "@/components/ui/badge";
import { indexBy, poOutstanding } from "@/features/dashboards/shared";
import { daysLate } from "@/features/dashboards/purchasing";
import { RECEIPT_STATUS } from "@/features/dashboards/receiving";
import { centreHref, PO_STATUS, poActions, poHref, poSteps, productHref, receiptHref, referencePrice, supplierHref } from "./shared";
import { count, money, moneyCompact, shortDate } from "@/lib/format";

const INVOICE_STATUS: Record<Invoice["status"], { label: string; tone: Tone }> = {
  received: { label: "Received", tone: "blue" }, query: { label: "On query", tone: "amber" }, approved: { label: "Approved", tone: "green" }, paid: { label: "Paid", tone: "slate" },
};

export async function loadOrders(repo: Repository, actor: Actor, opts: { po?: string; raise: boolean }) {
  const today = repo.today();
  const [pos, lines, receipts, rLines, suppliers, centres, products, uoms, invoices, users, quotes] = await Promise.all([
    repo.purchaseOrders(), repo.purchaseOrderLines(), repo.receipts(), repo.receiptLines(), repo.suppliers(), repo.centres(), repo.products(), repo.uoms(), repo.invoices(), repo.users(), repo.quotations(),
  ]);
  const smap = indexBy(suppliers, "id"), cmap = indexBy(centres, "id"), pmap = indexBy(products, "id"), umap = indexBy(uoms, "id"), usermap = indexBy(users, "id");
  const { owed, byPo } = poOutstanding(lines, rLines);
  const lineCount = new Map<string, number>();
  for (const l of lines) lineCount.set(l.purchaseOrderId, (lineCount.get(l.purchaseOrderId) ?? 0) + 1);
  const open = pos.filter((p) => p.status === "issued" || p.status === "partially_received");

  const rows: Row[] = [...pos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => ({
    id: p.id,
    number: { label: p.number, href: poHref(p.id) },
    supplier: smap.get(p.supplierId)?.name ?? p.supplierId,
    centre: cmap.get(p.centreId)?.name ?? p.centreId,
    status: PO_STATUS[p.status],
    lines: lineCount.get(p.id) ?? 0,
    total: p.total,
    expected: p.expectedAt,
    outstanding: p.status === "cancelled" ? 0 : byPo(p).value,
  }));

  const summary = {
    awaiting: pos.filter((p) => p.status === "awaiting_authorisation").length,
    drafts: pos.filter((p) => p.status === "draft").length,
    open: open.length,
    openValue: moneyCompact(open.reduce((s, p) => s + byPo(p).value, 0)),
    late: open.filter((p) => p.status === "issued" && daysLate(p.expectedAt, today) > 0).length,
  };

  const po = opts.po ? pos.find((p) => p.id === opts.po) : undefined;
  const detail = po && (() => {
    const pl = lines.filter((l) => l.purchaseOrderId === po.id);
    const got = new Map<string, { good: number; damaged: number }>();
    for (const r of rLines) {
      const x = got.get(r.purchaseOrderLineId) ?? { good: 0, damaged: 0 };
      x.good += r.receivedQty - r.damagedQty; x.damaged += r.damagedQty;
      got.set(r.purchaseOrderLineId, x);
    }
    const units = { ordered: pl.reduce((s, l) => s + l.quantity, 0), outstanding: byPo(po).units };
    return {
      id: po.id, number: po.number, status: PO_STATUS[po.status],
      supplier: { name: smap.get(po.supplierId)?.name ?? po.supplierId, href: supplierHref(po.supplierId) },
      centre: { name: cmap.get(po.centreId)?.name ?? po.centreId, href: centreHref(po.centreId) },
      raisedBy: usermap.get(po.raisedBy)?.name ?? "Unknown user", created: shortDate(po.createdAt), expected: shortDate(po.expectedAt),
      late: po.status === "issued" ? daysLate(po.expectedAt, today) : 0,
      total: money(po.total), variance: po.priceVariance, units,
      steps: poSteps(po, units),
      lines: pl.map((l) => {
        const p = pmap.get(l.productId);
        return {
          id: l.id, product: p?.name ?? l.productId, href: p ? productHref(p.sku) : undefined, uom: umap.get(p?.uomId ?? "")?.code ?? "",
          ordered: l.quantity, received: got.get(l.id)?.good ?? 0, damaged: got.get(l.id)?.damaged ?? 0, outstanding: owed.get(l.id) ?? 0,
          unitPrice: money(l.unitPrice), lineTotal: money(l.quantity * l.unitPrice),
        };
      }),
      receipts: receipts.filter((r) => r.purchaseOrderId === po.id).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).map((r) => ({
        id: r.id, title: `Receipt ${shortDate(r.receivedAt)}`, sub: `${count(r.receivedQty)} of ${count(r.orderedQty)} units${r.damagedQty ? ` · ${r.damagedQty} damaged` : ""}`, href: receiptHref(r.id), badge: RECEIPT_STATUS[r.status],
      })),
      invoices: invoices.filter((i) => i.purchaseOrderId === po.id).map((i) => ({
        id: i.id, title: i.number, sub: `${money(i.amount)} · due ${shortDate(i.dueAt)}`, href: `/finance/invoices/${i.id}`, badge: INVOICE_STATUS[i.status],
      })),
      actions: poActions(actor, po),
    };
  })();

  // Raise PO form: approved suppliers, their categories' products, and each supplier's contract price for prefill.
  const raise = opts.raise ? (() => {
    const approved = suppliers.filter((s) => s.status === "approved");
    const prices: Record<string, number> = {};
    for (const s of approved) for (const p of products) if (s.categoryIds.includes(p.categoryId) && p.status === "active") prices[`${s.id}:${p.id}`] = referencePrice(quotes, s.id, p.id, p.unitCost);
    return {
      today: today.toISOString().slice(0, 10),
      suppliers: approved.map((s) => ({ id: s.id, name: s.name, categoryIds: s.categoryIds, lead: Math.max(1, Math.round(s.avgLeadDays)) })),
      centres: centres.filter((c) => c.status === "active").map((c) => ({ id: c.id, name: c.name })),
      products: products.filter((p) => p.status === "active").map((p) => ({ id: p.id, label: p.name, hint: `${p.sku} · ${umap.get(p.uomId)?.code ?? ""}`, categoryId: p.categoryId })),
      prices,
    };
  })() : undefined;

  return { rows, summary, detail, raise };
}

export type OrdersData = Awaited<ReturnType<typeof loadOrders>>;
export type PoDetail = NonNullable<OrdersData["detail"]>;
export type RaiseData = NonNullable<OrdersData["raise"]>;
