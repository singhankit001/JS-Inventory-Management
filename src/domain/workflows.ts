/**
 * Lifecycle state machines for every stateful aggregate. Phase 2 contract:
 *
 * - Statuses are the exact unions from `types.ts` (via indexed access), so a renamed or added status breaks the build here.
 * - Each command is one row in a transition table: which statuses it may leave, the status it lands in, the permission
 *   it needs and an optional business guard (e.g. three-way match). No status change happens anywhere else.
 * - A server action never sets `status` itself. It runs the pipeline described in `lib/services/contracts.ts`:
 *   `authorize` (lib/auth/policy) → parse with `COMMANDS` (domain/commands) → load → `transition` → write + audit,
 *   all inside one `UnitOfWork.run`. The Postgres provider persists `to` with a compare-and-set on the old status.
 * - UI asks `allowedCommands` which buttons to show, then filters by `authorize`; anything else is disabled, never hidden logic.
 */
import type { PermissionKey } from "@/lib/auth/permissions";
import type {
  AIProcessingJob, Approval, GoodsReceipt, Invoice, MonthlyRequest, PurchaseOrder, SupplierQuotation,
} from "./types";

export interface Rule<S extends string, X> {
  from: readonly S[];
  to: S;
  /** A function when the permission depends on the subject (e.g. what kind of approval it is). */
  permission: PermissionKey | ((ctx: X) => PermissionKey);
  /** Returns why the command is blocked, or undefined when it may proceed. */
  guard?: (ctx: X) => string | undefined;
}

/** X = facts about the loaded record that guards/permissions need; `void` when none. */
export interface Machine<S extends string, C extends string, X = void> {
  name: string;
  commands: Record<C, Rule<S, X>>;
}

// Curried so S/X are explicit while command names are inferred.
const machine = <S extends string, X = void>() => <C extends string>(name: string, commands: Record<C, Rule<S, X>>): Machine<S, C, X> => ({ name, commands });

type Ctx<X> = X extends void ? [] : [ctx: X];

export function transition<S extends string, C extends string, X>(
  m: Machine<S, C, X>, from: NoInfer<S>, command: NoInfer<C>, ...[ctx]: Ctx<X>
): { ok: true; to: S; permission: PermissionKey } | { ok: false; reason: string } {
  const rule: Rule<S, X> | undefined = Object.hasOwn(m.commands, command) ? m.commands[command] : undefined;
  if (!rule || !rule.from.includes(from)) return { ok: false, reason: `Cannot ${command} a ${m.name} that is ${from.replace(/_/g, " ")}.` };
  const blocked = rule.guard?.(ctx as X);
  if (blocked) return { ok: false, reason: blocked };
  return { ok: true, to: rule.to, permission: typeof rule.permission === "function" ? rule.permission(ctx as X) : rule.permission };
}

/** Commands that would succeed from `from` (guards included). Terminal statuses return []. */
export function allowedCommands<S extends string, C extends string, X>(m: Machine<S, C, X>, from: NoInfer<S>, ...ctx: Ctx<X>): C[] {
  return (Object.keys(m.commands) as C[]).filter((c) => transition(m, from, c, ...ctx).ok);
}

export const MONTHLY_REQUEST = machine<MonthlyRequest["status"]>()("request", {
  submit: { from: ["draft", "revision_requested"], to: "submitted", permission: "requests.create" },
  // Emergency path: same landing status, but skips the monthly window and goes straight to final-stage approval.
  raiseEmergency: { from: ["draft"], to: "submitted", permission: "requests.create" },
  requestRevision: { from: ["submitted"], to: "revision_requested", permission: "requests.approve" },
  approve: { from: ["submitted"], to: "approved", permission: "requests.approve" },
  reject: { from: ["submitted"], to: "rejected", permission: "requests.approve" },
  markOrdered: { from: ["approved"], to: "ordered", permission: "procurement.manage" },
  fulfil: { from: ["ordered"], to: "fulfilled", permission: "receiving.record" },
});

