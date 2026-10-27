import type { MonthlyRequest, StockCount } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { centreSummaries, consumptionSeries, hourOf, indexBy, lastPeriods, lowStock, REQUEST_STATUS, valuation } from "./shared";
import { RECEIPT_STATUS, dayOffset, deliveryBadge } from "./receiving";
import { count, moneyCompact, shortDate, time } from "@/lib/format";
import { period } from "@/lib/data/seed";

/** Monthly requests are due on the 25th for the following month's supplies. */
export const REQUEST_DEADLINE_DAY = 25;

/**
 * Deadline for the request that still needs action. Once this month's request is in (or the 25th has passed with it
 * submitted), the countdown rolls to next month's deadline; an unsent request after the 25th counts as overdue.
 */
export function requestDeadline(today: Date, submitted: boolean) {
  const due = new Date(today.getFullYear(), today.getMonth(), REQUEST_DEADLINE_DAY);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days >= 0 || !submitted) return { due, days, overdue: days < 0, nextCycle: false };
  const next = new Date(today.getFullYear(), today.getMonth() + 1, REQUEST_DEADLINE_DAY);
  return { due: next, days: Math.round((next.getTime() - today.getTime()) / 86_400_000), overdue: false, nextCycle: true };
}

/** Closing counts are due on the last working day (Mon–Fri) of the month. */
export function closingCountDue(today: Date) {
  const d = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

const COUNT_STATUS: Record<StockCount["status"], { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "blue" },
  submitted: { label: "Submitted", tone: "green" },
};
const NEEDS_ACTION: MonthlyRequest["status"][] = ["draft", "revision_requested"];

