import type { Invoice } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { indexBy } from "@/features/dashboards/shared";
import { AGEING, ageingBucket, daysPastDue } from "./math";

export const MATCH: Record<Invoice["match"], { label: string; tone: Tone }> = {
  matched: { label: "Matched", tone: "green" },
  price_mismatch: { label: "Price mismatch", tone: "orange" },
  quantity_mismatch: { label: "Quantity mismatch", tone: "amber" },
  unmatched: { label: "Unmatched", tone: "red" },
};
export const INVOICE_STATUS: Record<Invoice["status"], { label: string; tone: Tone }> = {
  received: { label: "Received", tone: "blue" },
  query: { label: "On query", tone: "amber" },
  approved: { label: "Approved", tone: "violet" },
  paid: { label: "Paid", tone: "green" },
};

export const invoiceHref = (id: string) => `/finance/invoices/${id}`;
export const supplierHref = (id: string) => `/procurement/suppliers?supplier=${id}`;
export const centreHref = (id: string) => `/inventory/centres/${id}`;
export const poHref = (id: string) => `/procurement/orders?po=${id}`;

/** Ageing badge for one invoice: settled once paid, otherwise the payables bucket. */
export function ageingCell(i: Pick<Invoice, "dueAt" | "status">, today: Date) {
  if (i.status === "paid") return { label: "Settled", tone: "slate" as Tone };
  const b = AGEING.find((x) => x.key === ageingBucket(i.dueAt, today))!;
  return { label: b.key === "current" ? "Not due" : b.label.replace(" overdue", ""), tone: b.tone as Tone };
}

export async function loadInvoiceInbox(repo: Repository) {
  const today = repo.today();
  const [invoices, suppliers, centres, pos] = await Promise.all([repo.invoices(), repo.suppliers(), repo.centres(), repo.purchaseOrders()]);
  const smap = indexBy(suppliers, "id"), cmap = indexBy(centres, "id"), pomap = indexBy(pos, "id");
  const open = invoices.filter((i) => i.status !== "paid");
  const overdue = open.filter((i) => ageingBucket(i.dueAt, today) !== "current");
  const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0);
  const toReview = open.filter((i) => i.status === "received");

  return {
    kpis: {
      outstanding: sum(open), openCount: open.length,
      overdue: sum(overdue), overdueCount: overdue.length,
      toReview: toReview.length, readyToApprove: toReview.filter((i) => i.match === "matched").length,
      exceptions: open.filter((i) => i.match !== "matched").length, onQuery: open.filter((i) => i.status === "query").length,
    },
    // Unpaid first (oldest due date first), then settled invoices newest first.
    rows: [...invoices].sort((a, b) => Number(a.status === "paid") - Number(b.status === "paid") || (a.status === "paid" ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt))).map((i) => ({
      id: i.id,
      number: { label: i.number, href: invoiceHref(i.id) },
      supplier: { label: smap.get(i.supplierId)?.name ?? "—", href: supplierHref(i.supplierId) },
      centre: { label: cmap.get(i.centreId)?.name ?? "—", href: centreHref(i.centreId) },
      po: pomap.get(i.purchaseOrderId)?.number ?? "—",
      amount: i.amount,
      due: i.dueAt,
      days: i.status === "paid" ? null : Math.max(0, daysPastDue(i.dueAt, today)),
      ageing: ageingCell(i, today),
      match: MATCH[i.match],
      status: INVOICE_STATUS[i.status],
    })),
  };
}
