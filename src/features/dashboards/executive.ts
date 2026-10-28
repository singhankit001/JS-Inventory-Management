import type { Repository } from "@/lib/data/provider";
import { REQUEST_STATUS, centreSummaries, consumptionSeries, dayOffset, hourOf, indexBy, lastPeriods, lowStock, poOutstanding, valuation } from "./shared";
import { count, money, moneyCompact, monthLabel, percent, relative } from "@/lib/format";
import { period } from "@/lib/data/seed";
import type { Tone } from "@/components/ui/badge";

export async function loadExecutive(repo: Repository) {
  const today = repo.today();
  const [centres, products, balances, budgets, approvals, pos, suppliers, movements, audit, users, receipts, poLines, receiptLines, requests, requestItems] = await Promise.all([
    repo.centres(), repo.products(), repo.balances(), repo.budgets(), repo.approvals(), repo.purchaseOrders(), repo.suppliers(), repo.movements(), repo.audit(), repo.users(), repo.receipts(),
    repo.purchaseOrderLines(), repo.receiptLines(), repo.requests(), repo.requestItems(),
  ]);
  const pmap = indexBy(products, "id");
  const cmap = indexBy(centres, "id");
  const umap = indexBy(users, "id");
  const thisPeriod = period(today);
  const periods = lastPeriods(today, 6);

  const totalValue = valuation(balances, pmap);
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const critical = pendingApprovals.filter((a) => a.critical);

  const spendByPeriod = periods.map((p) => budgets.filter((b) => b.period === p).reduce((s, b) => s + b.spent, 0));
  const allocByPeriod = periods.map((p) => budgets.filter((b) => b.period === p).reduce((s, b) => s + b.allocated, 0));
  const monthSpend = spendByPeriod.at(-1) ?? 0;
  const monthAlloc = allocByPeriod.at(-1) ?? 0;
  const prevSpend = spendByPeriod.at(-2) ?? 0;

  // Procurement cycle over the last 90 days, from actual receipts: first delivery on or before the expected day counts as on time;
  // issued orders already past their date count as late.
  const firstReceipt = new Map<string, string>();
  for (const r of [...receipts].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))) if (!firstReceipt.has(r.purchaseOrderId)) firstReceipt.set(r.purchaseOrderId, r.receivedAt);
  const delivered = pos.filter((p) => firstReceipt.has(p.id) && dayOffset(firstReceipt.get(p.id)!, today) >= -90);
  const lateOpen = pos.filter((p) => p.status === "issued" && dayOffset(p.expectedAt, today) < 0).length;
  const onTimeCount = delivered.filter((p) => dayOffset(firstReceipt.get(p.id)!, today) <= dayOffset(p.expectedAt, today)).length;
  const onTime = delivered.length + lateOpen ? onTimeCount / (delivered.length + lateOpen) : 1;
  const cycleDays = delivered.length
    ? delivered.reduce((s, p) => s + dayOffset(firstReceipt.get(p.id)!, today) - dayOffset(p.createdAt, today), 0) / delivered.length
    : 0;
  const recentReceipts = receipts.filter((r) => dayOffset(r.receivedAt, today) >= -90);
  const openPOs = pos.filter((p) => ["issued", "awaiting_authorisation", "partially_received"].includes(p.status));
  const { byPo } = poOutstanding(poLines, receiptLines);

  const consumption = consumptionSeries(movements, pmap, today, 12);
  const alerts = lowStock(balances, pmap).filter((x) => x.state === "critical");

  const todaysEvents = [
    ...pos.filter((p) => p.status === "issued" && dayOffset(p.expectedAt, today) === 0).map((p) => ({ id: p.id, hour: hourOf(p.expectedAt), label: `${p.number} delivery · ${cmap.get(p.centreId)?.name}`, tone: "blue" as Tone })),
    ...pendingApprovals.filter((a) => new Date(a.requestedAt).toDateString() === today.toDateString()).map((a) => ({ id: a.id, hour: hourOf(a.requestedAt), label: `${a.critical ? "Critical approval" : "Approval"} requested`, tone: (a.critical ? "red" : "orange") as Tone })),
    ...audit.filter((e) => new Date(e.occurredAt).toDateString() === today.toDateString()).map((e) => ({ id: e.id, hour: hourOf(e.occurredAt), label: `${umap.get(e.actorId)?.name ?? "Someone"} ${e.action}`, tone: "green" as Tone })),
  ];

  // Rule-based insights: deterministic, sourced from the numbers on this page. An AI model replaces these in Phase 3.
  const overBudget = centres
    .map((c) => {
      const b = budgets.find((x) => x.centreId === c.id && x.period === thisPeriod);
      return { c, ratio: b ? b.spent / b.allocated : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio);
  const worstSupplier = [...suppliers].filter((s) => s.status === "approved").sort((a, b) => a.onTimeRate - b.onTimeRate)[0];
  const lastTwo = consumption.slice(-2);
  const insights: { id: string; tone: Tone; text: string }[] = [];
  if (overBudget[0] && overBudget[0].ratio > 0.6)
    insights.push({ id: "i1", tone: "orange", text: `${overBudget[0].c.name} has used ${percent(overBudget[0].ratio)} of this month's budget with ${daysLeft(today)} days to go.` });
  if (alerts.length)
    insights.push({ id: "i2", tone: "red", text: `${alerts.length} SKU-centre pairs are at critical stock. Most affected: ${listNames(alerts.map((a) => a.product.name))}.` });
  if (worstSupplier && worstSupplier.onTimeRate < 0.85)
    insights.push({ id: "i3", tone: "amber", text: `${worstSupplier.name} delivers on time ${percent(worstSupplier.onTimeRate)} of the time — lowest of approved suppliers.` });
  if (lastTwo.length === 2 && lastTwo[0]!.value > 0)
    insights.push({ id: "i4", tone: "blue", text: `Consumption is ${lastTwo[1]!.value >= lastTwo[0]!.value ? "up" : "down"} ${percent(Math.abs(lastTwo[1]!.value / lastTwo[0]!.value - 1))} month-to-date versus last month.` });

  return {
    centreCount: centres.length,
    centres: await centreSummaries(repo, centres),
    welcome: {
      approvals: pendingApprovals.length,
      critical: critical.length,
      deliveriesToday: todaysEvents.filter((e) => e.tone === "blue").length,
      alerts: alerts.length,
      events: todaysEvents,
      nowHour: new Date().getHours() + new Date().getMinutes() / 60,
    },
    valuation: {
      total: money(totalValue),
      totalValue, // paise, for AnimatedNumber
      units: count(balances.reduce((s, b) => s + b.onHand, 0)),
      variance: periods.map((p, i) => ({ label: monthLabel(p), value: (allocByPeriod[i] ?? 0) - (spendByPeriod[i] ?? 0) })),
      underBudget: (allocByPeriod.at(-1) ?? 0) - monthSpend,
    },
    kpis: {
      spend: moneyCompact(monthSpend),
      spendValue: monthSpend, // paise, for AnimatedNumber
      spendSpark: spendByPeriod,
      spendChange: prevSpend ? monthSpend / prevSpend - 1 : 0,
      critical: critical.length,
      pending: pendingApprovals.length,
      utilisation: monthAlloc ? monthSpend / monthAlloc : 0,
      utilSpark: periods.map((_, i) => (allocByPeriod[i] ? (spendByPeriod[i] ?? 0) / allocByPeriod[i]! : 0)),
      openPOs: openPOs.length,
      openPOValue: moneyCompact(openPOs.reduce((s, p) => s + byPo(p).value, 0)),
      poSpark: periods.map((p) => pos.filter((x) => x.createdAt.slice(0, 7) === p).length),
    },
    consumption: consumption.map((c, i) => ({ label: c.label, a: c.value, b: i > 0 ? consumption[i - 1]!.value : undefined })),
    consumptionUnits: consumption.map((c) => ({ label: c.label, a: c.units })),
    centreSpend: centres.map((c) => {
      const b = budgets.find((x) => x.centreId === c.id && x.period === thisPeriod);
      const ratio = b ? b.spent / b.allocated : 0;
      return { label: c.name, sub: c.city, value: b?.spent ?? 0, marker: b?.allocated, display: moneyCompact(b?.spent ?? 0), tone: (ratio > 0.9 ? "orange" : "blue") as Tone };
    }),
    suppliers: [...suppliers].sort((a, b) => b.onTimeRate - a.onTimeRate).map((s) => ({ id: s.id, name: s.name, onTime: s.onTimeRate, quality: s.qualityScore, lead: s.avgLeadDays, status: s.status })),
    alerts: alerts.slice(0, 6).map((a) => ({ id: `${a.balance.centreId}-${a.product.id}`, title: a.product.name, sub: `${cmap.get(a.balance.centreId)?.name} · ${a.balance.onHand} left, reorder at ${a.product.reorderPoint}`, badge: { label: "Critical", tone: "red" as Tone } })),
    alertsTotal: alerts.length,
    recentRequests: requests.filter((r) => r.submittedAt).sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!)).slice(0, 6).map((r) => {
      const centre = cmap.get(r.centreId);
      return {
        id: r.id, centreId: r.centreId, centre: centre?.name ?? r.centreId,
        emergency: r.priority === "emergency", submittedAt: r.submittedAt!, when: relative(r.submittedAt!),
        items: requestItems.filter((i) => i.requestId === r.id).length, amount: money(r.total),
        by: umap.get(r.submittedBy)?.name ?? "—", status: REQUEST_STATUS[r.status],
      };
    }),
    cycle: { onTime, cycleDays, receipts: recentReceipts.length, discrepancies: recentReceipts.filter((r) => r.status === "discrepancy").length },
    insights,
    activity: audit.slice(0, 6).map((e) => ({ id: e.id, actor: umap.get(e.actorId)?.name ?? "Unknown", action: e.action, subject: e.subject, at: relative(e.occurredAt, today) })),
  };
}

function daysLeft(today: Date) {
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
}
function listNames(names: string[]) {
  return names.slice(0, 2).join(" and ");
}
