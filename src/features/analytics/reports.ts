import type { Repository } from "@/lib/data/provider";
import { indexBy, lastPeriods } from "@/features/dashboards/shared";
import { period } from "@/lib/data/seed";
import { AGEING, ageingBucket, daysPastDue } from "@/features/finance/math";
import type { CsvColumn } from "./csv";

/** Every row carries its period (YYYY-MM) and centre id so the report builder can filter without another server trip. */
export type ReportRow = { id: string; _period: string; _centre: string } & Record<string, string | number>;
export interface ReportDef { id: string; title: string; summary: string; byPeriod: boolean; columns: CsvColumn[]; rows: ReportRow[] }

const day = (iso: string) => iso.slice(0, 10);

export async function loadReports(repo: Repository) {
  const today = repo.today();
  const [centres, products, movements, pos, suppliers, budgets, invoices, receipts] = await Promise.all([
    repo.centres(), repo.products(), repo.movements(), repo.purchaseOrders(), repo.suppliers(), repo.budgets(), repo.invoices(), repo.receipts(),
  ]);
  const pmap = indexBy(products, "id"), cmap = indexBy(centres, "id"), smap = indexBy(suppliers, "id"), pomap = indexBy(pos, "id");
  const periods = lastPeriods(today, 12);
  const inWindow = new Set(periods);
  const centreName = (id: string) => cmap.get(id)?.name ?? id;

  const consumption = new Map<string, { units: number; value: number }>();
  for (const m of movements) {
    const p = m.occurredAt.slice(0, 7);
    if (m.type !== "consumption" || !inWindow.has(p)) continue;
    const key = `${p}|${m.centreId}`;
    const row = consumption.get(key) ?? { units: 0, value: 0 };
    row.units += m.quantity; row.value += m.quantity * (pmap.get(m.productId)?.unitCost ?? 0);
    consumption.set(key, row);
  }

  const spend = new Map<string, { orders: number; value: number }>();
  for (const po of pos) {
    const p = period(new Date(po.createdAt));
    if (po.status === "cancelled" || po.status === "draft" || !inWindow.has(p)) continue;
    const key = `${p}|${po.centreId}|${po.supplierId}`;
    const row = spend.get(key) ?? { orders: 0, value: 0 };
    row.orders += 1; row.value += po.total;
    spend.set(key, row);
  }

  const reports: ReportDef[] = [
    {
      id: "consumption-by-centre", title: "Consumption by centre", summary: "Units and value used per centre per month, at catalogue cost.", byPeriod: true,
      columns: [{ key: "period", header: "Period" }, { key: "centre", header: "Centre" }, { key: "units", header: "Units", kind: "count" }, { key: "value", header: "Value (₹)", kind: "money" }],
      rows: [...consumption.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, r]) => {
        const [p, c] = key.split("|") as [string, string];
        return { id: key, _period: p, _centre: c, period: p, centre: centreName(c), units: r.units, value: r.value };
      }),
    },
    {
      id: "spend-by-supplier", title: "Spend by supplier", summary: "Purchase orders raised per supplier and centre (drafts and cancellations excluded).", byPeriod: true,
      columns: [{ key: "period", header: "Period" }, { key: "supplier", header: "Supplier" }, { key: "centre", header: "Centre" }, { key: "orders", header: "POs", kind: "count" }, { key: "value", header: "Ordered (₹)", kind: "money" }],
      rows: [...spend.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, r]) => {
        const [p, c, s] = key.split("|") as [string, string, string];
        return { id: key, _period: p, _centre: c, period: p, supplier: smap.get(s)?.name ?? s, centre: centreName(c), orders: r.orders, value: r.value };
      }),
    },
    {
      id: "budget-variance", title: "Budget variance", summary: "Allocation against spend (goods received) and open commitments per centre per month.", byPeriod: true,
      columns: [{ key: "period", header: "Period" }, { key: "centre", header: "Centre" }, { key: "allocated", header: "Allocated (₹)", kind: "money" }, { key: "spent", header: "Spent (₹)", kind: "money" }, { key: "committed", header: "Committed (₹)", kind: "money" }, { key: "variance", header: "Under (+) / over (−) (₹)", kind: "money" }],
      rows: budgets.filter((b) => inWindow.has(b.period)).sort((a, b) => a.period.localeCompare(b.period) || centreName(a.centreId).localeCompare(centreName(b.centreId))).map((b) => ({
        id: `${b.period}|${b.centreId}`, _period: b.period, _centre: b.centreId, period: b.period, centre: centreName(b.centreId),
        allocated: b.allocated, spent: b.spent, committed: b.committed, variance: b.allocated - b.spent - b.committed,
      })),
    },
    {
      id: "payables-ageing", title: "Payables ageing", summary: `Unpaid supplier invoices by days past due, as of ${day(today.toISOString())}.`, byPeriod: false,
      columns: [{ key: "invoice", header: "Invoice" }, { key: "supplier", header: "Supplier" }, { key: "centre", header: "Centre" }, { key: "status", header: "Status" }, { key: "amount", header: "Amount (₹)", kind: "money" }, { key: "due", header: "Due" }, { key: "days", header: "Days overdue", kind: "count" }, { key: "bucket", header: "Bucket" }],
      rows: invoices.filter((i) => i.status !== "paid").sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((i) => ({
        id: i.id, _period: i.dueAt.slice(0, 7), _centre: i.centreId, invoice: i.number, supplier: smap.get(i.supplierId)?.name ?? i.supplierId, centre: centreName(i.centreId),
        status: i.status, amount: i.amount, due: day(i.dueAt), days: Math.max(0, daysPastDue(i.dueAt, today)), bucket: AGEING.find((b) => b.key === ageingBucket(i.dueAt, today))!.label,
      })),
    },
    {
      id: "receipt-discrepancies", title: "Receipt discrepancies", summary: "Deliveries that arrived short, over or damaged, by supplier and centre.", byPeriod: true,
      columns: [{ key: "date", header: "Received" }, { key: "po", header: "PO" }, { key: "supplier", header: "Supplier" }, { key: "centre", header: "Centre" }, { key: "ordered", header: "Ordered", kind: "count" }, { key: "received", header: "Received", kind: "count" }, { key: "damaged", header: "Damaged", kind: "count" }, { key: "short", header: "Short", kind: "count" }],
      rows: receipts.filter((r) => r.status === "discrepancy" && inWindow.has(period(new Date(r.receivedAt)))).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map((r) => {
        const po = pomap.get(r.purchaseOrderId);
        return {
          id: r.id, _period: period(new Date(r.receivedAt)), _centre: r.centreId, date: day(r.receivedAt), po: po?.number ?? r.purchaseOrderId,
          supplier: smap.get(po?.supplierId ?? "")?.name ?? "—", centre: centreName(r.centreId), ordered: r.orderedQty, received: r.receivedQty, damaged: r.damagedQty, short: Math.max(0, r.orderedQty - r.receivedQty),
        };
      }),
    },
  ];

  return { reports, periods: [...periods].reverse(), centres: centres.map((c) => ({ id: c.id, name: c.name })) };
}
