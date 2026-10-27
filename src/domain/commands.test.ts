import { describe, expect, it } from "vitest";
import { MODULES } from "@/lib/modules";
import { COMMANDS } from "./commands";

describe("COMMANDS", () => {
  it("has a schema for every planned write in the module contracts", () => {
    const writes = new Set(MODULES.flatMap((g) => g.pages.flatMap((p) => p.writes ?? [])));
    expect(Object.keys(COMMANDS).sort()).toEqual([...writes].sort());
  });

  it("validates goods receipts line by line", () => {
    const ok = { purchaseOrderId: "po-1", lines: [{ purchaseOrderLineId: "pol-1", receivedQty: 10, damagedQty: 1 }] };
    expect(COMMANDS.recordGoodsReceipt.safeParse(ok).success).toBe(true);
    const bad = (line: object) => COMMANDS.recordGoodsReceipt.safeParse({ ...ok, lines: [{ ...ok.lines[0], ...line }] }).success;
    expect(bad({ receivedQty: -1 })).toBe(false);
    expect(bad({ receivedQty: 2.5 })).toBe(false);
    expect(bad({ damagedQty: 11 })).toBe(false);
    expect(COMMANDS.recordGoodsReceipt.safeParse({ ...ok, lines: [] }).success).toBe(false);
    expect(COMMANDS.recordGoodsReceipt.safeParse({ ...ok, lines: [ok.lines[0], ok.lines[0]] }).success).toBe(false);
  });

  it("takes money only as whole, non-negative paise", () => {
    const po = { supplierId: "s-1", centreId: "c-1", expectedAt: "2026-11-02", lines: [{ productId: "p-1", quantity: 4, unitPrice: 12_500 }] };
    expect(COMMANDS.raisePO.safeParse(po).success).toBe(true);
    expect(COMMANDS.raisePO.safeParse({ ...po, lines: [{ ...po.lines[0], unitPrice: 125.5 }] }).success).toBe(false);
    expect(COMMANDS.raisePO.safeParse({ ...po, lines: [{ ...po.lines[0], quantity: 0 }] }).success).toBe(false);
    expect(COMMANDS.raisePO.safeParse({ ...po, expectedAt: "next week" }).success).toBe(false);
    expect(COMMANDS.setBudget.safeParse({ centreId: "c-1", period: "2026-11", allocated: -1 }).success).toBe(false);
    expect(COMMANDS.recordPayment.safeParse({ invoiceId: "i-1", amount: 0, paidAt: "2026-10-27T10:00:00+05:30", method: "upi" }).success).toBe(false);
  });

  it("requires a reason for anything but approval, and a centre for centre roles", () => {
    expect(COMMANDS.decideApproval.safeParse({ approvalId: "a-1", decision: "approved" }).success).toBe(true);
    expect(COMMANDS.decideApproval.safeParse({ approvalId: "a-1", decision: "rejected", comment: "  " }).success).toBe(false);
    expect(COMMANDS.inviteUser.safeParse({ name: "Asha", email: "asha@example.com", roles: ["finance"], centreIds: [] }).success).toBe(true);
    expect(COMMANDS.assignRoles.safeParse({ userId: "u-1", roles: ["centre_leader"], centreIds: [] }).success).toBe(false);
    expect(COMMANDS.submitRequest.safeParse({ requestId: " " }).success).toBe(false);
  });
});
