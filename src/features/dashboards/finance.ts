import type { Repository } from "@/lib/data/provider";
import type { Invoice } from "@/domain/types";
import { indexBy, lastPeriods } from "./shared";
import { money, moneyCompact, monthLabel, percent, relative, shortDate } from "@/lib/format";
import { period } from "@/lib/data/seed";
import type { Tone } from "@/components/ui/badge";

export const AGEING = [
  { key: "current", label: "Not yet due", tone: "neutral" },
  { key: "d30", label: "1–30 days overdue", tone: "orange" },
  { key: "d60", label: "31–60 days overdue", tone: "orange" },
  { key: "d60plus", label: "60+ days overdue", tone: "orange" },
] as const satisfies readonly { key: string; label: string; tone: Tone }[];
export type AgeingKey = (typeof AGEING)[number]["key"];

/** Whole days past due, counted on calendar dates so an invoice due later today is still current. */
export function ageingBucket(dueAt: string, today: Date): AgeingKey {
  const due = new Date(dueAt);
  const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())) / 86_400_000);
  return days <= 0 ? "current" : days <= 30 ? "d30" : days <= 60 ? "d60" : "d60plus";
}

const MATCH: Record<Invoice["match"], { label: string; tone: Tone }> = {
  matched: { label: "Matched", tone: "green" },
  price_mismatch: { label: "Price mismatch", tone: "orange" },
  quantity_mismatch: { label: "Quantity mismatch", tone: "amber" },
  unmatched: { label: "Unmatched", tone: "red" },
};
const STATUS: Record<Invoice["status"], { label: string; tone: Tone }> = {
  received: { label: "Received", tone: "blue" },
  query: { label: "On query", tone: "amber" },
  approved: { label: "Approved", tone: "violet" },
  paid: { label: "Paid", tone: "green" },
};
const METHOD = { neft: "NEFT", upi: "UPI", cheque: "Cheque" } as const;

export async function loadFinance(repo: Repository) {
  const today = repo.today();
  const [centres, invoices, payments, budgets, suppliers, pos] = await Promise.all([
    repo.centres(), repo.invoices(), repo.payments(), repo.budgets(), repo.suppliers(), repo.purchaseOrders(),
  ]);
  const cmap = indexBy(centres, "id");
  const smap = indexBy(suppliers, "id");
  const pomap = indexBy(pos, "id");
  const imap = indexBy(invoices, "id");
  const thisPeriod = period(today);
  const periods = lastPeriods(today, 6);

  const open = invoices.filter((i) => i.status !== "paid");
  const aged = open.map((i) => ({ i, bucket: ageingBucket(i.dueAt, today) }));
  const outstanding = open.reduce((s, i) => s + i.amount, 0);
  const overdue = aged.filter((x) => x.bucket !== "current");
  const overdueValue = overdue.reduce((s, x) => s + x.i.amount, 0);

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dueThisWeek = open.filter((i) => new Date(i.dueAt) >= today && new Date(i.dueAt) < weekEnd).sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const paidByPeriod = periods.map((p) => payments.filter((x) => x.paidAt.slice(0, 7) === p));
  const paidValue = paidByPeriod.map((ps) => ps.reduce((s, x) => s + x.amount, 0));
  const exceptions = open.filter((i) => i.match !== "matched");
  const matched = invoices.filter((i) => i.match === "matched").length;

  return {
    welcome: { outstanding: moneyCompact(outstanding), dueWeek: moneyCompact(dueThisWeek.reduce((s, i) => s + i.amount, 0)), dueWeekCount: dueThisWeek.length, exceptions: exceptions.length, overdueCount: overdue.length },
    kpis: {
      outstanding, openCount: open.length,
      overdue: overdueValue, overdueCount: overdue.length,
      paidMonth: paidValue.at(-1) ?? 0, paidSpark: paidValue, paidChange: paidValue.at(-2) ? (paidValue.at(-1) ?? 0) / paidValue.at(-2)! - 1 : 0,
      exceptions: exceptions.length, onQuery: open.filter((i) => i.status === "query").length,
      matchRate: invoices.length ? matched / invoices.length : 1,
    },
    ageing: AGEING.map((b) => {
      const rows = aged.filter((x) => x.bucket === b.key);
      const value = rows.reduce((s, x) => s + x.i.amount, 0);
      return { label: b.label, sub: `${rows.length} invoice${rows.length === 1 ? "" : "s"}`, value, display: value ? moneyCompact(value) : "₹0", tone: b.tone as Tone };
    }),
    match: (Object.keys(MATCH) as Invoice["match"][]).map((m) => {
      const rows = invoices.filter((i) => i.match === m);
      return { label: MATCH[m].label, tone: MATCH[m].tone, value: rows.length, display: `${rows.length} · ${moneyCompact(rows.reduce((s, i) => s + i.amount, 0))}` };
    }).filter((s) => s.value > 0),
    paymentViews: {
      value: periods.map((p, i) => ({ label: monthLabel(p), a: paidValue[i] ?? 0 })),
      count: periods.map((p, i) => ({ label: monthLabel(p), a: paidByPeriod[i]?.length ?? 0 })),
    },
    recentPayments: [...payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 5).map((p) => {
      const inv = imap.get(p.invoiceId);
      return { id: p.id, title: smap.get(inv?.supplierId ?? "")?.name ?? "Supplier", sub: `${inv?.number ?? p.invoiceId} · ${shortDate(p.paidAt)}`, value: moneyCompact(p.amount), badge: { label: METHOD[p.method], tone: "neutral" as Tone } };
    }),
    variance: centres.map((c) => {
      const b = budgets.find((x) => x.centreId === c.id && x.period === thisPeriod);
      const used = (b?.spent ?? 0) + (b?.committed ?? 0);
      const diff = (b?.allocated ?? 0) - used;
      return {
        label: c.name, sub: `${percent(b?.allocated ? used / b.allocated : 0)} of ${moneyCompact(b?.allocated ?? 0)}`, value: used, marker: b?.allocated,
        display: diff >= 0 ? `${moneyCompact(diff)} under` : `${moneyCompact(-diff)} over`, tone: (diff < 0 ? "orange" : "blue") as Tone,
      };
    }),
    dueThisWeek: dueThisWeek.map((i) => ({
      id: i.id, title: `${i.number} · ${smap.get(i.supplierId)?.name ?? ""}`, sub: `${cmap.get(i.centreId)?.name ?? ""} · ${MATCH[i.match].label}`,
      value: money(i.amount), badge: { label: relative(i.dueAt, today), tone: (i.match === "matched" ? "blue" : "amber") as Tone },
    })),
    invoices: [...invoices].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((i) => {
      const bucket = i.status === "paid" ? null : AGEING.find((b) => b.key === ageingBucket(i.dueAt, today))!;
      return {
        id: i.id, number: i.number, supplier: smap.get(i.supplierId)?.name ?? "—", centre: cmap.get(i.centreId)?.name ?? "—", po: pomap.get(i.purchaseOrderId)?.number ?? "—",
        amount: i.amount, due: i.dueAt,
        ageing: bucket ? { label: bucket.key === "current" ? "Not due" : bucket.label.replace(" overdue", ""), tone: bucket.tone as Tone } : { label: "Settled", tone: "slate" as Tone },
        match: MATCH[i.match], status: STATUS[i.status],
      };
    }),
  };
}
