import { describe, expect, it } from "vitest";
import type { Session } from "./session";
import { actorFromSession, authorize, type Actor } from "./policy";

const actor = (role: Actor["role"], scope: Actor["scope"], userId = "u-1"): Actor => ({ userId, role, scope });

describe("authorize", () => {
  it("derives the actor from the signed session only", () => {
    const session = { user: { id: "u-9" }, role: "receiving", scope: ["c-1"], centres: [] } as unknown as Session;
    expect(actorFromSession(session)).toEqual({ userId: "u-9", role: "receiving", scope: ["c-1"] });
  });

  it("denies permissions the role does not have", () => {
    expect(authorize(actor("admin", "all"), "finance.read")).toMatchObject({ allowed: false, code: "missing_permission" });
    expect(authorize(actor("centre_leader", ["c-1"]), "procurement.authorise")).toMatchObject({ allowed: false, code: "missing_permission" });
    expect(authorize(actor("receiving", ["c-1"]), "receiving.record")).toEqual({ allowed: true });
  });

  it("keeps centre roles inside their centres", () => {
    const leader = actor("centre_leader", ["c-1"]);
    expect(authorize(leader, "requests.create", { centreId: "c-1" })).toEqual({ allowed: true });
    expect(authorize(leader, "requests.create", { centreId: "c-2" })).toMatchObject({ allowed: false, code: "out_of_scope" });
    expect(authorize(leader, "inventory.read", {})).toMatchObject({ allowed: false, code: "out_of_scope" });
  });

  it("applies the same isolation to organisation roles with explicit centre assignments", () => {
    expect(authorize(actor("head_office", ["c-1"]), "requests.approve", { centreId: "c-2" })).toMatchObject({ code: "out_of_scope" });
    expect(authorize(actor("head_office", "all"), "requests.approve", { centreId: "c-2" })).toEqual({ allowed: true });
    // Organisation-wide records (no centre) need all-centre scope, as in the seed provider's reads.
    expect(authorize(actor("head_office", ["c-1"]), "requests.approve", {})).toMatchObject({ code: "out_of_scope" });
  });
});

describe("separation of duties", () => {
  it("never lets purchasing approve requests", () => {
    expect(authorize(actor("purchasing", "all"), "requests.approve", { centreId: "c-1" })).toMatchObject({ allowed: false, code: "separation_of_duties" });
  });

  it("stops the person who raised a PO from authorising it, failing closed when the maker is unknown", () => {
    const ceo = actor("ceo", "all", "u-ceo");
    expect(authorize(ceo, "procurement.authorise", { centreId: "c-1", makerId: "u-ceo" })).toMatchObject({ code: "separation_of_duties" });
    expect(authorize(ceo, "procurement.authorise", { centreId: "c-1" })).toMatchObject({ code: "separation_of_duties" });
    expect(authorize(ceo, "procurement.authorise", { centreId: "c-1", makerId: "u-pur" })).toEqual({ allowed: true });
  });

  it("lets finance pay approved invoices only, without blocking other finance commands", () => {
    const fin = actor("finance", "all");
    expect(authorize(fin, "finance.manage", { centreId: "c-1", command: "pay", status: "received" })).toMatchObject({ code: "separation_of_duties" });
    expect(authorize(fin, "finance.manage", { centreId: "c-1", command: "pay" })).toMatchObject({ code: "separation_of_duties" });
    expect(authorize(fin, "finance.manage", { centreId: "c-1", command: "pay", status: "approved" })).toEqual({ allowed: true });
    expect(authorize(fin, "finance.manage", { centreId: "c-1", command: "query", status: "received" })).toEqual({ allowed: true });
  });
});
