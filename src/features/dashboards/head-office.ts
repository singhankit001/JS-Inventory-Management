import type { Repository } from "@/lib/data/provider";
import type { PurchaseOrder } from "@/domain/types";
import { REQUEST_STATUS, dayOffset, hourOf, indexBy, lastPeriods, poOutstanding } from "./shared";
import { receiptIssues } from "./receiving";
import { count, money, moneyCompact, monthLabel, percent, shortDate } from "@/lib/format";
import { period } from "@/lib/data/seed";
import type { Tone } from "@/components/ui/badge";

const signed = (ratio: number) => `${ratio >= 0 ? "+" : "−"}${percent(Math.abs(ratio))}`;

const PO_STAGES: { key: string; label: string; tone: Tone; match: (p: PurchaseOrder, today: Date) => boolean }[] = [
  { key: "auth", label: "Awaiting authorisation", tone: "amber", match: (p) => p.status === "awaiting_authorisation" },
  { key: "issued", label: "Issued · on track", tone: "blue", match: (p, t) => p.status === "issued" && new Date(p.expectedAt) >= t },
  { key: "late", label: "Issued · overdue", tone: "red", match: (p, t) => p.status === "issued" && new Date(p.expectedAt) < t },
  { key: "partial", label: "Partially received", tone: "violet", match: (p) => p.status === "partially_received" },
  { key: "received", label: "Received · last 30 days", tone: "green", match: (p) => p.status === "received" },
];

const MATCH_LABEL = { matched: "Matched", price_mismatch: "Price mismatch", quantity_mismatch: "Quantity mismatch", unmatched: "Unmatched" } as const;

