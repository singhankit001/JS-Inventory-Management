import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

describe("request journey", async () => {
  const { seedRepository } = await import("@/lib/data/provider");
  const { loadJourney } = await import("./journey");
  const j = await loadJourney(seedRepository("all"));

  it("follows Kavya Nair at Baner through six stages in time order", () => {
    expect(j.centre.name).toBe("Baner");
    expect(j.stages.map((s) => s.key)).toEqual(["voice", "intake", "approval", "purchasing", "finance", "executive"]);
    expect(j.stages[0]!.owner.name).toBe("Kavya Nair");
    const times = j.stages.map((s) => s.at);
    expect([...times].sort()).toEqual(times);
  });

  it("keeps the money consistent from request to payment", () => {
    expect(j.totals.approved).toBeLessThan(j.totals.requested);
    expect(j.orders.reduce((s, o) => s + o.total, 0)).toBe(j.totals.approved);
    expect(j.totals.payable + j.totals.held).toBe(j.totals.invoiced);
    // Only the short-delivered line is held: billed minus received, at unit cost.
    const short = j.lines.filter((l) => l.received < l.invoiced);
    expect(j.totals.held).toBe(short.reduce((s, l) => s + (l.invoiced - l.received) * l.unitCost, 0));
    expect(j.orders.filter((o) => o.match.label === "Query raised")).toHaveLength(1);
  });
});
