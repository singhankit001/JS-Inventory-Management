import { expect, it } from "vitest";
import type { GoodsReceipt, PurchaseOrder } from "@/domain/types";
import { supplierTrend } from "./suppliers";

it("supplier trend: on-time by first delivery vs expected day, clean = receipts without damage", () => {
  const at = (d: number) => new Date(2026, 9, d, 11).toISOString();
  const po = (id: string, supplierId: string, expected: number) => ({ id, supplierId, expectedAt: at(expected) }) as PurchaseOrder;
  const gr = (purchaseOrderId: string, d: number, damagedQty = 0) => ({ purchaseOrderId, receivedAt: at(d), damagedQty }) as GoodsReceipt;
  const pos = [po("a", "s", 5), po("b", "s", 5), po("x", "other", 5)];
  const receipts = [gr("a", 5), gr("a", 9, 2), gr("b", 7), gr("x", 1)];
  const [prev, oct] = supplierTrend(pos, receipts, "s", new Date(2026, 9, 28), 2);
  expect(prev).toMatchObject({ a: 0, b: 0, n: 0 });
  expect(oct).toMatchObject({ a: 50, b: 67, n: 3 });
});
