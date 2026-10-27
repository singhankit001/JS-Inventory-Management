import "server-only";
import type {
  AIProcessingJob, Approval, AuditEvent, Budget, Centre, GoodsReceipt, ID, Integration, Invoice, MonthlyRequest,
  GoodsReceiptLine, Notification, Payment, Product, ProductCategory, PurchaseOrder, PurchaseOrderLine, RequestItem, StockBalance, StockCount,
  StockMovement, Supplier, SupplierQuotation, UnitOfMeasure, User,
} from "@/domain/types";
import { buildSeed, type SeedData } from "./seed";
import { orderedUnits, receiptOutcome } from "@/features/dashboards/receiving";

/** Which centres a caller may read. "all" only for organisation-scoped roles. */
export type CentreScope = "all" | readonly ID[];

/**
 * Data access contract used by every dashboard loader. Every centre-bound collection is already
 * filtered to the caller's scope, so UI code cannot accidentally read another centre's rows.
 * Phase 2 adds a Postgres implementation; db/policies.sql enforces the same isolation in the database.
 */
export interface Repository {
  mode: "seed" | "live";
  today(): Date;
  centres(): Promise<Centre[]>;
  users(): Promise<User[]>;
  categories(): Promise<ProductCategory[]>;
  uoms(): Promise<UnitOfMeasure[]>;
  products(): Promise<Product[]>;
  suppliers(): Promise<Supplier[]>;
  quotations(): Promise<SupplierQuotation[]>;
  balances(): Promise<StockBalance[]>;
  movements(): Promise<StockMovement[]>;
  counts(): Promise<StockCount[]>;
  requests(): Promise<MonthlyRequest[]>;
  requestItems(): Promise<RequestItem[]>;
  approvals(): Promise<Approval[]>;
  purchaseOrders(): Promise<PurchaseOrder[]>;
  purchaseOrderLines(): Promise<PurchaseOrderLine[]>;
  receipts(): Promise<GoodsReceipt[]>;
  receiptLines(): Promise<GoodsReceiptLine[]>;
  invoices(): Promise<Invoice[]>;
  payments(): Promise<Payment[]>;
  budgets(): Promise<Budget[]>;
  notifications(userId: ID): Promise<Notification[]>;
  audit(): Promise<AuditEvent[]>;
  aiJobs(): Promise<AIProcessingJob[]>;
  integrations(): Promise<Integration[]>;
}

let seed: SeedData | undefined;
let seedDay = "";
function getSeed() {
  const key = new Date().toDateString();
  // Rebuild once per day so "today" widgets stay anchored to the real date.
  if (!seed || seedDay !== key) {
    seed = buildSeed();
    seedDay = key;
  }
  return seed;
}

export function seedRepository(scope: CentreScope): Repository {
  const s = getSeed();
  const inScope = (centreId: ID | undefined) => scope === "all" || (centreId !== undefined && scope.includes(centreId));
  const by = <T extends { centreId?: ID }>(rows: T[]) => Promise.resolve(rows.filter((r) => inScope(r.centreId)));
  const all = <T,>(rows: T[]) => Promise.resolve(rows);

  const scopedRequestIds = () => new Set(s.requests.filter((r) => inScope(r.centreId)).map((r) => r.id));
  const scopedPoIds = () => new Set(s.purchaseOrders.filter((p) => inScope(p.centreId)).map((p) => p.id));

  return {
    mode: "seed",
    today: () => s.today,
    centres: () => Promise.resolve(s.centres.filter((c) => inScope(c.id))),
    users: () => Promise.resolve(scope === "all" ? s.users : s.users.filter((u) => u.centreIds.some((id) => scope.includes(id)))),
    categories: () => all(s.categories),
    uoms: () => all(s.uoms),
    products: () => all(s.products),
    suppliers: () => all(s.suppliers),
    quotations: () => all(s.quotations),
    balances: () => by(s.balances),
    movements: () => by(s.movements),
    counts: () => by(s.counts),
    requests: () => by(s.requests),
    requestItems: () => { const ids = scopedRequestIds(); return Promise.resolve(s.requestItems.filter((i) => ids.has(i.requestId))); },
    // Organisation-wide approvals (supplier prices) have no centre and are only visible to "all" scope.
    approvals: () => by(s.approvals),
    purchaseOrders: () => by(s.purchaseOrders),
    purchaseOrderLines: () => { const ids = scopedPoIds(); return Promise.resolve(s.purchaseOrderLines.filter((l) => ids.has(l.purchaseOrderId))); },
    receipts: () => by(s.receipts),
    receiptLines: () => { const ids = new Set(s.receipts.filter((r) => inScope(r.centreId)).map((r) => r.id)); return Promise.resolve(s.receiptLines.filter((l) => ids.has(l.receiptId))); },
    invoices: () => by(s.invoices),
    payments: () => { const ids = scopedPoIds(); const inv = new Set(s.invoices.filter((i) => ids.has(i.purchaseOrderId)).map((i) => i.id)); return Promise.resolve(s.payments.filter((p) => inv.has(p.invoiceId))); },
    budgets: () => by(s.budgets),
    notifications: (userId) => Promise.resolve(s.notifications.filter((n) => n.userId === "*" || n.userId === userId).map((n) => ({ ...n, read: n.readBy.includes(userId) }))),
    audit: () => Promise.resolve(s.audit.filter((a) => scope === "all" || inScope(a.centreId))),
    aiJobs: () => by(s.aiJobs),
    integrations: () => all(s.integrations),
  };
}

