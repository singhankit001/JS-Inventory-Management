// Pure request/approval maths shared by loaders, client forms and server actions (no server-only imports).
import type { Approval, MonthlyRequest, StockMovement } from "@/domain/types";
import type { Step } from "@/components/ui/stepper";
import type { Tone } from "@/components/ui/badge";
import { percent } from "@/lib/format";

/** An emergency should get a decision within a day. */
export const EMERGENCY_SLA_HOURS = 24;
/** Pending approvals older than this are escalated. */
export const STALE_APPROVAL_HOURS = 48;
/** Proposed quantities this far from the historical average are flagged for review. */
export const VARIANCE_FLAG = 0.25;

export const periodLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};
export const signedPct = (ratio: number) => `${ratio >= 0 ? "+" : "−"}${percent(Math.abs(ratio))}`;
export const hoursSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000));
export const ageLabel = (h: number) => (h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`);
export const ageBucket = (h: number) => (h < 24 ? "Under 24 h" : h <= STALE_APPROVAL_HOURS ? "24–48 h" : "Over 48 h");

/** Average monthly consumption per `centreId:productId` over the `months` complete months before `today`. */
export function avgMonthlyUse(movements: StockMovement[], today: Date, months = 3) {
  const periods = new Set(Array.from({ length: months }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }));
  const out = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== "consumption" || !periods.has(m.occurredAt.slice(0, 7))) continue;
    const k = `${m.centreId}:${m.productId}`;
    out.set(k, (out.get(k) ?? 0) + m.quantity / months);
  }
  return out;
}

/** Cover next month's average use and end the month back at the reorder point, net of stock on hand and already on order. */
export const suggestedQty = (avgUse: number, onHand: number, onOrder: number, reorderPoint: number) =>
  Math.max(0, Math.ceil(avgUse + reorderPoint - onHand - onOrder));

export interface BudgetFigures { allocated: number; spent: number; committed: number }

/** Where a request leaves the month's budget. Shares are of the larger of allocation and total demand, so overspend stays visible. */
export function budgetImpact(b: BudgetFigures, request: number) {
  const used = b.spent + b.committed;
  const headroom = b.allocated - used;
  const after = headroom - request;
  const scale = Math.max(b.allocated, used + request) || 1;
  return {
    ...b, request, headroom, after, over: after < 0,
    utilisation: b.allocated ? (used + request) / b.allocated : 0,
    share: { spent: b.spent / scale, committed: b.committed / scale, request: request / scale, allocation: b.allocated / scale },
  };
}
export type BudgetImpact = ReturnType<typeof budgetImpact>;

/** Proposed vs historical average quantity. No history = "new" (emergencies, first orders). */
export function variance(proposed: number, historical: number): { ratio: number | null; label: string; tone: Tone; flagged: boolean } {
  if (!historical) return { ratio: null, label: "No history", tone: "neutral", flagged: false };
  const ratio = proposed / historical - 1;
  const flagged = Math.abs(ratio) > VARIANCE_FLAG;
  return { ratio, label: signedPct(ratio), tone: flagged ? (ratio > 0 ? "orange" : "blue") : "neutral", flagged };
}

const REQUEST_STAGES = ["Draft", "Submitted", "Head Office review", "Ordered", "Fulfilled"];
const STAGE_AT: Record<MonthlyRequest["status"], number> = { draft: 0, revision_requested: 1, submitted: 2, rejected: 2, approved: 3, ordered: 4, fulfilled: 5 };

/** Request lifecycle for WorkflowStepper. `rounds` = times Head Office returned it, shown as the revision loop. */
export function requestSteps(status: MonthlyRequest["status"], rounds: number, submittedAt?: string): Step[] {
  const at = STAGE_AT[status];
  const steps: Step[] = REQUEST_STAGES.map((label, i) => ({ label, state: i < at ? "done" : i === at ? (status === "rejected" ? "blocked" : "current") : "upcoming" }));
  if (submittedAt && at >= 2) steps[1]!.at = new Date(submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (rounds) steps[1]!.detail = `${rounds} revision round${rounds === 1 ? "" : "s"}`;
  if (status === "revision_requested") steps[1]!.detail = "Returned for revision — edit and resubmit";
  if (status === "rejected") steps[2]!.detail = "Rejected";
  if (status === "approved") steps[3]!.detail = "Approved · awaiting purchase order";
  return steps;
}

/** Approval lifecycle for subjects without their own stepper (prices, purchase orders). */
export function approvalSteps(a: Pick<Approval, "status" | "stage" | "requestedAt" | "decidedAt">): Step[] {
  const d = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : undefined);
  const decided = a.status !== "pending";
  return [
    { label: "Raised", state: "done", at: d(a.requestedAt) },
    { label: a.stage === "final" ? "Final authorisation" : "Head Office review", state: decided ? "done" : "current" },
    { label: decided ? DECISION[a.status].label : "Decision", state: !decided ? "upcoming" : a.status === "approved" ? "done" : "blocked", at: d(a.decidedAt) },
  ];
}

export const DECISION: Record<Approval["status"], { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  revision_requested: { label: "Returned for revision", tone: "orange" },
};

export const SUBJECT_LABEL: Record<Approval["subjectType"], string> = {
  monthly_request: "Request", purchase_order: "Purchase order", supplier_price: "Supplier price", invoice: "Invoice",
};
