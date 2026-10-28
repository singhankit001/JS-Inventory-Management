import type { Payment } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { indexBy, lastPeriods } from "@/features/dashboards/shared";
import { money, moneyCompact, monthLabel, relative } from "@/lib/format";
import { reconciliationExceptions, RECON_LABEL } from "./math";
import { centreHref, invoiceHref, supplierHref } from "./invoices";

export const METHOD: Record<Payment["method"], { label: string; tone: Tone }> = {
  neft: { label: "NEFT", tone: "blue" }, upi: { label: "UPI", tone: "violet" }, cheque: { label: "Cheque", tone: "slate" },
};

export async function loadPayments(repo: Repository) {
  const today = repo.today();
  const [payments, invoices, suppliers, centres] = await Promise.all([repo.payments(), repo.invoices(), repo.suppliers(), repo.centres()]);
  const imap = indexBy(invoices, "id"), smap = indexBy(suppliers, "id"), cmap = indexBy(centres, "id");
  const periods = lastPeriods(today, 12);
  const byPeriod = periods.map((p) => payments.filter((x) => x.paidAt.slice(0, 7) === p));
  const value = byPeriod.map((ps) => ps.reduce((s, x) => s + x.amount, 0));
  const year = payments.filter((p) => p.paidAt.slice(0, 7) >= periods[0]!);
  const queue = invoices.filter((i) => i.status === "approved").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const exceptions = reconciliationExceptions(invoices, payments).reverse(); // newest invoices first

  return {
    kpis: {
      paidMonth: value.at(-1) ?? 0, paidMonthCount: byPeriod.at(-1)?.length ?? 0, spark: value,
      queueValue: queue.reduce((s, i) => s + i.amount, 0), queueCount: queue.length,
      yearValue: year.reduce((s, p) => s + p.amount, 0), yearCount: year.length,
      exceptions: exceptions.length,
    },
    monthly: {
      value: periods.map((p, i) => ({ label: monthLabel(p), a: value[i]! })),
      count: periods.map((p, i) => ({ label: monthLabel(p), a: byPeriod[i]!.length })),
    },
    methods: (Object.keys(METHOD) as Payment["method"][]).map((m) => {
      const rows = year.filter((p) => p.method === m);
      return { label: METHOD[m].label, tone: METHOD[m].tone, value: rows.reduce((s, p) => s + p.amount, 0), display: `${rows.length} · ${moneyCompact(rows.reduce((s, p) => s + p.amount, 0))}` };
    }).filter((s) => s.value > 0),
    queue: queue.map((i) => ({
      id: i.id, number: i.number, supplier: smap.get(i.supplierId)?.name ?? "—", centre: cmap.get(i.centreId)?.name ?? "—", amount: i.amount,
      due: `Due ${relative(i.dueAt, today)}`, overdue: new Date(i.dueAt).getTime() < today.getTime(),
    })),
    exceptions: exceptions.map((x) => {
      const inv = imap.get(x.invoiceId)!;
      return {
        id: `${x.kind}-${x.invoiceId}`, title: `${inv.number} · ${smap.get(inv.supplierId)?.name ?? ""}`, sub: `${RECON_LABEL[x.kind]}${x.delta ? ` · ${money(Math.abs(x.delta))}` : ""} · ${cmap.get(inv.centreId)?.name ?? ""}`,
        href: invoiceHref(inv.id), badge: { label: x.kind === "unmatched" ? "Awaiting goods" : x.delta < 0 ? "Credit note?" : "Check", tone: (x.kind === "unmatched" ? "neutral" : "amber") as Tone },
      };
    }),
    rows: [...payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).map((p) => {
      const inv = imap.get(p.invoiceId);
      return {
        id: p.id,
        invoice: inv ? { label: inv.number, href: invoiceHref(inv.id) } : p.invoiceId,
        supplier: inv ? { label: smap.get(inv.supplierId)?.name ?? "—", href: supplierHref(inv.supplierId) } : "—",
        centre: inv ? { label: cmap.get(inv.centreId)?.name ?? "—", href: centreHref(inv.centreId) } : "—",
        amount: p.amount,
        paid: p.paidAt,
        method: METHOD[p.method].label,
        ties: inv && inv.amount !== p.amount ? { label: `${money(Math.abs(inv.amount - p.amount))} ${p.amount < inv.amount ? "short" : "over"}`, tone: "amber" as Tone } : { label: "Ties out", tone: "green" as Tone },
      };
    }),
  };
}
