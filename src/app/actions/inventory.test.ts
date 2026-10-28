import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const session = { user: { id: "u-cl" }, role: "centre_leader", scope: ["c-and"] as "all" | string[], centres: [] };
vi.mock("@/lib/auth/session", () => ({ requireSession: async () => session }));

const { demoStore } = await import("@/lib/data/provider");
const { submitStockCount } = await import("./inventory");

const store = demoStore();
const closing = (centreId: string) => store.counts.find((c) => c.centreId === centreId && c.kind === "closing")!;
const linesFor = (centreId: string, tweak: Record<string, number> = {}) =>
  store.balances.filter((b) => b.centreId === centreId).map((b) => ({ productId: b.productId, onHand: b.onHand + (tweak[b.productId] ?? 0) }));

describe("submitStockCount", () => {
  beforeEach(() => { session.role = "centre_leader"; session.scope = ["c-and"]; });

  it("writes an adjustment per variance, sets balances to the count and submits the count", async () => {
    const sc = closing("c-and");
    const before = new Map(store.balances.filter((b) => b.centreId === "c-and").map((b) => [b.productId, b.onHand]));
    const [a, b] = [...before.keys()];
    const moves = store.movements.length;
    const res = await submitStockCount({ centreId: "c-and", period: sc.period, kind: "closing", lines: linesFor("c-and", { [a!]: -2, [b!]: 1 }) });
    expect(res).toMatchObject({ ok: true, data: { lines: 2, units: -1 } });
    expect(res.ok && res.message).toMatch(/2 variances .* saved to demo data/);
    const added = store.movements.slice(moves);
    expect(added.map((m) => [m.productId, m.quantity, m.type, m.reference])).toEqual([[a, -2, "adjustment", `count-AND-${sc.period}`], [b, 1, "adjustment", `count-AND-${sc.period}`]]);
    expect(store.balances.find((x) => x.centreId === "c-and" && x.productId === a)!.onHand).toBe(before.get(a!)! - 2);
    expect(sc.status).toBe("submitted");
    expect(store.audit[0]).toMatchObject({ action: "submitted closing count", actorId: "u-cl", centreId: "c-and" });
  });

  it("refuses a second submission through the state machine", async () => {
    const sc = closing("c-and");
    const res = await submitStockCount({ centreId: "c-and", period: sc.period, kind: "closing", lines: linesFor("c-and") });
    expect(res).toMatchObject({ ok: false, code: "invalid_transition" });
  });

  it("requires every product to be counted and writes nothing otherwise", async () => {
    session.scope = ["c-pow"];
    const sc = closing("c-pow");
    const moves = store.movements.length;
    const res = await submitStockCount({ centreId: "c-pow", period: sc.period, kind: "closing", lines: linesFor("c-pow").slice(1) });
    expect(res).toMatchObject({ ok: false, code: "validation" });
    expect(store.movements.length).toBe(moves);
    expect(sc.status).not.toBe("submitted");
  });

  it("blocks other centres and roles without inventory.count", async () => {
    const sc = closing("c-kor");
    expect(await submitStockCount({ centreId: "c-kor", period: sc.period, kind: "closing", lines: linesFor("c-kor") })).toMatchObject({ ok: false, code: "forbidden" });
    session.role = "head_office"; session.scope = "all";
    expect(await submitStockCount({ centreId: "c-kor", period: sc.period, kind: "closing", lines: linesFor("c-kor") })).toMatchObject({ ok: false, code: "forbidden" });
    expect(sc.status).not.toBe("submitted");
  });
});
