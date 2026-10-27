import { beforeEach, describe, expect, it, vi } from "vitest";
import { lineError, maxReceivable, receiptOutcome } from "./receiving";
import { outstandingByLine } from "./shared";
import { requestDeadline } from "./centre";

vi.mock("server-only", () => ({}));

const line = (outstanding: number, receivedQty: number, damagedQty = 0) => ({ outstanding, receivedQty, damagedQty });

describe("receiptOutcome", () => {
  it("confirms an exact, undamaged delivery and closes the PO", () => {
    expect(receiptOutcome([line(50, 50), line(10, 10)])).toMatchObject({ status: "confirmed", poStatus: "received", short: 0, remaining: 0 });
  });
  it("flags a short line, keeping the PO partially received", () => {
    const o = receiptOutcome([line(50, 44), line(10, 10)]);
    expect(o).toMatchObject({ status: "discrepancy", poStatus: "partially_received", short: 6, remaining: 6 });
    expect(o.lines.map((l) => l.short)).toEqual([6, 0]);
  });
  it("flags damage even when the count matches, and keeps damaged units owed", () => {
    expect(receiptOutcome([line(50, 50, 2)])).toMatchObject({ status: "discrepancy", poStatus: "partially_received", damaged: 2, remaining: 2 });
  });
  it("flags over-delivery but closes the PO", () => {
    expect(receiptOutcome([line(50, 55)])).toMatchObject({ status: "discrepancy", poStatus: "received", over: 5 });
  });
  it("treats a line that did not arrive as short", () => {
    expect(receiptOutcome([line(5, 0), line(3, 3)])).toMatchObject({ status: "discrepancy", poStatus: "partially_received", short: 5, received: 3, ordered: 8 });
  });
});

describe("lineError", () => {
  it("allows up to 10% over (rounded up) and nothing on a complete line", () => {
    expect(maxReceivable(50)).toBe(55);
    expect(maxReceivable(3)).toBe(4);
    expect(maxReceivable(0)).toBe(0);
    expect(lineError(line(50, 55))).toBeUndefined();
    expect(lineError(line(50, 56))).toMatch(/At most 55/);
  });
  it("rejects fractions, negatives and damage above received", () => {
    expect(lineError(line(10, 2.5))).toBeDefined();
    expect(lineError(line(10, -1))).toBeDefined();
    expect(lineError(line(10, 3, 4))).toMatch(/Damaged/);
  });
});

