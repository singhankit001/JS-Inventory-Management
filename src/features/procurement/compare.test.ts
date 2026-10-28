import { expect, it } from "vitest";
import type { SupplierQuotation } from "@/domain/types";
import { bestValue, liveQuote } from "./compare";

const today = new Date(2026, 9, 28);
const q = (supplierId: string, status: SupplierQuotation["status"], unitPrice: number, validDays = 10): SupplierQuotation =>
  ({ id: `${supplierId}-${status}`, supplierId, productId: "p", unitPrice, status, validUntil: new Date(2026, 9, 28 + validDays).toISOString() });

it("only accepted/received, unexpired quotes carry a usable price", () => {
  expect(liveQuote([q("a", "received", 90), q("a", "accepted", 95)], "a", "p", today).price).toBe(95);
  expect(liveQuote([q("a", "received", 90, -1)], "a", "p", today)).toMatchObject({ price: undefined, expired: true });
  expect(liveQuote([q("a", "requested", 0)], "a", "p", today).price).toBeUndefined();
});

it("saving is current minus best, per unit and on volume", () => {
  const r = bestValue([{ supplierId: "a", price: 100, current: true }, { supplierId: "b", price: 80, current: false }, { supplierId: "c", current: false }], 50);
  expect(r).toMatchObject({ best: "b", perUnit: 20, ratio: 0.2, annual: 1000 });
  expect(bestValue([{ supplierId: "a", price: 70, current: true }, { supplierId: "b", price: 80, current: false }], 50)).toMatchObject({ best: "a", perUnit: 0 });
});
