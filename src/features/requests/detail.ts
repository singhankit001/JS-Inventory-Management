import type { Repository } from "@/lib/data/provider";
import { REQUEST_STATUS, indexBy } from "@/features/dashboards/shared";
import { shortDate, time } from "@/lib/format";
import { DECISION, auditNote, budgetFor, budgetImpact, periodLabel, requestEvents, requestKind, requestSteps, signedPct, variance } from "./logic";
import { historicalValue } from "./monthly";

const PO_STATUS = {
  draft: { label: "Draft", tone: "neutral" }, awaiting_authorisation: { label: "Awaiting authorisation", tone: "amber" }, issued: { label: "Issued", tone: "blue" },
  partially_received: { label: "Part received", tone: "violet" }, received: { label: "Received", tone: "green" }, cancelled: { label: "Cancelled", tone: "slate" },
} as const;
/** Requests whose value is not yet inside committed/spent: it still lands on the budget when ordered. */
const UNCOMMITTED = ["draft", "submitted", "revision_requested", "approved"];

export async function loadRequestDetail(repo: Repository, id: string) {
  const [requests, items, approvals, audit, products, uoms, centres, users, budgets, pos, poLines] = await Promise.all([
    repo.requests(), repo.requestItems(), repo.approvals(), repo.audit(), repo.products(), repo.uoms(), repo.centres(), repo.users(), repo.budgets(), repo.purchaseOrders(), repo.purchaseOrderLines(),
  ]);
  const r = requests.find((x) => x.id === id);
  if (!r) return null;
  const pmap = indexBy(products, "id"), umap = indexBy(users, "id"), uom = indexBy(uoms, "id");
  const centre = centres.find((c) => c.id === r.centreId);
  const centreName = centre?.name ?? r.centreId;
  const lines = items.filter((i) => i.requestId === id);
  const rounds = approvals.filter((a) => a.subjectType === "monthly_request" && a.subjectId === id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const events = requestEvents(audit, r, centreName);
  const hist = historicalValue(lines);
  const itemIds = new Set(lines.map((l) => l.id));
  const poIds = new Set(poLines.filter((l) => l.requestItemId && itemIds.has(l.requestItemId)).map((l) => l.purchaseOrderId));

  const rows = lines.map((i) => {
    const p = pmap.get(i.productId);
    const v = variance(i.proposedQty, i.historicalAvgQty);
    return {
      id: i.id, product: { label: p?.name ?? i.productId, href: `/inventory/catalogue?q=${p?.sku ?? ""}` }, uom: uom.get(p?.uomId ?? "")?.code ?? "",
      proposed: i.proposedQty, historical: i.historicalAvgQty || null, variance: { label: v.label, tone: v.tone },
      flag: v.ratio === null ? "No history" : v.flagged ? (v.ratio > 0 ? "Above history" : "Below history") : "In line",
      approved: i.approvedQty ?? null, unitCost: i.unitCost, value: i.proposedQty * i.unitCost,
    };
  });

  return {
    request: r, centreName, title: `${centreName} · ${periodLabel(r.period)}`, kind: requestKind(r), status: REQUEST_STATUS[r.status],
    steps: requestSteps(r.status, rounds.filter((a) => a.status === "revision_requested").length, r.submittedAt),
    summary: {
      total: r.total, historical: hist, vsHistory: hist ? signedPct(r.total / hist - 1) : "No history", lines: lines.length,
      flagged: rows.filter((x) => x.flag === "Above history" || x.flag === "Below history").length,
      approvedValue: lines.some((l) => l.approvedQty !== undefined) ? lines.reduce((s, l) => s + (l.approvedQty ?? 0) * l.unitCost, 0) : null,
      submittedBy: umap.get(r.submittedBy)?.name ?? "Centre leader", submittedAt: r.submittedAt ? `${shortDate(r.submittedAt)}, ${time(r.submittedAt)}` : "Not submitted",
      source: r.source, reason: r.priority === "emergency" ? events.map((e) => auditNote(e.subject)).findLast(Boolean) : undefined,
    },
    // Latest Head Office comment when it was sent back, so the centre knows what to change.
    returnNote: r.status === "revision_requested" || r.status === "rejected" ? events.filter((e) => /returned|rejected/.test(e.action)).map((e) => auditNote(e.subject)).find(Boolean) : undefined,
    rows,
    impact: budgetImpact(budgetFor(budgets, centre, r.period), UNCOMMITTED.includes(r.status) ? r.total : 0),
    impactPending: UNCOMMITTED.includes(r.status),
    rounds: rounds.map((a, i) => ({
      id: a.id, title: `Round ${rounds.length - i} · ${a.stage === "final" ? "final authorisation" : "Head Office"}`,
      sub: `${shortDate(a.requestedAt)}${a.decidedAt ? ` → ${shortDate(a.decidedAt)} by ${umap.get(a.decidedBy ?? "")?.name ?? "approver"}` : " · waiting"}`,
      badge: DECISION[a.status], href: `/approvals/${a.id}`,
    })),
    pos: pos.filter((p) => poIds.has(p.id)).map((p) => ({ id: p.id, title: p.number, sub: `Expected ${shortDate(p.expectedAt)}`, badge: PO_STATUS[p.status], href: `/procurement/orders?po=${p.id}` })),
    history: events.map((e) => ({ id: e.id, actor: umap.get(e.actorId)?.name ?? "Someone", action: e.action, subject: e.subject.replace(/ \(rq-[^)]*\)/, ""), at: `${shortDate(e.occurredAt)}, ${time(e.occurredAt)}`, tone: (/returned|rejected/.test(e.action) ? "orange" : /approved/.test(e.action) ? "green" : "neutral") as "orange" | "green" | "neutral" })),
  };
}
