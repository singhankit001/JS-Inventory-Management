// Pure decision rules shared by the decideApproval action (enforcement) and the approval page (which buttons are live).
import type { Approval, MonthlyRequest, RequestItem } from "@/domain/types";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { CommandErrorCode } from "@/lib/services/contracts";
import { APPROVAL, MONTHLY_REQUEST, transition } from "@/domain/workflows";

export const DECISION_COMMAND = { approved: "approve", revision_requested: "requestRevision", rejected: "reject" } as const;
export type DecisionKind = keyof typeof DECISION_COMMAND;
export const DECISION_PAST: Record<DecisionKind, string> = { approved: "approved", revision_requested: "returned for revision", rejected: "rejected" };

export type DecisionPlan =
  | { ok: true; command: (typeof DECISION_COMMAND)[DecisionKind]; to: Approval["status"]; requestTo?: MonthlyRequest["status"]; permission: PermissionKey }
  | { ok: false; code: CommandErrorCode; reason: string };

/** Runs the APPROVAL machine and, for requests, the MONTHLY_REQUEST machine: both must allow the move. */
export function planDecision(a: Approval, request: MonthlyRequest | undefined, decision: DecisionKind): DecisionPlan {
  // shortcut: PO approvals are decided by authorisePO on the orders page (PURCHASE_ORDER machine + maker–checker); one write path per subject.
  if (a.subjectType === "purchase_order") return { ok: false, code: "invalid_transition", reason: "Purchase orders are authorised from Purchase orders, where the order lines are checked." };
  const command = DECISION_COMMAND[decision];
  const t = transition(APPROVAL, a.status, command, a);
  if (!t.ok) return { ok: false, code: "invalid_transition", reason: t.reason };
  if (a.subjectType !== "monthly_request") return { ok: true, command, to: t.to, permission: t.permission };
  if (!request) return { ok: false, code: "not_found", reason: "The request for this approval no longer exists." };
  const rt = transition(MONTHLY_REQUEST, request.status, command);
  if (!rt.ok) return { ok: false, code: "invalid_transition", reason: rt.reason };
  return { ok: true, command, to: t.to, requestTo: rt.to, permission: t.permission };
}

/**
 * Line-level approval: Head Office may trim a line (down to 0) but not add to it. Lines left out keep the proposed quantity.
 * Returns approved quantity per request item, or why the edit is not allowed.
 */
export function approvedQuantities(items: RequestItem[], lines: { requestItemId: string; approvedQty: number }[] = []): Map<string, number> | { error: string } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = new Map(items.map((i) => [i.id, i.proposedQty]));
  for (const l of lines) {
    const item = byId.get(l.requestItemId);
    if (!item) return { error: "A reviewed line is not on this request." };
    if (l.approvedQty > item.proposedQty) return { error: `Approve at most the ${item.proposedQty} requested; ask the centre to revise for more.` };
    out.set(l.requestItemId, l.approvedQty);
  }
  if ([...out.values()].every((q) => q === 0)) return { error: "Approve at least one unit, or reject the request." };
  return out;
}
