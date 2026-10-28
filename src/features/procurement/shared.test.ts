import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/policy";
import { poActions, poSteps, poTotals, referencePrice } from "./shared";

const ceo: Actor = { userId: "u-ceo", role: "ceo", scope: "all" };
const buyer: Actor = { userId: "u-po", role: "purchasing", scope: "all" };
const awaiting = { status: "awaiting_authorisation" as const, centreId: "c-and", raisedBy: "u-po" };

describe("raisePO totals", () => {
  it("total is Σ quantity × unit price and variance is against the contract price", () => {
    const r = poTotals([{ quantity: 3, unitPrice: 120_00, refPrice: 100_00 }, { quantity: 10, unitPrice: 5_50, refPrice: 6_00 }]);
    expect(r.total).toBe(3 * 120_00 + 10 * 5_50);
    expect(r.variance).toBe(3 * 20_00 - 10 * 50);
  });
  it("prefills from the accepted quote, then a received one, then list price", () => {
    const q = (status: "accepted" | "received" | "declined", unitPrice: number) => ({ id: status, supplierId: "s", productId: "p", unitPrice, validUntil: "", status });
    expect(referencePrice([q("received", 90), q("accepted", 95)], "s", "p", 100)).toBe(95);
    expect(referencePrice([q("received", 90), q("declined", 80)], "s", "p", 100)).toBe(90);
    expect(referencePrice([q("declined", 80)], "s", "p", 100)).toBe(100);
  });
});

describe("authorise separation of duties", () => {
  it("an authoriser who did not raise the PO may authorise or return it", () => {
    expect(poActions(ceo, awaiting)).toEqual([
      { command: "authorise", label: "Authorise & issue", blocked: undefined },
      { command: "returnToDraft", label: "Return to draft", blocked: undefined },
    ]);
  });
  it("the raiser sees the actions blocked with the policy reason", () => {
    const own = poActions({ ...ceo, userId: "u-po" }, awaiting);
    expect(own.map((a) => a.blocked)).toEqual(["The person who raised a purchase order cannot authorise it.", "The person who raised a purchase order cannot authorise it."]);
  });
  it("roles without procurement.authorise see nothing on an awaiting PO, but can resubmit a draft", () => {
    expect(poActions(buyer, awaiting)).toEqual([]);
    expect(poActions(buyer, { ...awaiting, status: "draft" }).map((a) => a.command)).toEqual(["submit"]);
    expect(poActions(ceo, { ...awaiting, status: "issued" })).toEqual([]);
  });
});

describe("PO stepper", () => {
  it("marks progress from the status and delivered units", () => {
    const at = { createdAt: "2026-10-01T10:00:00Z", expectedAt: "2026-10-05T10:00:00Z" };
    expect(poSteps({ ...at, status: "awaiting_authorisation" }, { ordered: 10, outstanding: 10 }).map((s) => s.state)).toEqual(["done", "current", "upcoming", "upcoming"]);
    const part = poSteps({ ...at, status: "partially_received" }, { ordered: 10, outstanding: 4 });
    expect(part.map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
    expect(part[3]!.detail).toBe("6 of 10 units");
    expect(poSteps({ ...at, status: "cancelled" }, { ordered: 10, outstanding: 10 })[1]!.state).toBe("blocked");
  });
});