// shortcut: supplier prices map to requests.approve (Head Office reviews prices) until a prices permission exists.
const APPROVER: Record<Approval["subjectType"], PermissionKey> = {
  monthly_request: "requests.approve", purchase_order: "procurement.authorise", supplier_price: "requests.approve", invoice: "finance.manage",
};
const approver = (a: Pick<Approval, "subjectType">) => APPROVER[a.subjectType];

export const APPROVAL = machine<Approval["status"], Pick<Approval, "subjectType">>()("approval", {
  approve: { from: ["pending"], to: "approved", permission: approver },
  reject: { from: ["pending"], to: "rejected", permission: approver },
  requestRevision: { from: ["pending"], to: "revision_requested", permission: approver },
});

export const SUPPLIER_QUOTATION = machine<SupplierQuotation["status"]>()("quotation", {
  recordQuote: { from: ["requested"], to: "received", permission: "procurement.manage" },
  accept: { from: ["received"], to: "accepted", permission: "procurement.manage" },
  decline: { from: ["requested", "received"], to: "declined", permission: "procurement.manage" },
});

export const PURCHASE_ORDER = machine<PurchaseOrder["status"]>()("purchase order", {
  submit: { from: ["draft"], to: "awaiting_authorisation", permission: "procurement.manage" },
  authorise: { from: ["awaiting_authorisation"], to: "issued", permission: "procurement.authorise" },
  returnToDraft: { from: ["awaiting_authorisation"], to: "draft", permission: "procurement.authorise" },
  // Which of the two receive commands applies is decided by the receipt totals (features/dashboards/receiving receiptOutcome).
  receivePart: { from: ["issued", "partially_received"], to: "partially_received", permission: "receiving.record" },
  receiveAll: { from: ["issued", "partially_received"], to: "received", permission: "receiving.record" },
  cancel: { from: ["draft", "awaiting_authorisation", "issued"], to: "cancelled", permission: "procurement.manage" },
});

// shortcut: confirmation reuses receiving.record; a separate receiving.confirm would allow receiver/confirmer maker–checker.
export const GOODS_RECEIPT = machine<GoodsReceipt["status"]>()("goods receipt", {
  confirm: { from: ["pending_confirmation"], to: "confirmed", permission: "receiving.record" },
  flagDiscrepancy: { from: ["pending_confirmation"], to: "discrepancy", permission: "receiving.record" },
});

export const INVOICE = machine<Invoice["status"], Pick<Invoice, "match">>()("invoice", {
  query: { from: ["received"], to: "query", permission: "finance.manage" },
  approve: {
    from: ["received", "query"], to: "approved", permission: "finance.manage",
    // Three-way match: invoice vs PO price vs goods received. Anything else must be queried, not approved.
    guard: (i) => (i.match === "matched" ? undefined : `Three-way match failed (${i.match.replace(/_/g, " ")}); query the invoice instead.`),
  },
  pay: { from: ["approved"], to: "paid", permission: "finance.manage" },
});

const reviewer: Record<AIProcessingJob["kind"], PermissionKey> = {
  audio_request: "requests.create", video_request: "requests.create", invoice_ocr: "finance.manage", insight: "analytics.read",
};

// shortcut: worker steps use admin.config because there is no service principal yet; Phase 2 adds one.
export const AI_JOB = machine<AIProcessingJob["status"], Pick<AIProcessingJob, "kind">>()("AI job", {
  start: { from: ["queued"], to: "processing", permission: "admin.config" },
  flagForReview: { from: ["processing"], to: "needs_review", permission: "admin.config" },
  fail: { from: ["processing"], to: "failed", permission: "admin.config" },
  finish: {
    from: ["processing"], to: "completed", permission: "admin.config",
    // AI output that becomes requests or payables is only a draft until a person confirms it.
    guard: (j) => (j.kind === "insight" ? undefined : "AI drafts must be reviewed by a person before they are used."),
  },
  confirm: { from: ["needs_review"], to: "completed", permission: (j) => reviewer[j.kind] },
});
