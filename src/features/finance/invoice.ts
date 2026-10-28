import type { Repository } from "@/lib/data/provider";
import type { Step } from "@/components/ui/stepper";
import { INVOICE, transition } from "@/domain/workflows";
import { indexBy } from "@/features/dashboards/shared";
import { RECEIPT_STATUS } from "@/features/dashboards/receiving";
import { money, shortDate } from "@/lib/format";
import { threeWayMatch, type MatchLine } from "./math";
import { ageingCell, centreHref, INVOICE_STATUS, MATCH, poHref, supplierHref } from "./invoices";

const FLAG: Record<MatchLine["flag"], { label: string; tone: "green" | "amber" | "orange" | "red" | "neutral" }> = {
  ok: { label: "Agrees", tone: "green" }, short: { label: "Short", tone: "amber" }, over: { label: "Over", tone: "orange" },
  damaged: { label: "Damaged", tone: "orange" }, not_received: { label: "Not received", tone: "red" },
};
const METHOD = { neft: "NEFT", upi: "UPI", cheque: "Cheque" } as const;

export async function loadInvoice(repo: Repository, id: string) {
  const today = repo.today();
  const invoices = await repo.invoices();
  const inv = invoices.find((i) => i.id === id);
  if (!inv) return null;
  const [suppliers, centres, pos, poLines, receipts, receiptLines, payments, products, uoms] = await Promise.all([
    repo.suppliers(), repo.centres(), repo.purchaseOrders(), repo.purchaseOrderLines(), repo.receipts(), repo.receiptLines(), repo.payments(), repo.products(), repo.uoms(),
  ]);
  const pmap = indexBy(products, "id"), umap = indexBy(uoms, "id");
  const supplier = suppliers.find((s) => s.id === inv.supplierId);
  const centre = centres.find((c) => c.id === inv.centreId);
  const po = pos.find((p) => p.id === inv.purchaseOrderId);
  const lines = poLines.filter((l) => l.purchaseOrderId === inv.purchaseOrderId);
  const grs = receipts.filter((r) => r.purchaseOrderId === inv.purchaseOrderId).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const grIds = new Set(grs.map((r) => r.id));
  const m = threeWayMatch(lines, receiptLines.filter((l) => grIds.has(l.receiptId)), inv.amount);
  const paid = payments.filter((p) => p.invoiceId === inv.id).sort((a, b) => a.paidAt.localeCompare(b.paidAt));

  const approve = transition(INVOICE, inv.status, "approve", inv);
  const query = transition(INVOICE, inv.status, "query", inv);
  const matched = inv.match === "matched";
  const steps: Step[] = [
    { label: "Received", state: "done", detail: inv.number },
    matched ? { label: "Three-way match", state: "done", detail: "PO, receipt and invoice agree" }
      : inv.match === "unmatched" ? { label: "Three-way match", state: "current", detail: "Waiting for the goods receipt" }
      : { label: "Three-way match", state: "blocked", detail: MATCH[inv.match].label },
    inv.status === "approved" || inv.status === "paid" ? { label: "Approved", state: "done" }
      : inv.status === "query" ? { label: "Approved", state: "blocked", detail: "On query with the supplier" }
      : { label: "Approved", state: matched ? "current" : "upcoming" },
    inv.status === "paid" ? { label: "Paid", state: "done", at: paid.at(-1) ? shortDate(paid.at(-1)!.paidAt) : undefined }
      : { label: "Paid", state: inv.status === "approved" ? "current" : "upcoming", detail: `Due ${shortDate(inv.dueAt)}` },
  ];

  return {
    invoice: {
      id: inv.id, number: inv.number, amount: inv.amount, due: shortDate(inv.dueAt), status: INVOICE_STATUS[inv.status], match: MATCH[inv.match],
      ageing: ageingCell(inv, today), rawStatus: inv.status,
    },
    supplier: { name: supplier?.name ?? "—", href: supplierHref(inv.supplierId) },
    centre: { name: centre?.name ?? "—", city: centre?.city ?? "", href: centreHref(inv.centreId) },
    po: po ? { number: po.number, href: poHref(po.id), raised: shortDate(po.createdAt), status: po.status.replace(/_/g, " ") } : null,
    steps,
    paper: lines.map((l) => ({ id: l.id, product: pmap.get(l.productId)?.name ?? l.productId, sku: pmap.get(l.productId)?.sku ?? "", uom: umap.get(pmap.get(l.productId)?.uomId ?? "")?.code ?? "", qty: l.quantity, price: l.unitPrice, total: l.quantity * l.unitPrice })),
    match: {
      rows: m.rows.map((r) => ({ ...r, product: pmap.get(r.productId)?.name ?? r.productId, sku: pmap.get(r.productId)?.sku ?? "", flagLabel: FLAG[r.flag] })),
      poTotal: m.poTotal, billable: m.billable, billed: m.billed, variance: m.variance,
    },
    receipts: grs.map((r) => ({ id: r.id, title: `${r.id.toUpperCase()} · ${shortDate(r.receivedAt)}`, sub: `${r.receivedQty} of ${r.orderedQty} units${r.damagedQty ? ` · ${r.damagedQty} damaged` : ""}`, badge: RECEIPT_STATUS[r.status], href: "/receiving/receipts" })),
    payments: paid.map((p) => ({ id: p.id, title: `${money(p.amount)} · ${METHOD[p.method]}`, sub: shortDate(p.paidAt), href: "/finance/payments" })),
    actions: {
      approve: approve.ok ? { ok: true as const } : { ok: false as const, reason: approve.reason },
      query: query.ok ? { ok: true as const } : { ok: false as const, reason: query.reason },
      pay: inv.status === "approved",
    },
  };
}
