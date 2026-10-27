import { describe, expect, it } from "vitest";
import type { AuditEvent, PurchaseOrder } from "@/domain/types";
import { COMMANDS, type CommandInput } from "@/domain/commands";
import { PURCHASE_ORDER, transition } from "@/domain/workflows";
import { authorize } from "@/lib/auth/policy";
import { memoryUnitOfWork, type CommandContext, type CommandResult, type StatusPort, type Tx } from "./contracts";

type State = { orders: PurchaseOrder[]; makers: Record<string, string>; audit: AuditEvent[]; keys: string[] };
type AuthoriseTx = Pick<Tx, "audit" | "idempotency"> & { orders: StatusPort<PurchaseOrder>; makerOf(id: string): string | undefined };

const bind = (s: State): AuthoriseTx => ({
  orders: {
    get: async (id) => s.orders.find((o) => o.id === id),
    insert: async (row) => void s.orders.push(row),
    update: async (id, expected, patch) => {
      const o = s.orders.find((r) => r.id === id && r.status === expected);
      return !!o && !!Object.assign(o, patch);
    },
  },
  // Stand-in for PurchaseOrder.raisedBy, which types.ts does not have yet.
  makerOf: (id) => s.makers[id],
  audit: { append: async (e) => void s.audit.push(e) },
  idempotency: { claim: async (k) => !s.keys.includes(k) && !!s.keys.push(k) },
});

/** Reference handler for the pipeline documented in contracts.ts (test-only; Phase 2 writes the real ones). */
async function authorisePO(ctx: CommandContext<AuthoriseTx>, input: CommandInput<"authorisePO">): Promise<CommandResult<PurchaseOrder["status"]>> {
  const gate = authorize(ctx.actor, "procurement.authorise");
  if (!gate.allowed) return { ok: false, code: "forbidden", message: gate.reason };
  const parsed = COMMANDS.authorisePO.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation", message: "Check the form", fields: { purchaseOrderId: parsed.error.issues[0]!.message } };
  return ctx.uow.run(async (tx) => {
    if (!(await tx.idempotency.claim(ctx.idempotencyKey))) return { ok: false, code: "conflict", message: "Already submitted" };
    const po = await tx.orders.get(parsed.data.purchaseOrderId);
    const t = po && transition(PURCHASE_ORDER, po.status, "authorise");
    if (!po || !t) return { ok: false, code: "not_found", message: "No such purchase order" };
    const decision = authorize(ctx.actor, t.ok ? t.permission : "procurement.authorise", { centreId: po.centreId, makerId: tx.makerOf(po.id) });
    if (!decision.allowed) return { ok: false, code: decision.code === "out_of_scope" ? "not_found" : "forbidden", message: decision.reason };
    if (!t.ok) return { ok: false, code: "invalid_transition", message: t.reason };
    if (!(await tx.orders.update(po.id, po.status, { status: t.to }))) return { ok: false, code: "conflict", message: "Changed by someone else" };
    await tx.audit.append({ id: `ae-${ctx.idempotencyKey}`, actorId: ctx.actor.userId, action: "authorised PO", subject: po.number, centreId: po.centreId, occurredAt: ctx.now });
    return { ok: true, value: t.to };
  });
}

const po: PurchaseOrder = {
  id: "po-1", number: "PO-1", supplierId: "s-1", centreId: "c-1", status: "awaiting_authorisation", total: 100, expectedAt: "2026-11-01",
  createdAt: "2026-10-20", raisedBy: "u-po", priceVariance: 0,
};
const setup = () => memoryUnitOfWork<State, AuthoriseTx>({ orders: [{ ...po }], makers: { "po-1": "u-pur" }, audit: [], keys: [] }, bind);
const ctx = (uow: ReturnType<typeof setup>, userId = "u-ceo", key = "k-1"): CommandContext<AuthoriseTx> =>
  ({ actor: { userId, role: "ceo", scope: "all" }, now: "2026-10-27T10:00:00Z", uow, idempotencyKey: key });

describe("memoryUnitOfWork", () => {
  it("commits only when the whole unit succeeds", async () => {
    const uow = setup();
    await expect(uow.run(async (tx) => { await tx.audit.append({} as AuditEvent); throw new Error("boom"); })).rejects.toThrow("boom");
    expect(uow.state().audit).toHaveLength(0);
    await uow.run((tx) => tx.audit.append({} as AuditEvent));
    expect(uow.state().audit).toHaveLength(1);
  });
});

describe("command pipeline (authorisePO reference)", () => {
  it("authorises, writes and audits once; a replay is a conflict", async () => {
    const uow = setup();
    expect(await authorisePO(ctx(uow), { purchaseOrderId: "po-1" })).toEqual({ ok: true, value: "issued" });
    expect(uow.state().audit).toHaveLength(1);
    expect(await authorisePO(ctx(uow), { purchaseOrderId: "po-1" })).toMatchObject({ ok: false, code: "conflict" });
  });

  it("maps policy, validation and workflow failures to typed errors without writing", async () => {
    const uow = setup();
    expect(await authorisePO(ctx(uow, "u-pur"), { purchaseOrderId: "po-1" })).toMatchObject({ code: "forbidden" });
    expect(await authorisePO(ctx(uow, "u-ceo", "k-2"), { purchaseOrderId: "" })).toMatchObject({ code: "validation" });
    expect(await authorisePO(ctx(uow, "u-ceo", "k-3"), { purchaseOrderId: "po-x" })).toMatchObject({ code: "not_found" });
    expect(uow.state().orders[0]!.status).toBe("awaiting_authorisation");
    await authorisePO(ctx(uow, "u-ceo", "k-4"), { purchaseOrderId: "po-1" });
    expect(await authorisePO(ctx(uow, "u-ceo", "k-5"), { purchaseOrderId: "po-1" })).toMatchObject({ code: "invalid_transition" });
  });
});
