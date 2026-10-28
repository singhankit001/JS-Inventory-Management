import type { PurchaseOrder, Supplier, SupplierQuotation } from "@/domain/types";
import type { Tone } from "@/components/ui/badge";
import type { Step } from "@/components/ui/stepper";
import { allowedCommands, transition, PURCHASE_ORDER } from "@/domain/workflows";
import { authorize, type Actor } from "@/lib/auth/policy";
import { can } from "@/lib/auth/permissions";
import { count, shortDate } from "@/lib/format";

export const PO_STATUS: Record<PurchaseOrder["status"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  awaiting_authorisation: { label: "Awaiting authorisation", tone: "amber" },
  issued: { label: "Issued", tone: "blue" },
  partially_received: { label: "Part received", tone: "violet" },
  received: { label: "Received", tone: "green" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

export const SUPPLIER_STATUS: Record<Supplier["status"], { label: string; tone: Tone }> = {
  approved: { label: "Approved", tone: "green" },
  pending: { label: "Pending", tone: "amber" },
  blocked: { label: "Blocked", tone: "red" },
};

export const QUOTE_STATUS: Record<SupplierQuotation["status"], { label: string; tone: Tone }> = {
  requested: { label: "Awaiting reply", tone: "neutral" },
  received: { label: "Received", tone: "blue" },
  accepted: { label: "Accepted", tone: "green" },
  declined: { label: "Declined", tone: "slate" },
};

export const poHref = (id: string) => `/procurement/orders?po=${encodeURIComponent(id)}`;
export const supplierHref = (id: string) => `/procurement/suppliers?supplier=${encodeURIComponent(id)}`;
export const centreHref = (id: string) => `/inventory/centres/${encodeURIComponent(id)}`;
export const productHref = (sku: string) => `/inventory/catalogue?q=${encodeURIComponent(sku)}`;
export const receiptHref = (id: string) => `/receiving/receipts?receipt=${encodeURIComponent(id)}`;

/**
 * Contract price for a supplier/product: its accepted quote, else a received one, else the catalogue cost.
 * Used to prefill the Raise PO form and to compute price variance server-side.
 */
export function referencePrice(quotes: SupplierQuotation[], supplierId: string, productId: string, listPrice: number) {
  const mine = quotes.filter((q) => q.supplierId === supplierId && q.productId === productId);
  return (mine.find((q) => q.status === "accepted") ?? mine.find((q) => q.status === "received"))?.unitPrice ?? listPrice;
}

/** Raised → authorised → issued → received, from the PO status and its delivered units. */
export function poSteps(po: Pick<PurchaseOrder, "status" | "createdAt" | "expectedAt">, units: { ordered: number; outstanding: number }): Step[] {
  const s = po.status;
  const past = (...xs: PurchaseOrder["status"][]) => xs.includes(s);
  const delivered = units.ordered - units.outstanding;
  const cancelled = s === "cancelled";
  return [
    { label: "Raised", state: s === "draft" ? "current" : "done", detail: s === "draft" ? "Draft — not yet submitted" : undefined, at: shortDate(po.createdAt) },
    { label: "Authorised", state: cancelled ? "blocked" : past("issued", "partially_received", "received") ? "done" : s === "awaiting_authorisation" ? "current" : "upcoming", detail: cancelled ? "Cancelled" : s === "awaiting_authorisation" ? "Waiting for an authoriser" : undefined },
    { label: "Issued", state: past("partially_received", "received") ? "done" : s === "issued" ? "current" : "upcoming", detail: s === "issued" ? `Expected ${shortDate(po.expectedAt)}` : undefined },
    { label: "Received", state: s === "received" ? "done" : s === "partially_received" ? "current" : "upcoming", detail: past("partially_received", "received") ? `${count(delivered)} of ${count(units.ordered)} units` : undefined },
  ];
}

/** The authoriser-side commands this page offers. "submit" lets a returned draft go back for authorisation. */
export const PO_ACTIONS = ["authorise", "returnToDraft", "submit"] as const;
export type PoAction = (typeof PO_ACTIONS)[number];
export const PO_ACTION_LABEL: Record<PoAction, string> = { authorise: "Authorise & issue", returnToDraft: "Return to draft", submit: "Submit for authorisation" };

/**
 * Which PO actions to show this actor: workflow-allowed commands they hold the permission for. A command blocked only by
 * separation of duties is kept with its policy reason, so the UI can say why instead of hiding the button.
 */
export function poActions(actor: Actor, po: Pick<PurchaseOrder, "status" | "centreId" | "raisedBy">) {
  return allowedCommands(PURCHASE_ORDER, po.status).filter((c): c is PoAction => (PO_ACTIONS as readonly string[]).includes(c)).flatMap((command) => {
    const t = transition(PURCHASE_ORDER, po.status, command);
    // Only offer what the role can do at all; policy checks SoD before permission, so test the permission first.
    if (!t.ok || !can(actor.role, t.permission)) return [];
    const d = authorize(actor, t.permission, { centreId: po.centreId, makerId: po.raisedBy, command, status: po.status });
    if (!d.allowed && d.code !== "separation_of_duties") return [];
    return [{ command, label: PO_ACTION_LABEL[command], blocked: d.allowed ? undefined : d.reason }];
  });
}

/** Σ quantity × unit price, and the variance against the contract price (positive = paying more than contract). */
export function poTotals(lines: { quantity: number; unitPrice: number; refPrice: number }[]) {
  return {
    total: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    variance: lines.reduce((s, l) => s + l.quantity * (l.unitPrice - l.refPrice), 0),
  };
}

const DAY = 86_400_000;
export const daysBetween = (from: string, to: string | Date) => (new Date(to).getTime() - new Date(from).getTime()) / DAY;
