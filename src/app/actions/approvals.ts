"use server";

import type { CommandInput } from "@/domain/commands";
import type { SeedData } from "@/lib/data/seed";
import type { Approval } from "@/domain/types";
import { demoCommand } from "@/lib/demo/command";
import { DECISION_PAST, approvedQuantities, planDecision } from "@/features/approvals/decide";
import { periodLabel, requestKind } from "@/features/requests/logic";
import { money } from "@/lib/format";

const centreName = (s: SeedData, id?: string) => s.centres.find((c) => c.id === id)?.name ?? "All centres";

/** "Monthly request · Andheri West · Oct 2026 (rq-…)" — the request id lets the request page find its history. */
function auditSubject(s: SeedData, a: Approval) {
  const r = s.requests.find((x) => x.id === a.subjectId);
  if (a.subjectType === "monthly_request" && r) return `${requestKind(r)} · ${centreName(s, r.centreId)} · ${periodLabel(r.period)} (${r.id})`;
  const q = s.quotations.find((x) => x.id === a.subjectId);
  if (a.subjectType === "supplier_price" && q) return `Supplier price · ${s.products.find((p) => p.id === q.productId)?.name ?? q.productId} (${a.id})`;
  return `${a.subjectType.replace(/_/g, " ")} ${a.subjectId} (${a.id})`;
}

/** Approve / return for revision / reject. APPROVAL and MONTHLY_REQUEST transitions both apply; SoD comes from policy. */
export async function decideApproval(input: CommandInput<"decideApproval">) {
  return demoCommand("decideApproval", input, (cmd, s) => {
    const a = s.approvals.find((x) => x.id === cmd.approvalId);
    if (!a) return { code: "not_found", error: "That approval no longer exists." };
    const plan = planDecision(a, s.requests.find((r) => r.id === a.subjectId), cmd.decision);
    if (!plan.ok) return { code: plan.code, error: plan.reason };
    return { permission: plan.permission, resource: { centreId: a.centreId, command: plan.command, status: a.status } };
  }, (cmd, { store: s, actor, now, audit }) => {
    const a = s.approvals.find((x) => x.id === cmd.approvalId)!;
    const r = s.requests.find((x) => x.id === a.subjectId && a.subjectType === "monthly_request");
    const plan = planDecision(a, r, cmd.decision);
    if (!plan.ok) return { code: plan.code, error: plan.reason };
    const items = r ? s.requestItems.filter((i) => i.requestId === r.id) : [];
    // Validate every line before anything changes.
    const qty = r && cmd.decision === "approved" ? approvedQuantities(items, cmd.lines) : undefined;
    if (qty && "error" in qty) return { code: "validation", error: qty.error };

    a.status = plan.to;
    a.decidedBy = actor.userId;
    a.decidedAt = now;
    if (r && plan.requestTo) r.status = plan.requestTo;
    if (qty) for (const i of items) i.approvedQty = qty.get(i.id);
    audit(DECISION_PAST[cmd.decision], `${auditSubject(s, a)}${cmd.comment ? ` — ${cmd.comment}` : ""}`, a.centreId);

    const who = r ? `${centreName(s, r.centreId)} request` : "Supplier price";
    if (qty) {
      const value = items.reduce((sum, i) => sum + (i.approvedQty ?? 0) * i.unitCost, 0);
      const trimmed = items.filter((i) => (i.approvedQty ?? 0) < i.proposedQty).length;
      return { message: `${who} approved at ${money(value)}${trimmed ? ` (${trimmed} line${trimmed === 1 ? "" : "s"} trimmed)` : ""}` };
    }
    return { message: `${who} ${DECISION_PAST[cmd.decision]}` };
  });
}