export function getRepository(scope: CentreScope): Repository {
  // shortcut: only the seed provider exists; Phase 2 switches on process.env.DATA_PROVIDER.
  return seedRepository(scope);
}

/** Unscoped user lookup for authentication only. */
export function findUser(id: ID): User | undefined {
  return getSeed().users.find((u) => u.id === id);
}
export function listDemoUsers(): User[] {
  return getSeed().users.filter((u) => u.status === "active");
}
export function allCentres(): Centre[] {
  return getSeed().centres;
}

// ---- Receiving writes (append-only section) ----

export interface ReceiptInput { purchaseOrderId: ID; receivedQty: number; damagedQty: number; actorId: ID }

/**
 * Records a goods receipt against an issued PO in the caller's scope, updates the PO status and writes an audit event.
 * shortcut: mutates the in-memory demo seed, which resets daily (and on server restart); Phase 2 writes to Postgres in one transaction.
 */
export function recordReceipt(scope: CentreScope, input: ReceiptInput): { ok: true; receipt: GoodsReceipt; po: PurchaseOrder } | { ok: false; error: string } {
  const s = getSeed();
  const po = s.purchaseOrders.find((p) => p.id === input.purchaseOrderId && (scope === "all" || scope.includes(p.centreId)));
  if (!po) return { ok: false, error: "That purchase order is not in your centres." };
  if (po.status !== "issued") return { ok: false, error: `${po.number} is not awaiting delivery.` };
  const ordered = orderedUnits(po);
  const outcome = receiptOutcome(ordered, input.receivedQty, input.damagedQty);
  const now = new Date().toISOString();
  const receipt: GoodsReceipt = {
    id: `gr-${s.receipts.length + 1}`, purchaseOrderId: po.id, centreId: po.centreId, receivedAt: now, receivedBy: input.actorId,
    status: outcome.status, orderedQty: ordered, receivedQty: input.receivedQty, damagedQty: input.damagedQty,
  };
  s.receipts.push(receipt);
  po.status = outcome.poStatus;
  const notes = [outcome.short && `${outcome.short} short`, outcome.over && `${outcome.over} over`, input.damagedQty && `${input.damagedQty} damaged`].filter(Boolean).join(", ");
  s.audit.unshift({ id: `ae-${receipt.id}`, actorId: input.actorId, action: "recorded receipt", subject: `GR for ${po.number}${notes ? ` · ${notes}` : ""}`, centreId: po.centreId, occurredAt: now });
  return { ok: true, receipt, po };
}

/**
 * Marks notifications read for one user (all of theirs when ids is omitted). Returns how many changed.
 * shortcut: in-memory demo store, resets daily; Phase 2 writes notification_reads rows.
 */
export function markNotificationsRead(userId: ID, ids?: ID[]): number {
  let changed = 0;
  for (const n of getSeed().notifications) {
    if ((n.userId !== "*" && n.userId !== userId) || (ids && !ids.includes(n.id)) || n.readBy.includes(userId)) continue;
    n.readBy.push(userId);
    changed++;
  }
  return changed;
}
