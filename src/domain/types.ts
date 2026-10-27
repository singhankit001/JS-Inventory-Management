// Core business models for Jumpstart Smart Inventory OS.
// Money is stored as integer paise (INR × 100) to avoid float drift.
// Dates are ISO-8601 strings so models serialise across the server/client boundary unchanged.

export type ID = string;
export type ISODate = string;
export type Paise = number;

export const ROLES = [
  "ceo",
  "head_office",
  "centre_leader",
  "purchasing",
  "finance",
  "receiving",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];

export interface Centre {
  id: ID;
  code: string;
  name: string;
  city: string;
  status: "active" | "inactive";
  monthlyBudget: Paise;
}

export interface User {
  id: ID;
  name: string;
  email: string;
  roles: Role[];
  /** Centres the user may see. Empty = all centres (only for organisation-wide roles). */
  centreIds: ID[];
  status: "active" | "suspended";
  lastActiveAt: ISODate;
}

export interface Permission {
  key: string;
  description: string;
}

export interface RoleDefinition {
  role: Role;
  label: string;
  description: string;
  scope: "organisation" | "centre";
  permissions: readonly string[];
}

export interface ProductCategory {
  id: ID;
  name: string;
  color: "blue" | "orange" | "green" | "amber" | "violet" | "slate";
}

export interface UnitOfMeasure {
  id: ID;
  code: string; // "pcs", "box", "kg", "L", "pack"
  name: string;
}

export interface Product {
  id: ID;
  sku: string;
  name: string;
  categoryId: ID;
  uomId: ID;
  unitCost: Paise;
  reorderPoint: number;
  status: "active" | "discontinued";
}

export interface StockBalance {
  centreId: ID;
  productId: ID;
  onHand: number;
  updatedAt: ISODate;
}

export interface StockMovement {
  id: ID;
  centreId: ID;
  productId: ID;
  type: "receipt" | "consumption" | "transfer_in" | "transfer_out" | "adjustment";
  quantity: number;
  occurredAt: ISODate;
  reference?: ID;
}

export interface StockCount {
  id: ID;
  centreId: ID;
  period: string; // "2026-10"
  kind: "opening" | "closing";
  status: "not_started" | "in_progress" | "submitted";
  submittedAt?: ISODate;
}

export type RequestStatus =
  | "draft"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "ordered"
  | "fulfilled";

export interface MonthlyRequest {
  id: ID;
  centreId: ID;
  period: string;
  status: RequestStatus;
  priority: "routine" | "emergency";
  source: "form" | "audio" | "video";
  submittedBy: ID;
  submittedAt?: ISODate;
  total: Paise;
}

export interface RequestItem {
  id: ID;
  requestId: ID;
  productId: ID;
  proposedQty: number;
  historicalAvgQty: number;
  approvedQty?: number;
  unitCost: Paise;
}

export interface Approval {
  id: ID;
  subjectType: "monthly_request" | "purchase_order" | "supplier_price" | "invoice";
  subjectId: ID;
  centreId?: ID;
  stage: "head_office" | "final";
  status: "pending" | "approved" | "rejected" | "revision_requested";
  amount: Paise;
  critical: boolean;
  requestedAt: ISODate;
  decidedBy?: ID;
  decidedAt?: ISODate;
}

export interface Supplier {
  id: ID;
  name: string;
  categoryIds: ID[];
  status: "approved" | "pending" | "blocked";
  onTimeRate: number; // 0..1
  qualityScore: number; // 0..1
  avgLeadDays: number;
}

export interface SupplierQuotation {
  id: ID;
  supplierId: ID;
  productId: ID;
  unitPrice: Paise;
  validUntil: ISODate;
  status: "requested" | "received" | "accepted" | "declined";
}

export interface PurchaseOrder {
  id: ID;
  number: string;
  supplierId: ID;
  centreId: ID;
  status: "draft" | "awaiting_authorisation" | "issued" | "partially_received" | "received" | "cancelled";
  total: Paise;
  expectedAt: ISODate;
  createdAt: ISODate;
  /** User who raised the PO — separation of duties: they cannot also authorise it. */
  raisedBy: ID;
  /** Positive = paid more than quoted. */
  priceVariance: Paise;
}

/** One product on a purchase order. Invariant: PurchaseOrder.total = Σ quantity × unitPrice. */
export interface PurchaseOrderLine {
  id: ID;
  purchaseOrderId: ID;
  productId: ID;
  /** In the product's unit of measure. */
  quantity: number;
  unitPrice: Paise;
  /** Set when the line came from an approved request item. */
  requestItemId?: ID;
}

export interface GoodsReceipt {
  id: ID;
  purchaseOrderId: ID;
  centreId: ID;
  receivedAt: ISODate;
  receivedBy: ID;
  status: "pending_confirmation" | "confirmed" | "discrepancy";
  /** Totals across this receipt's lines (kept denormalised for list views). */
  orderedQty: number;
  receivedQty: number;
  damagedQty: number;
}

/** Item-level count for one PO line on one delivery. orderedQty = quantity still outstanding when it arrived. */
export interface GoodsReceiptLine {
  id: ID;
  receiptId: ID;
  purchaseOrderLineId: ID;
  productId: ID;
  orderedQty: number;
  receivedQty: number;
  damagedQty: number;
}

export interface Invoice {
  id: ID;
  number: string;
  supplierId: ID;
  purchaseOrderId: ID;
  centreId: ID;
  amount: Paise;
  dueAt: ISODate;
  status: "received" | "query" | "approved" | "paid";
  match: "matched" | "price_mismatch" | "quantity_mismatch" | "unmatched";
}

export interface Payment {
  id: ID;
  invoiceId: ID;
  amount: Paise;
  paidAt: ISODate;
  method: "neft" | "upi" | "cheque";
}

export interface Budget {
  centreId: ID;
  period: string;
  allocated: Paise;
  committed: Paise;
  spent: Paise;
}

export interface Notification {
  id: ID;
  userId: ID;
  title: string;
  body: string;
  href?: string;
  createdAt: ISODate;
  /** Read state for the user the notification was fetched for (derived from readBy). */
  read: boolean;
  /** Users who have read it — broadcasts ("*") are read per user, never globally. */
  readBy: ID[];
  severity: "info" | "warning" | "critical";
}

export interface AuditEvent {
  id: ID;
  actorId: ID;
  action: string;
  subject: string;
  centreId?: ID;
  occurredAt: ISODate;
}

export interface AIProcessingJob {
  id: ID;
  kind: "audio_request" | "video_request" | "invoice_ocr" | "insight";
  centreId?: ID;
  status: "queued" | "processing" | "needs_review" | "completed" | "failed";
  createdAt: ISODate;
}

export interface Integration {
  id: ID;
  name: string;
  /** "not_configured" is the honest default until Phase 2 wires the integration. */
  status: "not_configured" | "connected" | "degraded" | "down";
  lastCheckedAt?: ISODate;
}
