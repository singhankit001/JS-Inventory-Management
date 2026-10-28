"use server";

import type { CommandInput } from "@/domain/commands";
import type { ID, MonthlyRequest, RequestItem } from "@/domain/types";
import type { SeedData } from "@/lib/data/seed";
import { period as periodOf } from "@/lib/data/seed";
import { demoCommand, type DemoResult } from "@/lib/demo/command";
import { MONTHLY_REQUEST, transition } from "@/domain/workflows";
import { avgMonthlyUse, periodLabel, requestKind } from "@/features/requests/logic";
import { money } from "@/lib/format";

type Lines = CommandInput<"saveDraftRequest">["items"];
const EDITABLE: MonthlyRequest["status"][] = ["draft", "revision_requested"];

const centreOf = (s: SeedData, id: ID) => s.centres.find((c) => c.id === id);
/** Audit subject naming the request id, so the request page can show its history. */
const subjectOf = (s: SeedData, r: MonthlyRequest, note?: string) =>
  `${requestKind(r)} · ${centreOf(s, r.centreId)?.name ?? r.centreId} · ${periodLabel(r.period)} (${r.id})${note ? ` — ${note}` : ""}`;

/** Prices and history come from the catalogue and the movement ledger, never from the client. */
function buildItems(s: SeedData, requestId: ID, centreId: ID, lines: Lines): RequestItem[] | { code: "validation"; error: string } {
  const use = avgMonthlyUse(s.movements.filter((m) => m.centreId === centreId), s.today);
  const items: RequestItem[] = [];
  for (const [j, l] of lines.entries()) {
    const p = s.products.find((x) => x.id === l.productId && x.status === "active");
    if (!p) return { code: "validation", error: "One of the products is no longer in the catalogue. Remove it and try again." };
    items.push({ id: `${requestId}-${j}`, requestId, productId: p.id, proposedQty: l.proposedQty, historicalAvgQty: Math.round(use.get(`${centreId}:${p.id}`) ?? 0), unitCost: p.unitCost });
  }
  return items;
}

function replaceItems(s: SeedData, requestId: ID, items: RequestItem[]) {
  for (let i = s.requestItems.length - 1; i >= 0; i--) if (s.requestItems[i]!.requestId === requestId) s.requestItems.splice(i, 1);
  s.requestItems.push(...items);
  return items.reduce((sum, i) => sum + i.proposedQty * i.unitCost, 0);
}

/** Create or update a routine request as a draft (one per centre per period). Editing keeps a returned request "needs revision" until resubmitted. */
export async function saveDraftRequest(input: CommandInput<"saveDraftRequest">): Promise<DemoResult<{ id: ID }>> {
  return demoCommand("saveDraftRequest", input, (cmd, s) => {
    if (!centreOf(s, cmd.centreId)) return { code: "not_found", error: "That centre does not exist." };
    if (cmd.requestId) {
      const r = s.requests.find((x) => x.id === cmd.requestId);
      if (!r) return { code: "not_found", error: "That request no longer exists." };
      if (!EDITABLE.includes(r.status)) return { code: "invalid_transition", error: `This request is ${r.status.replace(/_/g, " ")} and can no longer be edited.` };
      if (r.centreId !== cmd.centreId || r.period !== cmd.period) return { code: "validation", error: "The centre and period of an existing request cannot change." };
      return { permission: "requests.create", resource: { centreId: r.centreId } };
    }
    const dup = s.requests.find((x) => x.centreId === cmd.centreId && x.period === cmd.period && x.priority === "routine");
    if (dup) return { code: "conflict", error: `${centreOf(s, cmd.centreId)!.name} already has a ${periodLabel(cmd.period)} request (${dup.id}). Open it instead.` };
    if (cmd.period < periodOf(s.today)) return { code: "validation", error: "Requests can only be raised for this month or a future month." };
    return { permission: "requests.create", resource: { centreId: cmd.centreId } };
  }, (cmd, { store: s, actor, audit }) => {
    const existing = cmd.requestId ? s.requests.find((x) => x.id === cmd.requestId) : undefined;
    const id = existing?.id ?? `rq-${centreOf(s, cmd.centreId)!.code}-${cmd.period}`;
    const items = buildItems(s, id, cmd.centreId, cmd.items);
    if ("error" in items) return items;
    const total = replaceItems(s, id, items);
    const r: MonthlyRequest = existing ?? { id, centreId: cmd.centreId, period: cmd.period, status: "draft", priority: "routine", source: "form", submittedBy: actor.userId, total };
    r.total = total;
    if (!existing) s.requests.push(r);
    audit("saved draft", subjectOf(s, r), r.centreId);
    return { message: `Draft saved · ${items.length} line${items.length === 1 ? "" : "s"}, ${money(total)}`, data: { id } };
  });
}

