import { describe, expect, it, vi } from "vitest";
import { receiptOutcome } from "./receiving";
import { requestDeadline } from "./centre";

vi.mock("server-only", () => ({}));

describe("receiptOutcome", () => {
  it("confirms an exact, undamaged delivery and closes the PO", () => {
    expect(receiptOutcome(50, 50, 0)).toMatchObject({ status: "confirmed", poStatus: "received" });
  });
  it("flags shortage, keeping the PO partially received", () => {
    expect(receiptOutcome(50, 44, 0)).toMatchObject({ status: "discrepancy", poStatus: "partially_received", short: 6 });
  });
  it("flags damage even when the count matches", () => {
    expect(receiptOutcome(50, 50, 2)).toMatchObject({ status: "discrepancy", poStatus: "partially_received" });
  });
  it("flags over-delivery but closes the PO", () => {
    expect(receiptOutcome(50, 55, 0)).toMatchObject({ status: "discrepancy", poStatus: "received", over: 5 });
  });
});

describe("recordReceipt", () => {
  it("records against an in-scope issued PO and refuses out-of-scope ones", async () => {
    const { recordReceipt, seedRepository } = await import("@/lib/data/provider");
    const pos = await seedRepository("all").purchaseOrders();
    const po = pos.find((p) => p.status === "issued")!;
    const other = pos.find((p) => p.centreId !== po.centreId)!;
    expect(recordReceipt([po.centreId], { purchaseOrderId: other.id, receivedQty: 1, damagedQty: 0, actorId: "u-rcv" }).ok).toBe(false);
    const res = recordReceipt([po.centreId], { purchaseOrderId: po.id, receivedQty: 1, damagedQty: 0, actorId: "u-rcv" });
    expect(res.ok && res.receipt.status).toBe("discrepancy");
    expect(po.status).toBe("partially_received");
    expect(recordReceipt([po.centreId], { purchaseOrderId: po.id, receivedQty: 1, damagedQty: 0, actorId: "u-rcv" }).ok).toBe(false);
  });
});

describe("requestDeadline", () => {
  it("counts down to the 25th, then rolls over once submitted", () => {
    expect(requestDeadline(new Date(2026, 9, 20), false)).toMatchObject({ days: 5, overdue: false });
    expect(requestDeadline(new Date(2026, 9, 27), false)).toMatchObject({ days: -2, overdue: true });
    expect(requestDeadline(new Date(2026, 9, 27), true)).toMatchObject({ days: 29, nextCycle: true });
  });
});
