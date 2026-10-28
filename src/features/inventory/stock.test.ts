import { describe, expect, it } from "vitest";
import type { StockMovement } from "@/domain/types";
import { consumedSince, countVariances, daysOfCover, signedQty, stockKey, suggestedReorder } from "./stock";

const mv = (id: string, type: StockMovement["type"], quantity: number, occurredAt: string, reference?: string): StockMovement =>
  ({ id, centreId: "c1", productId: "p1", type, quantity, occurredAt, reference });

describe("stock math", () => {
  it("days of cover uses the average daily use of the window", () => {
    expect(daysOfCover(30, 90)).toBe(30); // 1 a day
    expect(daysOfCover(10, 45)).toBe(20); // 0.5 a day
    expect(daysOfCover(7, 20)).toBe(31); // floors 31.5
    expect(daysOfCover(5, 0)).toBeNull();
  });

  it("suggests enough to reach twice the reorder point, never negative", () => {
    expect(suggestedReorder(4, 10)).toBe(16);
    expect(suggestedReorder(0, 3)).toBe(6);
    expect(suggestedReorder(25, 10)).toBe(0);
  });

  it("signs consumption and transfers out as stock leaving", () => {
    expect(signedQty({ type: "consumption", quantity: 3 })).toBe(-3);
    expect(signedQty({ type: "transfer_out", quantity: 2 })).toBe(-2);
    expect(signedQty({ type: "adjustment", quantity: -2 })).toBe(-2);
    expect(signedQty({ type: "receipt", quantity: 5 })).toBe(5);
  });

  it("counts consumption inside the window only", () => {
    const today = new Date("2026-10-28T00:00:00Z");
    const used = consumedSince([mv("a", "consumption", 4, "2026-10-01T10:00:00Z"), mv("b", "consumption", 9, "2026-06-01T10:00:00Z"), mv("c", "receipt", 50, "2026-10-02T10:00:00Z")], today, 90);
    expect(used.get(stockKey("c1", "p1"))).toBe(4);
  });

  it("rebuilds system vs counted for each count adjustment from today's balance", () => {
    const moves = [
      mv("1", "receipt", 20, "2026-09-10T10:00:00Z"),
      mv("2", "adjustment", -2, "2026-09-30T18:00:00Z", "count-AND-2026-09"),
      mv("3", "consumption", 5, "2026-10-05T17:00:00Z"),
      mv("4", "adjustment", 3, "2026-10-01T08:00:00Z", "opening-balance"),
    ];
    // Today: 20 - 2 - 5 + 3 = 16. After the count only consumption (−5) and the opening adjustment (+3) happened → counted 18.
    const [v] = countVariances(moves, new Map([[stockKey("c1", "p1"), 16]]));
    expect(v).toMatchObject({ counted: 18, system: 20, variance: -2 });
    expect(countVariances(moves, new Map())).toHaveLength(1); // opening-balance is not a count
  });
});