describe("recordReceipt", () => {
  beforeEach(() => vi.resetModules()); // fresh in-memory seed per test

  async function setup() {
    const { recordReceipt, seedRepository } = await import("@/lib/data/provider");
    const repo = seedRepository("all");
    const [pos, lines, rLines, balances, budgets] = await Promise.all([repo.purchaseOrders(), repo.purchaseOrderLines(), repo.receiptLines(), repo.balances(), repo.budgets()]);
    const linesOf = (id: string) => lines.filter((l) => l.purchaseOrderId === id);
    const po = pos.find((p) => p.status === "issued" && linesOf(p.id).length >= 2 && linesOf(p.id).some((l) => l.quantity >= 3))!;
    const poLines = linesOf(po.id).sort((a, b) => b.quantity - a.quantity); // largest line first
    const owed = outstandingByLine(poLines, rLines);
    return { recordReceipt, repo, pos, lines, po, poLines, owed, balances, budgets };
  }

  it("refuses out-of-scope POs, foreign or missing lines and over-receipt without writing anything", async () => {
    const { recordReceipt, pos, lines, po, poLines, owed, repo } = await setup();
    const other = pos.find((p) => p.centreId !== po.centreId && p.status === "issued")!;
    const full = poLines.map((l) => ({ purchaseOrderLineId: l.id, receivedQty: owed.get(l.id)!, damagedQty: 0 }));
    const before = (await repo.receipts()).length;

    expect(recordReceipt([po.centreId], { purchaseOrderId: other.id, lines: full, actorId: "u-rcv" })).toMatchObject({ ok: false, error: expect.stringMatching(/not in your centres/) });
    const foreign = lines.find((l) => l.purchaseOrderId === other.id)!;
    expect(recordReceipt([po.centreId], { purchaseOrderId: po.id, lines: [...full, { purchaseOrderLineId: foreign.id, receivedQty: 1, damagedQty: 0 }], actorId: "u-rcv" }).ok).toBe(false);
    expect(recordReceipt([po.centreId], { purchaseOrderId: po.id, lines: full.slice(1), actorId: "u-rcv" })).toMatchObject({ ok: false, error: expect.stringMatching(/every outstanding line/) });
    const over = full.map((l, i) => (i === 0 ? { ...l, receivedQty: maxReceivable(l.receivedQty) + 1 } : l));
    expect(recordReceipt([po.centreId], { purchaseOrderId: po.id, lines: over, actorId: "u-rcv" })).toMatchObject({ ok: false, error: expect.stringMatching(/At most/) });
    expect(recordReceipt([po.centreId], { purchaseOrderId: po.id, lines: full.map((l) => ({ ...l, receivedQty: 0 })), actorId: "u-rcv" }).ok).toBe(false);
    expect((await repo.receipts()).length).toBe(before);
    expect(po.status).toBe("issued");
  });

  it("writes lines, stock and budget, part-receives, then closes the PO on the balance", async () => {
    const { recordReceipt, repo, po, poLines, owed, balances, budgets } = await setup();
    const [first, ...rest] = poLines;
    const onHand = (productId: string) => balances.find((b) => b.centreId === po.centreId && b.productId === productId)!.onHand;
    const before = new Map(poLines.map((l) => [l.productId, onHand(l.productId)]));
    const budget = budgets.find((b) => b.centreId === po.centreId && b.period === budgets.map((x) => x.period).sort().at(-1))!;
    const spentBefore = budget.spent;

    // First line arrives one short with one damaged; the rest arrive in full.
    const firstQty = owed.get(first!.id)!;
    const res = recordReceipt([po.centreId], {
      purchaseOrderId: po.id, actorId: "u-rcv",
      lines: [{ purchaseOrderLineId: first!.id, receivedQty: firstQty - 1, damagedQty: 1 }, ...rest.map((l) => ({ purchaseOrderLineId: l.id, receivedQty: owed.get(l.id)!, damagedQty: 0 }))],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.receipt.status).toBe("discrepancy");
    expect(res.receipt.receivedQty).toBe(res.lines.reduce((s, l) => s + l.receivedQty, 0));
    expect(po.status).toBe("partially_received");
    expect(onHand(first!.productId)).toBe(before.get(first!.productId)! + firstQty - 2);
    for (const l of rest) expect(onHand(l.productId)).toBe(before.get(l.productId)! + owed.get(l.id)!);
    expect(budget.spent).toBe(spentBefore + (firstQty - 2) * first!.unitPrice + rest.reduce((s, l) => s + owed.get(l.id)! * l.unitPrice, 0));
    const moves = (await repo.movements()).filter((m) => m.reference === res.receipt.id);
    expect(moves.reduce((s, m) => s + m.quantity, 0)).toBe(res.receipt.receivedQty - res.receipt.damagedQty);

    // Only the first line still owes 2; a completed line can no longer be counted.
    expect(recordReceipt([po.centreId], { purchaseOrderId: po.id, actorId: "u-rcv", lines: [{ purchaseOrderLineId: first!.id, receivedQty: 2, damagedQty: 0 }, { purchaseOrderLineId: rest[0]!.id, receivedQty: 0, damagedQty: 0 }] }).ok).toBe(false);
    const done = recordReceipt([po.centreId], { purchaseOrderId: po.id, actorId: "u-rcv", lines: [{ purchaseOrderLineId: first!.id, receivedQty: 2, damagedQty: 0 }] });
    expect(done).toMatchObject({ ok: true, receipt: { status: "confirmed", orderedQty: 2 } });
    expect(po.status).toBe("received");
    expect(recordReceipt([po.centreId], { purchaseOrderId: po.id, actorId: "u-rcv", lines: [{ purchaseOrderLineId: first!.id, receivedQty: 1, damagedQty: 0 }] }).ok).toBe(false);
  });
});

describe("requestDeadline", () => {
  it("counts down to the 25th, then rolls over once submitted", () => {
    expect(requestDeadline(new Date(2026, 9, 20), false)).toMatchObject({ days: 5, overdue: false });
    expect(requestDeadline(new Date(2026, 9, 27), false)).toMatchObject({ days: -2, overdue: true });
    expect(requestDeadline(new Date(2026, 9, 27), true)).toMatchObject({ days: 29, nextCycle: true });
  });
});
