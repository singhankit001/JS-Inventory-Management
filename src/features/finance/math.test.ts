import { describe, expect, it } from "vitest";
import type { Invoice, Payment } from "@/domain/types";
import { daysPastDue, isOverdue, reconciliationExceptions, threeWayMatch } from "./math";

const today = new Date(2026, 9, 27);
const at = (offset: number) => new Date(2026, 9, 27 + offset, 23).toISOString();
const inv = (id: string, x: Partial<Invoice>): Invoice => ({ id, number: id, supplierId: "s", purchaseOrderId: "po", centreId: "c", amount: 1000, dueAt: at(5), status: "received", match: "matched", ...x });

describe("finance math", () => {
  it("counts days past due on calendar dates", () => {
    expect(daysPastDue(at(0), today)).toBe(0);
    expect(daysPastDue(at(-3), today)).toBe(3);
    expect(daysPastDue(at(4), today)).toBe(-4);
    expect(isOverdue(inv("a", { dueAt: at(-1) }), today)).toBe(true);
    expect(isOverdue(inv("a", { dueAt: at(-1), status: "paid" }), today)).toBe(false);
  });

  it("matches PO lines against good units received at PO price", () => {
    const lines = [{ id: "l1", purchaseOrderId: "po", productId: "p1", quantity: 10, unitPrice: 100 }, { id: "l2", purchaseOrderId: "po", productId: "p2", quantity: 5, unitPrice: 50 }];
    const rl = [{ id: "r1", receiptId: "gr", purchaseOrderLineId: "l1", productId: "p1", orderedQty: 10, receivedQty: 10, damagedQty: 2 }];
    const m = threeWayMatch(lines, rl, 1250);
    expect(m.poTotal).toBe(1250);
    expect(m.billable).toBe(800);
    expect(m.variance).toBe(450);
    expect(m.rows.map((r) => r.flag)).toEqual(["damaged", "not_received"]);
  });

  it("flags payments that do not tie out and unmatched open invoices", () => {
    const pay = (invoiceId: string, amount: number): Payment => ({ id: `p-${invoiceId}`, invoiceId, amount, paidAt: at(-1), method: "neft" });
    const ex = reconciliationExceptions(
      [inv("ok", { status: "paid" }), inv("short", { status: "paid" }), inv("none", { status: "paid" }), inv("open", { match: "unmatched" }), inv("open2", {})],
      [pay("ok", 1000), pay("short", 900)],
    );
    expect(ex).toEqual([{ invoiceId: "short", kind: "short_paid", delta: -100 }, { invoiceId: "none", kind: "paid_without_payment", delta: 1000 }, { invoiceId: "open", kind: "unmatched", delta: 0 }]);
  });
});
