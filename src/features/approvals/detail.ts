import type { Repository } from "@/lib/data/provider";
import type { ListRow } from "@/components/dashboard/lists";
import { authorize, type Actor } from "@/lib/auth/policy";
import { REQUEST_STATUS, indexBy } from "@/features/dashboards/shared";
import { DECISION, SUBJECT_LABEL, approvalSteps, auditNote, budgetFor, hoursSince, ageLabel, periodLabel, requestEvents, requestSteps, signedPct, variance } from "@/features/requests/logic";
import { money, shortDate, time } from "@/lib/format";
import { DECISION_COMMAND, planDecision, type DecisionKind } from "./decide";
import { subjectResolver } from "./subject";

export interface ReviewLine {
  id: string; product: string; sku: string; uom: string; proposed: number; historical: number; onHand: number;
  unitCost: number; approved: number; variance: { label: string; tone: ReturnType<typeof variance>["tone"] };
}

export async function loadApprovalDetail(repo: Repository, id: string, actor: Actor, now = new Date()) {
  const [approvals, items, budgets, balances, uoms, users, audit, res] = await Promise.all([
    repo.approvals(), repo.requestItems(), repo.budgets(), repo.balances(), repo.uoms(), repo.users(), repo.audit(), subjectResolver(repo),
  ]);
  const a = approvals.find((x) => x.id === id);
  if (!a) return null;
  const umap = indexBy(users, "id"), uom = indexBy(uoms, "id");
  const r = a.subjectType === "monthly_request" ? res.rmap.get(a.subjectId) : undefined;
  const centre = res.centres.find((c) => c.id === (r?.centreId ?? a.centreId));
  const subject = res.subject(a);

  const lines: ReviewLine[] = r ? items.filter((i) => i.requestId === r.id).map((i) => {
    const p = res.pmap.get(i.productId);
    const v = variance(i.proposedQty, i.historicalAvgQty);
    return {
      id: i.id, product: p?.name ?? i.productId, sku: p?.sku ?? "", uom: uom.get(p?.uomId ?? "")?.code ?? "", proposed: i.proposedQty, historical: i.historicalAvgQty,
      onHand: balances.find((b) => b.centreId === r.centreId && b.productId === i.productId)?.onHand ?? 0, unitCost: i.unitCost,
      approved: i.approvedQty ?? i.proposedQty, variance: { label: v.label, tone: v.tone },
    };
  }) : [];

  // Every decision is checked exactly as the action will check it: workflow first, then policy (permission, SoD, centre scope).
  const decisions = (Object.keys(DECISION_COMMAND) as DecisionKind[]).map((decision) => {
    const plan = planDecision(a, r, decision);
    if (!plan.ok) return { decision, allowed: false, reason: plan.reason };
    const verdict = authorize(actor, plan.permission, { centreId: a.centreId, command: plan.command, status: a.status });
    return verdict.allowed ? { decision, allowed: true } : { decision, allowed: false, reason: verdict.reason };
  });

  const events = r ? requestEvents(audit, r, centre?.name ?? "") : audit.filter((e) => e.subject.includes(`(${a.id})`)).sort((x, y) => y.occurredAt.localeCompare(x.occurredAt));
  const hist = lines.reduce((s, l) => s + l.historical * l.unitCost, 0);
  const po = a.subjectType === "purchase_order" ? res.pomap.get(a.subjectId) : undefined;
  const q = a.subjectType === "supplier_price" ? res.qmap.get(a.subjectId) : undefined;
  const qp = q && res.pmap.get(q.productId);

  const facts: { label: string; value: string }[] = r ? [
    { label: "Requested value", value: money(r.total) },
    { label: "At historical use", value: hist ? `${money(hist)} (${signedPct(r.total / hist - 1)})` : "No history" },
    { label: "Lines · flagged", value: `${lines.length} · ${lines.filter((l) => l.variance.tone !== "neutral").length}` },
    { label: "Request status", value: REQUEST_STATUS[r.status].label },
    { label: "Submitted by", value: `${umap.get(r.submittedBy)?.name ?? "Centre leader"} · ${r.source}` },
  ] : po ? [
    { label: "Order value", value: money(po.total) }, { label: "Supplier", value: res.smap.get(po.supplierId)?.name ?? "—" },
    { label: "Raised by", value: umap.get(po.raisedBy)?.name ?? "—" }, { label: "Expected", value: shortDate(po.expectedAt) },
    { label: "Paid above quote", value: money(Math.max(0, po.priceVariance)) },
  ] : q && qp ? [
    { label: "Quoted unit price", value: money(q.unitPrice) }, { label: "Catalogue cost", value: money(qp.unitCost) },
    { label: "Difference", value: signedPct(q.unitPrice / qp.unitCost - 1) }, { label: "Supplier", value: res.smap.get(q.supplierId)?.name ?? "—" },
    { label: "Quote valid until", value: shortDate(q.validUntil) },
  ] : [{ label: "Value", value: money(a.amount) }];

  const otherRounds: ListRow[] = r ? approvals.filter((x) => x.subjectType === "monthly_request" && x.subjectId === r.id && x.id !== a.id).map((x) => ({
    id: x.id, title: `${shortDate(x.requestedAt)} round`, sub: x.decidedAt ? `Decided ${shortDate(x.decidedAt)}` : "Waiting", badge: DECISION[x.status], href: `/approvals/${x.id}`,
  })) : [];

  return {
    approval: a, subject, type: SUBJECT_LABEL[a.subjectType], status: DECISION[a.status], centre: centre ? { id: centre.id, name: centre.name } : undefined,
    title: subject.title, period: r ? periodLabel(r.period) : undefined, waiting: ageLabel(hoursSince(a.requestedAt, now)),
    steps: r ? requestSteps(r.status, approvals.filter((x) => x.subjectId === r.id && x.status === "revision_requested").length, r.submittedAt) : approvalSteps(a),
    facts, lines, decisions, otherRounds,
    budget: r ? budgetFor(budgets, centre, r.period) : undefined,
    decided: a.decidedAt ? { by: umap.get(a.decidedBy ?? "")?.name ?? "Approver", at: `${shortDate(a.decidedAt)}, ${time(a.decidedAt)}`, note: events.map((e) => auditNote(e.subject)).find(Boolean) } : undefined,
    poLink: po ? `/procurement/orders?po=${po.id}` : undefined,
    history: events.map((e) => ({ id: e.id, actor: umap.get(e.actorId)?.name ?? "Someone", action: e.action, subject: e.subject.replace(/ \((rq|ap)-[^)]*\)/, ""), at: `${shortDate(e.occurredAt)}, ${time(e.occurredAt)}` })),
  };
}