export async function loadCentre(repo: Repository) {
  const today = repo.today();
  const [centres, products, balances, movements, counts, requests, requestItems, budgets, pos, receipts, suppliers, audit, users] = await Promise.all([
    repo.centres(), repo.products(), repo.balances(), repo.movements(), repo.counts(), repo.requests(), repo.requestItems(), repo.budgets(), repo.purchaseOrders(), repo.receipts(), repo.suppliers(), repo.audit(), repo.users(),
  ]);
  const pmap = indexBy(products, "id");
  const smap = indexBy(suppliers, "id");
  const cmap = indexBy(centres, "id");
  const umap = indexBy(users, "id");
  const pomap = indexBy(pos, "id");
  const thisPeriod = period(today);
  const multiCentre = centres.length > 1;
  const where = (centreId: string) => (multiCentre ? `${cmap.get(centreId)?.name} · ` : "");
  const isToday = (iso: string) => dayOffset(iso, today) === 0;

  // Stock health
  const attention = lowStock(balances, pmap);
  const critical = attention.filter((a) => a.state === "critical");
  const recentPeriods = new Set(lastPeriods(today, 4).slice(0, 3)); // last three full months
  const monthlyUse = (centreId: string, productId: string) =>
    Math.round(movements.filter((m) => m.type === "consumption" && m.centreId === centreId && m.productId === productId && recentPeriods.has(m.occurredAt.slice(0, 7))).reduce((s, m) => s + m.quantity, 0) / 3);

  // This month's routine request: the one still needing action first.
  const routine = requests.filter((r) => r.period === thisPeriod && r.priority === "routine");
  const request = routine.find((r) => NEEDS_ACTION.includes(r.status)) ?? routine[0];
  const deadline = requestDeadline(today, !!request && !NEEDS_ACTION.includes(request.status));
  const emergencies = requests.filter((r) => r.period === thisPeriod && r.priority === "emergency");

  // Budget
  const budgetRows = budgets.filter((b) => b.period === thisPeriod);
  const allocated = budgetRows.reduce((s, b) => s + b.allocated, 0);
  const spent = budgetRows.reduce((s, b) => s + b.spent, 0);
  const committed = budgetRows.reduce((s, b) => s + b.committed, 0);
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const periods = lastPeriods(today, 6);

  // Deliveries
  const incoming = pos.filter((p) => p.status === "issued" || p.status === "awaiting_authorisation").sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
  const off = (iso: string) => dayOffset(iso, today);
  const weekDeliveries = incoming.filter((p) => p.status === "issued" && off(p.expectedAt) >= 0 && off(p.expectedAt) <= 6);
  const overdue = incoming.filter((p) => p.status === "issued" && off(p.expectedAt) < 0);

  const consumption = consumptionSeries(movements, pmap, today, 12);
  const closingDue = closingCountDue(today);

  return {
    centreName: multiCentre ? `${centres.length} centres` : centres[0]?.name ?? "No centre assigned",
    centres: await centreSummaries(repo, centres),
    welcome: {
      critical: critical.length,
      deliveriesToday: incoming.filter((p) => p.status === "issued" && isToday(p.expectedAt)).length,
      events: [
        ...incoming.filter((p) => p.status === "issued" && isToday(p.expectedAt)).map((p) => ({ id: p.id, hour: hourOf(p.expectedAt), label: `${p.number} delivery · ${smap.get(p.supplierId)?.name}`, tone: "blue" as Tone })),
        ...receipts.filter((r) => isToday(r.receivedAt)).map((r) => ({ id: r.id, hour: hourOf(r.receivedAt), label: `${pomap.get(r.purchaseOrderId)?.number ?? "Delivery"} received · ${RECEIPT_STATUS[r.status].label}`, tone: "green" as Tone })),
        ...requests.filter((r) => r.submittedAt && isToday(r.submittedAt)).map((r) => ({ id: r.id, hour: hourOf(r.submittedAt!), label: `${r.priority === "emergency" ? "Emergency request" : "Monthly request"} submitted`, tone: (r.priority === "emergency" ? "red" : "orange") as Tone })),
        ...audit.filter((e) => isToday(e.occurredAt)).map((e) => ({ id: e.id, hour: hourOf(e.occurredAt), label: `${umap.get(e.actorId)?.name ?? "Someone"} ${e.action}`, tone: "slate" as Tone })),
      ],
      nowHour: new Date().getHours() + new Date().getMinutes() / 60,
    },
    request: {
      status: request ? REQUEST_STATUS[request.status] : { label: "Not started", tone: "neutral" as Tone },
      needsAction: !request || NEEDS_ACTION.includes(request.status),
      items: request ? requestItems.filter((i) => i.requestId === request.id).length : 0,
      total: request ? moneyCompact(request.total) : "—",
      submitted: request?.submittedAt ? shortDate(request.submittedAt) : undefined,
      daysLeft: deadline.days,
      overdue: deadline.overdue,
      nextCycle: deadline.nextCycle,
      due: deadline.due.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      emergencies: emergencies.length,
      emergencyOpen: emergencies.filter((r) => r.status === "submitted").length,
    },
    kpis: {
      stockValue: valuation(balances, pmap),
      units: count(balances.reduce((s, b) => s + b.onHand, 0)),
      skus: new Set(balances.map((b) => b.productId)).size,
      attention: attention.length,
      critical: critical.length,
      budgetUsed: allocated ? spent / allocated : 0,
      budgetSpark: periods.map((p) => {
        const rows = budgets.filter((b) => b.period === p);
        const a = rows.reduce((s, b) => s + b.allocated, 0);
        return a ? rows.reduce((s, b) => s + b.spent, 0) / a : 0;
      }),
      monthElapsed: today.getDate() / monthDays,
      deliveriesWeek: weekDeliveries.length,
      overdue: overdue.length,
    },
    budget: { allocated: moneyCompact(allocated), spent: moneyCompact(spent), committed: moneyCompact(committed), available: moneyCompact(Math.max(0, allocated - spent - committed)), used: allocated ? spent / allocated : 0, daysLeft: monthDays - today.getDate() },
    restock: attention.slice(0, 7).map((a) => {
      const use = monthlyUse(a.balance.centreId, a.product.id);
      return {
        id: `${a.balance.centreId}-${a.product.id}`, title: a.product.name,
        sub: `${where(a.balance.centreId)}${a.balance.onHand} left · reorder at ${a.product.reorderPoint}${use ? ` · uses ~${use}/mo` : ""}`,
        badge: a.state === "critical" ? { label: "Critical", tone: "red" as Tone } : { label: "Low", tone: "amber" as Tone },
      };
    }),
    restockTotal: attention.length,
    deliveries: incoming.slice(0, 6).map((p) => ({
      id: p.id, title: `${p.number} · ${smap.get(p.supplierId)?.name ?? "Supplier"}`,
      sub: `${where(p.centreId)}${p.status === "issued" ? `Expected ${shortDate(p.expectedAt)}, ${time(p.expectedAt)}` : `Raised ${shortDate(p.createdAt)} · not yet issued`} · ${moneyCompact(p.total)}`,
      badge: p.status === "issued" ? deliveryBadge(off(p.expectedAt)) : { label: "Awaiting authorisation", tone: "amber" as Tone },
    })),
    counts: counts.filter((c) => c.period === thisPeriod).sort((a, b) => a.centreId.localeCompare(b.centreId) || b.kind.localeCompare(a.kind)).map((c) => ({
      id: c.id, label: `${c.kind === "opening" ? "Opening" : "Closing"} count`, status: COUNT_STATUS[c.status].label, tone: COUNT_STATUS[c.status].tone,
      detail: `${where(c.centreId)}${c.status === "submitted" && c.submittedAt ? `Submitted ${shortDate(c.submittedAt)}` : c.kind === "closing" ? `Due ${closingDue.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}` : "Due in the first week"}`,
    })),
    closingDueIn: Math.round((closingDue.getTime() - today.getTime()) / 86_400_000),
    receipts: [...receipts].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 5).map((r) => {
      const po = pomap.get(r.purchaseOrderId);
      const issues = [r.orderedQty > r.receivedQty && `${r.orderedQty - r.receivedQty} short`, r.damagedQty && `${r.damagedQty} damaged`].filter(Boolean).join(", ");
      return {
        id: r.id, title: `${po?.number ?? r.purchaseOrderId} · ${po ? smap.get(po.supplierId)?.name : "Supplier"}`,
        sub: `${where(r.centreId)}${shortDate(r.receivedAt)} · ${count(r.receivedQty)} of ${count(r.orderedQty)} units${issues ? ` · ${issues}` : ""}`,
        badge: RECEIPT_STATUS[r.status],
      };
    }),
    consumption: consumption.map((c, i) => ({ label: c.label, a: c.value, b: i > 0 ? consumption[i - 1]!.value : undefined })),
    consumptionUnits: consumption.map((c) => ({ label: c.label, a: c.units })),
  };
}
