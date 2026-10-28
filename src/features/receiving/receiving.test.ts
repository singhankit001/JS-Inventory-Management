import { describe, expect, it } from "vitest";
import type { GoodsReceipt, GoodsReceiptLine, PurchaseOrder } from "@/domain/types";
import { aggregate, discrepancies } from "./discrepancies";
import { bucketOf } from "./deliveries";
import { lineVerdict } from "./receipts";

const today = new Date(2026, 9, 28);
const at = (m: number, d: number) => new Date(2026, m, d, 11).toISOString();
const po = (id: string, supplierId: string, status: PurchaseOrder["status"] = "partially_received") => ({ id, supplierId, centreId: "c", status }) as PurchaseOrder;
const gr = (id: string, purchaseOrderId: string, receivedAt: string) => ({ id, purchaseOrderId, receivedAt }) as GoodsReceipt;
const line = (id: string, receiptId: string, pol: string, orderedQty: number, receivedQty: number, damagedQty = 0): GoodsReceiptLine =>
  ({ id, receiptId, purchaseOrderLineId: pol, productId: "p", orderedQty, receivedQty, damagedQty });

describe("discrepancy aggregation", () => {
  const pos = [po("a", "s1"), po("b", "s2", "received")];
  const receipts = [gr("r1", "a", at(9, 2)), gr("r2", "b", at(8, 5))];
  const lines = [
    line("l1", "r1", "a1", 10, 7), // 3 short, still owed → open
    line("l2", "r1", "a2", 5, 5, 2), // 2 damaged, made good later → resolved
    line("l3", "r2", "b1", 4, 5), // 1 over → resolved on receipt
    line("l4", "r2", "b2", 6, 6), // clean → not a discrepancy
  ];
  const owed = new Map([["a1", 3], ["a2", 0], ["b1", 0], ["b2", 0]]);
  const ds = discrepancies(lines, receipts, pos, owed);

  it("keeps only lines with an issue and decides open vs resolved", () => {
    expect(ds.map((d) => [d.line.id, d.short, d.over, d.damaged, d.open])).toEqual([["l1", 3, 0, 0, true], ["l2", 0, 0, 2, false], ["l3", 0, 1, 0, false]]);
  });
  it("totals by type, supplier and month", () => {
    const a = aggregate(ds, today, 2);
    expect(a).toMatchObject({ short: 3, over: 1, damaged: 2, open: 1, resolved: 2 });
    expect(a.bySupplier.get("s1")).toEqual({ short: 3, over: 0, damaged: 2, open: 1 });
    expect(a.trend.map((t) => t.value)).toEqual([1, 5]);
  });
  it("line verdicts read as the receiving clerk would say them", () => {
    expect(lineVerdict(lines[0]!)).toEqual({ label: "3 short", tone: "amber" });
    expect(lineVerdict(lines[3]!)).toEqual({ label: "Matches", tone: "green" });
  });
});

it("delivery agenda buckets", () => {
  const p = (status: PurchaseOrder["status"], d: number) => ({ status, expectedAt: at(9, d) });
  expect([p("issued", 27), p("issued", 28), p("issued", 4 + 31), p("issued", 30 + 10), p("partially_received", 1)].map((x) => bucketOf(x, today)))
    .toEqual(["overdue", "today", "week", "fortnight", "balance"]);
});
