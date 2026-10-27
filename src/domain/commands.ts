import { z } from "zod";
import { ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { ROLES, type AIProcessingJob, type Approval, type Centre, type Payment, type StockCount, type Supplier } from "./types";

/**
 * Input schemas for every Phase 2 write named in `lib/modules.ts` (`writes`). Trust-boundary validation only:
 * permissions, centre scope and status changes are decided by lib/auth/policy and domain/workflows, and prices,
 * totals and actors are always read server-side, never taken from these payloads.
 */

const id = z.string().trim().min(1);
/** Integer paise (INR × 100). */
const paise = z.int().nonnegative();
const qty = z.int().nonnegative();
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");
const text = (max: number) => z.string().trim().min(1).max(max);
/** Enum tied to a domain union: a missing or extra member is a compile error. */
const oneOf = <T extends string>(members: Record<T, true>) => z.enum(Object.keys(members) as [T, ...T[]]);

const uniqueBy = <T>(key: (row: T) => string, label: string) => (rows: T[], ctx: z.RefinementCtx) => {
  if (new Set(rows.map(key)).size !== rows.length) ctx.addIssue({ code: "custom", message: `Each ${label} may appear only once` });
};

const requestLines = z.array(z.object({ productId: id, proposedQty: qty.positive() })).superRefine(uniqueBy((l) => l.productId, "product"));

const roleAssignment = z.object({ roles: z.array(z.enum(ROLES)).min(1), centreIds: z.array(id) })
  // Mirrors session.scopeFor: an empty centre list means "all centres", which only organisation roles may have.
  .refine((a) => a.centreIds.length > 0 || a.roles.every((r) => ROLE_DEFINITIONS[r].scope === "organisation"), {
    message: "Centre roles need at least one centre", path: ["centreIds"],
  });

export const COMMANDS = {
  saveDraftRequest: z.object({ requestId: id.optional(), centreId: id, period, items: requestLines }),
  submitRequest: z.object({ requestId: id }),
  raiseEmergency: z.object({ centreId: id, reason: text(500), items: requestLines.min(1) }),
  uploadMedia: z.object({
    centreId: id, kind: oneOf<Extract<AIProcessingJob["kind"], `${string}_request`>>({ audio_request: true, video_request: true }),
    contentType: z.string().regex(/^(audio|video)\/[\w.+-]+$/), sizeBytes: z.int().positive().max(200 * 1024 * 1024),
  }).refine((m) => m.contentType.startsWith(m.kind === "audio_request" ? "audio/" : "video/"), { message: "File type does not match the request kind", path: ["contentType"] }),
  confirmAIDraft: z.object({ jobId: id, items: requestLines.min(1) }),
  decideApproval: z.object({
    approvalId: id,
    decision: oneOf<Exclude<Approval["status"], "pending">>({ approved: true, rejected: true, revision_requested: true }),
    comment: z.string().trim().max(1000).optional(),
    /** Line-level edits for request approvals. */
    lines: z.array(z.object({ requestItemId: id, approvedQty: qty })).superRefine(uniqueBy((l) => l.requestItemId, "line")).optional(),
  }).refine((d) => d.decision === "approved" || !!d.comment, { message: "Say why, so the centre can act on it", path: ["comment"] }),
  setBudget: z.object({ centreId: id, period, allocated: paise }),
  requestQuotation: z.object({ productId: id, supplierIds: z.array(id).min(1).superRefine(uniqueBy((s) => s, "supplier")) }),
  raisePO: z.object({
    supplierId: id, centreId: id, expectedAt: z.iso.date(),
    lines: z.array(z.object({ productId: id, quantity: qty.positive(), unitPrice: paise, requestItemId: id.optional() }))
      .min(1).superRefine(uniqueBy((l) => l.productId, "product")),
  }),
  authorisePO: z.object({ purchaseOrderId: id }),
  upsertSupplier: z.object({
    id: id.optional(), name: text(120), categoryIds: z.array(id), status: oneOf<Supplier["status"]>({ approved: true, pending: true, blocked: true }), avgLeadDays: qty,
  }),
  recordGoodsReceipt: z.object({
    purchaseOrderId: id,
    lines: z.array(z.object({ purchaseOrderLineId: id, receivedQty: qty, damagedQty: qty })
      .refine((l) => l.damagedQty <= l.receivedQty, { message: "Damaged units cannot exceed units received", path: ["damagedQty"] }))
      .min(1).superRefine(uniqueBy((l) => l.purchaseOrderLineId, "order line")),
  }),
  queryInvoice: z.object({ invoiceId: id, reason: text(1000) }),
  approveInvoice: z.object({ invoiceId: id }),
  recordPayment: z.object({ invoiceId: id, amount: paise.positive(), paidAt: z.iso.datetime({ offset: true }), method: oneOf<Payment["method"]>({ neft: true, upi: true, cheque: true }) }),
  submitStockCount: z.object({
    centreId: id, period, kind: oneOf<StockCount["kind"]>({ opening: true, closing: true }),
    lines: z.array(z.object({ productId: id, onHand: qty })).min(1).superRefine(uniqueBy((l) => l.productId, "product")),
  }),
  inviteUser: z.object({ name: text(120), email: z.email() }).and(roleAssignment),
  assignRoles: z.object({ userId: id }).and(roleAssignment),
  upsertCentre: z.object({
    id: id.optional(), code: z.string().regex(/^[A-Z0-9-]{2,12}$/), name: text(120), city: text(80),
    status: oneOf<Centre["status"]>({ active: true, inactive: true }), monthlyBudget: paise,
  }),
  // shortcut: only settings the app already models (request window, critical-approval threshold); extend with the config table.
  updateConfig: z.object({
    requestWindow: z.object({ opensOnDay: z.int().min(1).max(28), closesOnDay: z.int().min(1).max(28) })
      .refine((w) => w.opensOnDay < w.closesOnDay, { message: "The window must open before it closes" }),
    criticalApprovalThreshold: paise,
  }).partial().refine((c) => Object.keys(c).length > 0, { message: "Nothing to update" }),
};

export type CommandName = keyof typeof COMMANDS;
/** What a form/server action sends for a command. */
export type CommandInput<K extends CommandName> = z.input<(typeof COMMANDS)[K]>;