/**
 * Save the lines, then submit (draft or needs-revision → submitted) and open a Head Office approval round.
 * `note` is the centre's message to Head Office.
 * shortcut: the note lives only in the "submitted" audit event until MonthlyRequest has a notes field.
 */
export async function submitRequest(input: CommandInput<"saveDraftRequest">, note?: string): Promise<DemoResult<{ id: ID }>> {
  const clean = note?.trim().slice(0, 500) || undefined;
  const saved = await saveDraftRequest(input);
  if (!saved.ok) return saved;
  const requestId = saved.data!.id;
  const res = await demoCommand("submitRequest", { requestId }, (cmd, s) => {
    const r = s.requests.find((x) => x.id === cmd.requestId);
    if (!r) return { code: "not_found", error: "That request no longer exists." };
    const t = transition(MONTHLY_REQUEST, r.status, "submit");
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    if (!s.requestItems.some((i) => i.requestId === r.id)) return { code: "validation", error: "Add at least one line before submitting." };
    return { permission: t.permission, resource: { centreId: r.centreId, command: "submit", status: r.status } };
  }, (cmd, { store: s, actor, now, id, audit }) => {
    const r = s.requests.find((x) => x.id === cmd.requestId)!;
    const t = transition(MONTHLY_REQUEST, r.status, "submit");
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    const resubmitted = r.status === "revision_requested";
    Object.assign(r, { status: t.to, submittedAt: now, submittedBy: actor.userId });
    s.approvals.push({ id: id("ap"), subjectType: "monthly_request", subjectId: r.id, centreId: r.centreId, stage: "head_office", status: "pending", amount: r.total, critical: r.priority === "emergency", requestedAt: now });
    audit(resubmitted ? "resubmitted" : "submitted", subjectOf(s, r, clean), r.centreId);
    return { message: `${resubmitted ? "Resubmitted" : "Submitted"} to Head Office · ${money(r.total)}`, data: { id: r.id } };
  });
  return res.ok ? res : { ...res, error: `Draft saved, but not submitted: ${res.error}` };
}

/** Out-of-cycle request: lands submitted with a critical final-stage approval. The reason is kept in the audit trail. */
export async function raiseEmergency(input: CommandInput<"raiseEmergency">): Promise<DemoResult<{ id: ID }>> {
  return demoCommand("raiseEmergency", input, (cmd, s) => {
    if (!centreOf(s, cmd.centreId)) return { code: "not_found", error: "That centre does not exist." };
    const t = transition(MONTHLY_REQUEST, "draft", "raiseEmergency");
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    return { permission: t.permission, resource: { centreId: cmd.centreId, command: "raiseEmergency" } };
  }, (cmd, { store: s, actor, now, id, audit }) => {
    const t = transition(MONTHLY_REQUEST, "draft", "raiseEmergency");
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    const rid = id(`rq-${centreOf(s, cmd.centreId)!.code}-em`);
    const items = buildItems(s, rid, cmd.centreId, cmd.items);
    if ("error" in items) return items;
    const r: MonthlyRequest = {
      id: rid, centreId: cmd.centreId, period: periodOf(s.today), status: t.to, priority: "emergency", source: "form",
      submittedBy: actor.userId, submittedAt: now, total: replaceItems(s, rid, items),
    };
    s.requests.push(r);
    s.approvals.push({ id: id("ap"), subjectType: "monthly_request", subjectId: r.id, centreId: r.centreId, stage: "final", status: "pending", amount: r.total, critical: true, requestedAt: now });
    audit("raised emergency", subjectOf(s, r, cmd.reason), r.centreId);
    return { message: `Emergency request raised · ${money(r.total)} · flagged critical for Head Office`, data: { id: rid } };
  });
}
