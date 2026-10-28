import { describe, expect, it } from "vitest";
import type { GoodsReceipt, MonthlyRequest, PurchaseOrder, SupplierQuotation } from "@/domain/types";
import { cycleTimes, pipelineStages } from "./pipeline";

const today = new Date(2026, 9, 28);
const iso = (m: number, d: number) => new Date(2026, m, d, 10).toISOString();
const po = (id: string, status: PurchaseOrder["status"], total: number, createdAt = iso(9, 1)): PurchaseOrder =>
  ({ id, number: id, supplierId: "s", centreId: "c", status, total, expectedAt: iso(9, 5), createdAt, raisedBy: "u", priceVariance: 0 });
const gr = (purchaseOrderId: string, receivedAt: string) => ({ id: `${purchaseOrderId}-${receivedAt}`, purchaseOrderId, receivedAt }) as GoodsReceipt;
const names = { centre: (x: string) => x, supplier: (x: string) => x, product: (x: string) => x, outstanding: () => 400 };

describe("pipeline stages", () => {
  it("counts and values each stage; part-received counts only what is still owed; received keeps 30 days", () => {
    const requests = [{ id: "r1", centreId: "c", status: "approved", total: 1000, submittedAt: iso(9, 2) }, { id: "r2", centreId: "c", status: "submitted", total: 99 }] as MonthlyRequest[];
    const quotes = [{ id: "q1", status: "requested", validUntil: iso(10, 1) }, { id: "q2", status: "accepted", validUntil: iso(10, 1) }] as SupplierQuotation[];
    const pos = [po("a", "draft", 100), po("b", "awaiting_authorisation", 200), po("c", "issued", 300), po("d", "partially_received", 900), po("e", "received", 500), po("f", "received", 700), po("g", "cancelled", 50)];
    const receipts = [gr("d", iso(9, 6)), gr("e", iso(9, 20)), gr("f", iso(7, 1))];
    const s = Object.fromEntries(pipelineStages({ requests, quotes, pos, receipts }, today, names).map((x) => [x.key, x]));
    expect(s.approved).toMatchObject({ count: 1, value: 1000 });
    expect(s.quotation).toMatchObject({ count: 1, value: null });
    expect(s.authorisation).toMatchObject({ count: 2, value: 300 });
    expect(s.issued).toMatchObject({ count: 1, value: 300 });
    expect(s.partial).toMatchObject({ count: 1, value: 400 });
    expect(s.received).toMatchObject({ count: 1, value: 500 });
  });
  it("lists the oldest first", () => {
    const pos = [po("new", "awaiting_authorisation", 1, iso(9, 20)), po("old", "awaiting_authorisation", 1, iso(9, 3))];
    expect(pipelineStages({ requests: [], quotes: [], pos, receipts: [] }, today, names)[2]!.items.map((i) => i.id)).toEqual(["old", "new"]);
  });
});

describe("cycle time", () => {
  it("averages raised → last receipt for received POs, by month closed", () => {
    const pos = [po("a", "received", 1, iso(9, 1)), po("b", "received", 1, iso(9, 2)), po("c", "partially_received", 1, iso(9, 1))];
    const receipts = [gr("a", iso(9, 3)), gr("a", iso(9, 5)), gr("b", iso(9, 4)), gr("c", iso(9, 9))];
    const out = cycleTimes(pos, receipts, today, 2);
    expect(out.map((o) => o.period)).toEqual(["2026-09", "2026-10"]);
    expect(out[1]).toMatchObject({ value: 3, orders: 2 }); // (4 + 2) / 2
    expect(out[0]).toMatchObject({ value: 0, orders: 0 });
  });
});

describe("price trend", () => {
  it("is the quantity-weighted average unit price per month", async () => {
    const { priceTrend } = await import("./history");
    const pos = new Map([["a", po("a", "received", 0, iso(9, 2))], ["b", po("b", "received", 0, iso(9, 9))]]);
    const lines = [{ id: "1", purchaseOrderId: "a", productId: "p", quantity: 1, unitPrice: 100 }, { id: "2", purchaseOrderId: "b", productId: "p", quantity: 3, unitPrice: 200 }];
    expect(priceTrend(lines, pos, "p", ["2026-09", "2026-10"])).toEqual([{ period: "2026-09", value: 0, qty: 0 }, { period: "2026-10", value: 175, qty: 4 }]);
  });
});
