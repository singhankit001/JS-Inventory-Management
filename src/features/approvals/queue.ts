import type { Repository } from "@/lib/data/provider";
import { DECISION, STALE_APPROVAL_HOURS, SUBJECT_LABEL, ageBucket, ageLabel, hoursSince } from "@/features/requests/logic";
import { subjectResolver } from "./subject";

export type QueueView = "pending" | "decided";

export async function loadApprovalQueue(repo: Repository, view: QueueView, now = new Date()) {
  const [approvals, { subject, centre }] = await Promise.all([repo.approvals(), subjectResolver(repo)]);
  const pending = approvals.filter((a) => a.status === "pending");
  // Decided = the last 30 days, newest first; the pending queue is critical first, then oldest first.
  const shown = view === "pending"
    ? [...pending].sort((a, b) => Number(b.critical) - Number(a.critical) || a.requestedAt.localeCompare(b.requestedAt))
    : approvals.filter((a) => a.decidedAt && hoursSince(a.decidedAt, now) <= 30 * 24).sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!));

  const rows = shown.map((a) => {
    const s = subject(a);
    const hours = hoursSince(a.requestedAt, now);
    return {
      id: a.id, subject: { label: s.title, href: `/approvals/${a.id}` }, type: SUBJECT_LABEL[a.subjectType], centre: centre(a.centreId),
      amount: a.amount, waiting: view === "pending" ? ageLabel(hours) : null, hours, age: ageBucket(hours),
      priority: a.critical ? { label: "Critical", tone: "red" as const } : { label: "Standard", tone: "neutral" as const },
      stage: a.stage === "final" ? "Final" : "Head Office", status: DECISION[a.status], requested: a.requestedAt, decided: a.decidedAt ?? null,
    };
  });

  return {
    rows,
    totals: {
      pending: pending.length, value: pending.filter((a) => a.subjectType !== "supplier_price").reduce((s, a) => s + a.amount, 0),
      critical: pending.filter((a) => a.critical).length, stale: pending.filter((a) => hoursSince(a.requestedAt, now) > STALE_APPROVAL_HOURS).length,
      byType: (Object.keys(SUBJECT_LABEL) as (keyof typeof SUBJECT_LABEL)[]).map((t) => ({ type: SUBJECT_LABEL[t], count: pending.filter((a) => a.subjectType === t).length })).filter((t) => t.count),
    },
  };
}
