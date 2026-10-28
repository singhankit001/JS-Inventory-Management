import "server-only";
import type {
  AIProcessingJob, Approval, AuditEvent, Budget, Centre, GoodsReceipt, ID, Integration, Invoice, MonthlyRequest,
  GoodsReceiptLine, Notification, Payment, Product, ProductCategory, PurchaseOrder, PurchaseOrderLine, RequestItem, StockBalance, StockCount,
  StockMovement, Supplier, SupplierQuotation, UnitOfMeasure, User,
} from "@/domain/types";
import { buildSeed, DEMO_LOGIN_IDS, period, type SeedData } from "./seed";
import { lineError, receiptOutcome } from "@/features/dashboards/receiving";
import { outstandingByLine } from "@/features/dashboards/shared";

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
  // Seeded centre leaders for the other centres exist for realism but are not offered as sign-in accounts.
  return getSeed().users.filter((u) => u.status === "active" && DEMO_LOGIN_IDS.includes(u.id));
}
export function allCentres(): Centre[] {
  return getSeed().centres;
}

// ---- Receiving writes (append-only section) ----

export interface ReceiptLineInput { purchaseOrderLineId: ID; receivedQty: number; damagedQty: number }
export interface ReceiptInput { purchaseOrderId: ID; lines: ReceiptLineInput[]; actorId: ID }

/**
 * Records an item-level goods receipt against an issued or part-received PO in the caller's scope. Every line that still
 * owes units must be counted (0 if it did not arrive); quantities are whole numbers, damaged ≤ received, and received may
 * exceed what is outstanding by the 10% over-delivery tolerance only. Writes the receipt and its lines, a receipt stock
 * movement and balance update per line with good units, moves the value from committed to spent on this month's budget,
 * sets the PO to received / partially_received from what is still owed, and writes an audit event. Nothing is written
 * unless every check passes.
 * shortcut: mutates the in-memory demo seed, which resets daily (and on server restart); Phase 2 writes to Postgres in one transaction.
 */
export function recordReceipt(scope: CentreScope, input: ReceiptInput):
  { ok: true; receipt: GoodsReceipt; lines: GoodsReceiptLine[]; po: PurchaseOrder } | { ok: false; error: string } {
  const s = getSeed();
  const po = s.purchaseOrders.find((p) => p.id === input.purchaseOrderId && (scope === "all" || scope.includes(p.centreId)));
  if (!po) return { ok: false, error: "That purchase order is not in your centres." };
  if (po.status !== "issued" && po.status !== "partially_received") return { ok: false, error: `${po.number} is not awaiting delivery.` };
  const poLines = s.purchaseOrderLines.filter((l) => l.purchaseOrderId === po.id);
  const owed = outstandingByLine(poLines, s.receiptLines);
  const name = (productId: ID) => s.products.find((p) => p.id === productId)?.name ?? productId;

  const counted = new Map(input.lines.map((l) => [l.purchaseOrderLineId, l]));
  if (counted.size !== input.lines.length) return { ok: false, error: "Each line can only be counted once." };
  for (const l of input.lines) {
    const line = poLines.find((x) => x.id === l.purchaseOrderLineId);
    if (!line) return { ok: false, error: `A counted line is not on ${po.number}.` };
    if (!owed.get(line.id)) return { ok: false, error: `${name(line.productId)} is already fully received.` };
  }
  const open = poLines.filter((l) => owed.get(l.id)! > 0);
  if (open.some((l) => !counted.has(l.id))) return { ok: false, error: "Count every outstanding line — enter 0 for items that did not arrive." };
  const counts = open.map((line) => ({ line, outstanding: owed.get(line.id)!, receivedQty: counted.get(line.id)!.receivedQty, damagedQty: counted.get(line.id)!.damagedQty }));
  for (const c of counts) {
    const err = lineError(c);
    if (err) return { ok: false, error: `${name(c.line.productId)}: ${err}` };
  }
  if (counts.every((c) => c.receivedQty === 0)) return { ok: false, error: "Nothing was received — enter the quantities that arrived." };

  const outcome = receiptOutcome(counts);
  const now = new Date().toISOString();
  const receipt: GoodsReceipt = {
    id: `gr-${s.receipts.length + 1}`, purchaseOrderId: po.id, centreId: po.centreId, receivedAt: now, receivedBy: input.actorId,
    status: outcome.status, orderedQty: outcome.ordered, receivedQty: outcome.received, damagedQty: outcome.damaged,
  };
  const lines: GoodsReceiptLine[] = counts.map((c, i) => ({
    id: `${receipt.id}-l${i + 1}`, receiptId: receipt.id, purchaseOrderLineId: c.line.id, productId: c.line.productId,
    orderedQty: c.outstanding, receivedQty: c.receivedQty, damagedQty: c.damagedQty,
  }));
  s.receipts.push(receipt);
  s.receiptLines.push(...lines);

  let spent = 0, released = 0;
  for (const c of counts) {
    const good = c.receivedQty - c.damagedQty;
    spent += good * c.line.unitPrice;
    released += Math.min(good, c.outstanding) * c.line.unitPrice;
    if (good <= 0) continue;
    s.movements.push({ id: `mv-${s.movements.length + 1}`, centreId: po.centreId, productId: c.line.productId, type: "receipt", quantity: good, occurredAt: now, reference: receipt.id });
    const balance = s.balances.find((b) => b.centreId === po.centreId && b.productId === c.line.productId);
    if (balance) { balance.onHand += good; balance.updatedAt = now; }
    else s.balances.push({ centreId: po.centreId, productId: c.line.productId, onHand: good, updatedAt: now });
  }
  const budget = s.budgets.find((b) => b.centreId === po.centreId && b.period === period(new Date()));
  if (budget) { budget.spent += spent; budget.committed = Math.max(0, budget.committed - released); }
  po.status = outcome.poStatus;

  const notes = [outcome.short && `${outcome.short} short`, outcome.over && `${outcome.over} over`, outcome.damaged && `${outcome.damaged} damaged`].filter(Boolean).join(", ");
  s.audit.unshift({ id: `ae-${receipt.id}`, actorId: input.actorId, action: "recorded receipt", subject: `GR for ${po.number}${notes ? ` · ${notes}` : ""}`, centreId: po.centreId, occurredAt: now });
  return { ok: true, receipt, lines, po };
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

/** The mutable in-memory demo store, for lib/demo/command.ts only. Reads go through the scoped Repository. */
export const demoStore = () => getSeed();
