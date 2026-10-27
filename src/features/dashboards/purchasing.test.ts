import { describe, expect, it } from "vitest";
import type { SupplierQuotation } from "@/domain/types";
import { bestPrices, daysLate } from "./purchasing";

const q = (id: string, productId: string, unitPrice: number, status: SupplierQuotation["status"] = "received"): SupplierQuotation =>
  ({ id, supplierId: `s-${id}`, productId, unitPrice, validUntil: "2026-11-30T10:00:00.000Z", status });

describe("bestPrices", () => {
  it("picks the lowest priced quote and measures saving against the highest", () => {
    const [p] = bestPrices([q("a", "p1", 120_00), q("b", "p1", 90_00, "accepted"), q("c", "p1", 100_00)]);
    expect(p!.best.id).toBe("b");
    expect(p!.others.map((o) => o.unitPrice)).toEqual([100_00, 120_00]);
    expect(p!.saving).toBe(30_00);
    expect(p!.savingRatio).toBeCloseTo(0.25);
  });

  it("ignores requested and declined quotes, and a single quote saves nothing", () => {
    const rows = bestPrices([q("a", "p1", 50_00, "requested"), q("b", "p1", 80_00), q("c", "p1", 40_00, "declined"), q("d", "p2", 10_00, "requested")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.best.id).toBe("b");
    expect(rows[0]!.quotes).toBe(1);
    expect(rows[0]!.saving).toBe(0);
  });
});

describe("daysLate", () => {
  const today = new Date(2026, 9, 27);
  it("counts whole calendar days past the expected date", () => {
    expect(daysLate(new Date(2026, 9, 24, 15, 30).toISOString(), today)).toBe(3);
    expect(daysLate(new Date(2026, 9, 26, 23, 59).toISOString(), today)).toBe(1);
  });
  it("is zero when due today or in the future", () => {
    expect(daysLate(new Date(2026, 9, 27, 18).toISOString(), today)).toBe(0);
    expect(daysLate(new Date(2026, 9, 30).toISOString(), today)).toBe(0);
  });
});
