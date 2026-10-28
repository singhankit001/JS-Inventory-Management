import type { Repository } from "@/lib/data/provider";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { Tone } from "@/components/ui/badge";
import { dayOffset, indexBy } from "@/features/dashboards/shared";
import { receiptIssues } from "@/features/dashboards/receiving";
import { period } from "@/lib/data/seed";
import { count, money, moneyCompact, percent, shortDate } from "@/lib/format";
import { EMERGENCY_SLA_HOURS, STALE_APPROVAL_HOURS, SUBJECT_LABEL, ageLabel, budgetFor, hoursSince } from "@/features/requests/logic";
import { subjectResolver } from "./subject";

export type Severity = "critical" | "high" | "medium";
export interface ExceptionItem {
  id: string; severity: Severity; kind: "Budget" | "Approval" | "Emergency" | "Receipt" | "Invoice";
  title: string; sub: string; href: string; permission: PermissionKey; badge: { label: string; tone: Tone };
}
/** Over by more than this share of the allocation is critical rather than high. */
const BUDGET_CRITICAL = 0.1;
const MATCH = { matched: "Query", price_mismatch: "Price mismatch", quantity_mismatch: "Quantity mismatch", unmatched: "Unmatched" } as const;

export async function loadExceptions(repo: Repository, now = new Date()) {
  const today = repo.today();
  const [budgets, approvals, requests, receipts, receiptLines, invoices, res] = await Promise.all([
    repo.budgets(), repo.approvals(), repo.requests(), repo.receipts(), repo.receiptLines(), repo.invoices(), subjectResolver(repo),
  ]);
  const cmap = indexBy(res.centres, "id");
  const thisPeriod = period(today);
  const items: ExceptionItem[] = [];

  for (const c of res.centres) {
    const b = budgetFor(budgets, c, thisPeriod);
    const over = b.spent + b.committed - b.allocated;
    if (over <= 0) continue;
    const share = b.allocated ? over / b.allocated : 1;
    items.push({
      id: `budget-${c.id}`, severity: share > BUDGET_CRITICAL ? "critical" : "high", kind: "Budget", title: `${c.name} over budget`,
      sub: `${moneyCompact(over)} over ${moneyCompact(b.allocated)} · ${moneyCompact(b.committed)} still committed`, href: `/approvals/budgets?period=${thisPeriod}`,
      permission: "budgets.read", badge: { label: `+${percent(share)}`, tone: share > BUDGET_CRITICAL ? "red" : "orange" },
    });
  }

  for (const r of requests) {
    if (r.priority !== "emergency" || r.status !== "submitted" || !r.submittedAt) continue;
    const h = hoursSince(r.submittedAt, now);
    if (h <= EMERGENCY_SLA_HOURS) continue;
    items.push({
      id: `sla-${r.id}`, severity: "critical", kind: "Emergency", title: `Emergency · ${cmap.get(r.centreId)?.name ?? r.centreId}`,
      sub: `Raised ${ageLabel(h)} ago · ${money(r.total)} · no decision yet`, href: `/requests/${r.id}`, permission: "requests.read", badge: { label: `SLA ${EMERGENCY_SLA_HOURS} h breached`, tone: "red" },
    });
  }

  for (const a of approvals) {
    if (a.status !== "pending") continue;
    const h = hoursSince(a.requestedAt, now);
    if (h <= STALE_APPROVAL_HOURS) continue;
    items.push({
      id: `ap-${a.id}`, severity: a.critical ? "critical" : "high", kind: "Approval", title: res.subject(a).title,
      sub: `${SUBJECT_LABEL[a.subjectType]} · ${res.centre(a.centreId)} · waiting ${ageLabel(h)}`, href: `/approvals/${a.id}`, permission: "requests.approve",
      badge: { label: `Over ${STALE_APPROVAL_HOURS} h`, tone: a.critical ? "red" : "orange" },
    });
  }

  for (const r of receipts) {
    if (r.status !== "discrepancy" || dayOffset(r.receivedAt, today) < -30) continue;
    const { short, damaged } = receiptIssues(receiptLines.filter((l) => l.receiptId === r.id));
    const over = Math.max(0, r.receivedQty - r.orderedQty);
    items.push({
      id: `gr-${r.id}`, severity: "medium", kind: "Receipt", title: `${res.pomap.get(r.purchaseOrderId)?.number ?? r.purchaseOrderId} · ${cmap.get(r.centreId)?.name ?? ""}`,
      sub: [short && `${count(short)} short`, damaged && `${count(damaged)} damaged`, over && `${count(over)} over`, `received ${shortDate(r.receivedAt)}`].filter(Boolean).join(" · "),
      href: "/receiving/discrepancies", permission: "receiving.read", badge: { label: short ? "Shortage" : damaged ? "Damage" : "Over-delivery", tone: "amber" },
    });
  }

  for (const i of invoices) {
    if (i.status === "paid" || (i.match === "matched" && i.status !== "query")) continue;
    items.push({
      id: `inv-${i.id}`, severity: i.match === "unmatched" ? "high" : "medium", kind: "Invoice", title: `${i.number} · ${res.smap.get(i.supplierId)?.name ?? "Supplier"}`,
      sub: `${money(i.amount)} · ${cmap.get(i.centreId)?.name ?? ""}${i.status === "query" ? " · on query" : ""} · due ${shortDate(i.dueAt)}`, href: `/finance/invoices/${i.id}`, permission: "finance.read",
      badge: { label: MATCH[i.match], tone: i.match === "unmatched" ? "red" : "amber" },
    });
  }

  const group = (s: Severity) => items.filter((x) => x.severity === s);
  return {
    groups: [
      { severity: "critical" as const, label: "Critical", note: "Breached SLAs, critical approvals overdue, budgets more than 10% over", items: group("critical") },
      { severity: "high" as const, label: "High", note: `Approvals over ${STALE_APPROVAL_HOURS} h, budgets over, unmatched invoices`, items: group("high") },
      { severity: "medium" as const, label: "Medium", note: "Receipt discrepancies (30 days) and invoice mismatches", items: group("medium") },
    ],
    byKind: (["Budget", "Emergency", "Approval", "Receipt", "Invoice"] as const).map((k) => ({ kind: k, count: items.filter((x) => x.kind === k).length })),
    total: items.length,
  };
}