export async function loadHeadOffice(repo: Repository) {
  const today = repo.today();
  const [centres, requests, items, approvals, budgets, pos, receipts, invoices, suppliers, quotations, products, poLines, receiptLines] = await Promise.all([
    repo.centres(), repo.requests(), repo.requestItems(), repo.approvals(), repo.budgets(), repo.purchaseOrders(), repo.receipts(), repo.invoices(), repo.suppliers(), repo.quotations(), repo.products(),
    repo.purchaseOrderLines(), repo.receiptLines(),
  ]);
  const cmap = indexBy(centres, "id");
  const smap = indexBy(suppliers, "id");
  const pmap = indexBy(products, "id");
  const qmap = indexBy(quotations, "id");
  const pomap = indexBy(pos, "id");
  const thisPeriod = period(today);
  const periods = lastPeriods(today, 6);

  // Requests in review, each compared with what the same lines cost at historical average quantities.
  const inReview = requests
    .filter((r) => r.status === "submitted" || r.status === "revision_requested")
    .map((r) => {
      const lines = items.filter((i) => i.requestId === r.id);
      const historical = lines.reduce((s, i) => s + i.historicalAvgQty * i.unitCost, 0);
      return { r, lines, historical, vsHistory: historical ? r.total / historical - 1 : null };
    });
  const submitted = inReview.filter((x) => x.r.status === "submitted");
  const reviewValue = submitted.reduce((s, x) => s + x.r.total, 0);
  const withHistory = inReview.filter((x) => x.historical > 0);
  const reviewHist = withHistory.reduce((s, x) => s + x.historical, 0);
  const reviewVsHist = reviewHist ? withHistory.reduce((s, x) => s + x.r.total, 0) / reviewHist - 1 : 0;

  const pending = approvals.filter((a) => a.status === "pending");
  const poApprovals = pending.filter((a) => a.subjectType === "purchase_order");
  const priceApprovals = pending.filter((a) => a.subjectType === "supplier_price");

  const budgetRows = centres.map((c) => {
    const b = budgets.find((x) => x.centreId === c.id && x.period === thisPeriod);
    const allocated = b?.allocated ?? 0, spent = b?.spent ?? 0, committed = b?.committed ?? 0;
    const left = allocated - spent - committed;
    return {
      id: c.id, name: c.name, city: c.city, spent, committed, allocated,
      spentPct: allocated ? spent / allocated : 0, committedPct: allocated ? committed / allocated : 0,
      over: left < 0, detail: `${moneyCompact(spent)} spent · ${moneyCompact(committed)} committed`,
      left: left >= 0 ? `${moneyCompact(left)} left` : `${moneyCompact(-left)} over`,
    };
  });
  const totAlloc = budgetRows.reduce((s, b) => s + b.allocated, 0);
  const totUsed = budgetRows.reduce((s, b) => s + b.spent + b.committed, 0);

  const openPOs = pos.filter((p) => ["awaiting_authorisation", "issued", "partially_received"].includes(p.status));
  const { byPo } = poOutstanding(poLines, receiptLines);
  const linesOf = (receiptId: string) => receiptLines.filter((l) => l.receiptId === receiptId);
  const lastReceipt = new Map<string, string>();
  for (const r of receipts) if ((lastReceipt.get(r.purchaseOrderId) ?? "") < r.receivedAt) lastReceipt.set(r.purchaseOrderId, r.receivedAt);
  // Closed orders only stay on the pipeline for 30 days; a year of history would drown the open stages.
  const pipelinePOs = pos.filter((p) => p.status !== "received" || dayOffset(lastReceipt.get(p.id) ?? p.expectedAt, today) >= -30);
  const discrepancies = receipts.filter((r) => r.status === "discrepancy" && dayOffset(r.receivedAt, today) >= -30).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const invoiceExceptions = invoices.filter((i) => i.status !== "paid" && (i.match !== "matched" || i.status === "query"));

  const queue = [
    ...inReview.map(({ r, vsHistory }) => ({
      id: r.id, item: `${cmap.get(r.centreId)?.name ?? "Centre"} · ${monthLabel(r.period)} request`, type: r.priority === "emergency" ? "Emergency request" : "Monthly request",
      centre: cmap.get(r.centreId)?.name ?? "—", amount: r.total, vsHistory: vsHistory === null ? null : signed(vsHistory), submitted: r.submittedAt ?? null,
      priority: r.priority === "emergency" ? { label: "Emergency", tone: "red" as Tone } : { label: "Routine", tone: "neutral" as Tone },
      status: REQUEST_STATUS[r.status],
    })),
    ...poApprovals.map((a) => {
      const po = pomap.get(a.subjectId);
      return {
        id: a.id, item: `${po?.number ?? a.subjectId} · ${smap.get(po?.supplierId ?? "")?.name ?? "Supplier"}`, type: "Purchase order",
        centre: cmap.get(a.centreId ?? "")?.name ?? "—", amount: a.amount, vsHistory: null, submitted: a.requestedAt,
        priority: a.critical ? { label: "Critical", tone: "red" as Tone } : { label: "Standard", tone: "neutral" as Tone },
        status: { label: "Awaiting authorisation", tone: "violet" as Tone },
      };
    }),
    ...priceApprovals.map((a) => {
      const q = qmap.get(a.subjectId), p = pmap.get(q?.productId ?? "");
      return {
        id: a.id, item: `${p?.name ?? "Product"} · ${smap.get(q?.supplierId ?? "")?.name ?? "Supplier"}`, type: "Supplier price",
        centre: "All centres", amount: a.amount, vsHistory: p && q ? signed(q.unitPrice / p.unitCost - 1) : null, submitted: a.requestedAt,
        priority: { label: "Standard", tone: "neutral" as Tone }, status: { label: "Price review", tone: "orange" as Tone },
      };
    }),
  ].sort((a, b) => (a.priority.tone === "red" ? 0 : 1) - (b.priority.tone === "red" ? 0 : 1) || (a.submitted ?? "").localeCompare(b.submitted ?? ""));

  const todays = (iso?: string) => !!iso && new Date(iso).toDateString() === today.toDateString();
  const events = [
    ...requests.filter((r) => todays(r.submittedAt)).map((r) => ({ id: r.id, hour: hourOf(r.submittedAt!), label: `${r.priority === "emergency" ? "Emergency request" : "Request"} · ${cmap.get(r.centreId)?.name}`, tone: (r.priority === "emergency" ? "red" : "orange") as Tone })),
    ...pos.filter((p) => p.status === "issued" && todays(p.expectedAt)).map((p) => ({ id: p.id, hour: hourOf(p.expectedAt), label: `${p.number} delivery · ${cmap.get(p.centreId)?.name}`, tone: "blue" as Tone })),
    ...priceApprovals.filter((a) => todays(a.requestedAt)).map((a) => ({ id: a.id, hour: hourOf(a.requestedAt), label: "Supplier price submitted", tone: "violet" as Tone })),
  ];

  return {
    centreCount: centres.length,
    welcome: {
      submitted: submitted.length, revision: inReview.length - submitted.length, poAuth: poApprovals.length, emergency: inReview.filter((x) => x.r.priority === "emergency").length,
      events, nowHour: new Date().getHours() + new Date().getMinutes() / 60,
    },
    review: {
      value: reviewValue, vsHistory: reviewVsHist,
      rows: withHistory.map(({ r, historical, vsHistory }) => ({
        label: cmap.get(r.centreId)?.name ?? r.centreId, sub: `${REQUEST_STATUS[r.status].label} · history ${moneyCompact(historical)}`,
        value: r.total, marker: historical, display: signed(vsHistory ?? 0), tone: ((vsHistory ?? 0) > 0.15 ? "orange" : "blue") as Tone,
      })),
    },
    kpis: {
      pendingValue: pending.reduce((s, a) => s + a.amount, 0) + inReview.filter((x) => x.r.status === "revision_requested").reduce((s, x) => s + x.r.total, 0),
      queueCount: queue.length, critical: queue.filter((q) => q.priority.tone === "red").length,
      utilisation: totAlloc ? totUsed / totAlloc : 0, headroom: moneyCompact(totAlloc - totUsed),
      utilSpark: periods.map((p) => { const bs = budgets.filter((b) => b.period === p); const a = bs.reduce((s, b) => s + b.allocated, 0); return a ? bs.reduce((s, b) => s + b.spent + b.committed, 0) / a : 0; }),
      openPOs: openPOs.length, openPOValue: moneyCompact(openPOs.reduce((s, p) => s + byPo(p).value, 0)), overduePOs: pos.filter((p) => p.status === "issued" && new Date(p.expectedAt) < today).length,
      exceptions: discrepancies.length + invoiceExceptions.length, discrepancies: discrepancies.length, invoiceExceptions: invoiceExceptions.length,
    },
    spendTrend: periods.map((p) => {
      const bs = budgets.filter((b) => b.period === p);
      return { label: monthLabel(p), a: bs.reduce((s, b) => s + b.spent, 0), b: bs.reduce((s, b) => s + b.allocated, 0) };
    }),
    budgets: budgetRows,
    priceApprovals: [
      ...priceApprovals.map((a) => {
        const q = qmap.get(a.subjectId), p = pmap.get(q?.productId ?? "");
        const delta = p && q ? q.unitPrice / p.unitCost - 1 : 0;
        return { id: a.id, title: p?.name ?? "Product", sub: `${smap.get(q?.supplierId ?? "")?.name ?? "Supplier"} · ${money(q?.unitPrice ?? a.amount)} vs ${money(p?.unitCost ?? 0)}`, badge: { label: signed(delta), tone: (delta > 0.005 ? "orange" : "green") as Tone } };
      }),
      ...suppliers.filter((s) => s.status === "pending").map((s) => ({ id: s.id, title: s.name, sub: `New supplier · on-time ${percent(s.onTimeRate)} · quality ${percent(s.qualityScore)}`, badge: { label: "Onboarding", tone: "amber" as Tone } })),
    ],
    pipeline: PO_STAGES.map((st) => {
      const rows = pipelinePOs.filter((p) => st.match(p, today));
      return { label: st.label, tone: st.tone, value: rows.length, display: `${rows.length} · ${moneyCompact(rows.reduce((s, p) => s + p.total, 0))}` };
    }).filter((s) => s.value > 0),
    poTotals: { open: openPOs.length, variance: moneyCompact(pos.filter((p) => dayOffset(p.createdAt, today) >= -30).reduce((s, p) => s + Math.max(0, p.priceVariance), 0)) },
    exceptions: [
      ...discrepancies.map((r) => {
        const po = pomap.get(r.purchaseOrderId);
        const { short, damaged } = receiptIssues(linesOf(r.id));
        return {
          id: r.id, kind: "receipt" as const, title: `${po?.number ?? r.purchaseOrderId} · ${cmap.get(r.centreId)?.name ?? ""}`,
          sub: [short && `${count(short)} short`, damaged && `${count(damaged)} damaged`, r.receivedQty > r.orderedQty && `${count(r.receivedQty - r.orderedQty)} over`, shortDate(r.receivedAt)].filter(Boolean).join(" · "),
          badge: { label: short ? "Shortage" : damaged ? "Damage" : "Over-delivery", tone: "amber" as Tone },
        };
      }),
      ...invoiceExceptions.map((i) => ({
        id: i.id, kind: "invoice" as const, title: `${i.number} · ${smap.get(i.supplierId)?.name ?? ""}`,
        sub: `${money(i.amount)} · ${cmap.get(i.centreId)?.name ?? ""}${i.status === "query" ? " · on query" : ""}`,
        badge: { label: i.match === "matched" ? "Query" : MATCH_LABEL[i.match], tone: (i.match === "unmatched" ? "red" : "amber") as Tone },
      })),
    ],
    queue,
  };
}
