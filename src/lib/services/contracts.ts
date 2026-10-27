/**
 * Service-layer contracts for Phase 2 writes. Types only, plus an in-memory UnitOfWork for tests.
 *
 * Every command handler follows the same pipeline, with all reads and writes inside ONE `uow.run` so a failure
 * anywhere leaves no partial state:
 *   1. authorize  — `authorize(actor, permission)` from lib/auth/policy, before touching data.
 *   2. validate   — `COMMANDS[name].safeParse(input)` from domain/commands → "validation".
 *   3. load       — through the tx ports, after `idempotency.claim` → "conflict" on a replay, "not_found" if absent
 *                   (out-of-scope records also read as "not_found" so ids cannot be probed).
 *   4. transition — `transition(MACHINE, record.status, command, record)` from domain/workflows → "invalid_transition",
 *                   then `authorize(actor, t.permission, { centreId, makerId, command, status })` → "forbidden".
 *   5. write + audit — `update(id, from, patch)` compare-and-set ("conflict" when it returns false) and `audit.append`.
 *
 * Phase 1 stand-ins: the seed provider's `recordReceipt` and `markNotificationsRead` (lib/data/provider) mutate the
 * in-memory demo seed directly; Phase 2 replaces them with handlers built on these ports and a Postgres UnitOfWork.
 */
import type {
  AIProcessingJob, Approval, AuditEvent, GoodsReceipt, GoodsReceiptLine, ID, Invoice, ISODate, MonthlyRequest, Payment,
  PurchaseOrder, PurchaseOrderLine, RequestItem, SupplierQuotation,
} from "@/domain/types";
import type { Actor } from "@/lib/auth/policy";

/** Write port for one status-bearing aggregate. Reads here lock the row (SELECT … FOR UPDATE in Postgres). */
export interface StatusPort<T extends { id: ID; status: string }> {
  get(id: ID): Promise<T | undefined>;
  insert(row: T): Promise<void>;
  /** Compare-and-set on status. false = another writer moved it first → "conflict". */
  update(id: ID, expected: T["status"], patch: Partial<Omit<T, "id">>): Promise<boolean>;
}

export interface RequestWrites extends StatusPort<MonthlyRequest> {
  items(requestId: ID): Promise<RequestItem[]>;
  replaceItems(requestId: ID, items: RequestItem[]): Promise<void>;
}
export type ApprovalWrites = StatusPort<Approval>;
export interface ProcurementWrites {
  quotations: StatusPort<SupplierQuotation>;
  orders: StatusPort<PurchaseOrder>;
  lines(purchaseOrderId: ID): Promise<PurchaseOrderLine[]>;
  insertLines(lines: PurchaseOrderLine[]): Promise<void>;
}
export interface ReceivingWrites extends StatusPort<GoodsReceipt> {
  /** All lines already received against a PO, to compute what is still outstanding. */
  linesForOrder(purchaseOrderId: ID): Promise<GoodsReceiptLine[]>;
  insertLines(lines: GoodsReceiptLine[]): Promise<void>;
}
export interface InvoiceWrites extends StatusPort<Invoice> {
  insertPayment(payment: Payment): Promise<void>;
}
export type AIJobWrites = StatusPort<AIProcessingJob>;
export interface AuditWrites {
  append(event: AuditEvent): Promise<void>;
}
export interface IdempotencyWrites {
  /** false = key already used, so the command is a replay → "conflict". Rolled back with the transaction. */
  claim(key: string): Promise<boolean>;
}

export interface Tx {
  requests: RequestWrites;
  approvals: ApprovalWrites;
  procurement: ProcurementWrites;
  receiving: ReceivingWrites;
  invoices: InvoiceWrites;
  aiJobs: AIJobWrites;
  audit: AuditWrites;
  idempotency: IdempotencyWrites;
}

/** Handlers may narrow X to the ports they use (e.g. `Pick<Tx, "procurement" | "audit">`). */
export interface UnitOfWork<X = Tx> {
  run<T>(fn: (tx: X) => Promise<T>): Promise<T>;
}

export interface CommandContext<X = Tx> {
  actor: Actor;
  /** Injected so handlers stay deterministic in tests. */
  now: ISODate;
  uow: UnitOfWork<X>;
  /** One per user submission (form render), so double-clicks and retries cannot apply twice. */
  idempotencyKey: string;
}

export type CommandErrorCode = "forbidden" | "not_found" | "invalid_transition" | "validation" | "conflict";

export type CommandResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: CommandErrorCode; message: string; /** Field path → message, for "validation". */ fields?: Record<string, string> };

/**
 * Serialised, all-or-nothing UnitOfWork over plain in-memory state: `bind` builds ports over a draft copy that is
 * committed only if `fn` resolves. shortcut: test double only; production uses the Postgres UnitOfWork.
 */
export function memoryUnitOfWork<S, X>(initial: S, bind: (draft: S) => X): UnitOfWork<X> & { state(): S } {
  let state = initial;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    state: () => state,
    run(fn) {
      const next = queue.then(async () => {
        const draft = structuredClone(state);
        const result = await fn(bind(draft));
        state = draft;
        return result;
      });
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
