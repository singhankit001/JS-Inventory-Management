import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/domain/types";
import { buildSeed, period, type SeedData } from "@/lib/data/seed";

// The real server actions through demoCommand (schema → workflow → policy → run → audit) on a fresh seed.
const h = vi.hoisted(() => ({ store: undefined as unknown as SeedData, session: undefined as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/data/provider", () => ({ demoStore: () => h.store }));
vi.mock("@/lib/auth/session", () => ({ requireSession: async () => h.session }));

const { raiseEmergency, saveDraftRequest, submitRequest } = await import("@/app/actions/requests");

function signIn(userId: string, role: Role) {
  const user = h.store.users.find((u) => u.id === userId)!;
  h.session = { user, role, scope: user.centreIds.length ? user.centreIds : "all", centres: h.store.centres };
}
const nextPeriod = () => period(new Date(h.store.today.getFullYear(), h.store.today.getMonth() + 1, 1));
const lines = [{ productId: "p-1", proposedQty: 20 }, { productId: "p-6", proposedQty: 10 }];

beforeEach(() => { h.store = buildSeed(); signIn("u-cl", "centre_leader"); });

describe("request actions", () => {
  it("submits a new request: request, priced items, pending Head Office approval and audit", async () => {
    const res = await submitRequest({ centreId: "c-bnr", period: nextPeriod(), items: lines }, "For the art week");
    expect(res).toMatchObject({ ok: true, data: { id: `rq-BNR-${nextPeriod()}` } });
    const r = h.store.requests.find((x) => x.id === `rq-BNR-${nextPeriod()}`)!;
    const items = h.store.requestItems.filter((i) => i.requestId === r.id);
    expect(r).toMatchObject({ status: "submitted", priority: "routine", submittedBy: "u-cl", total: 20 * 180_00 + 10 * 150_00 });
    expect(items.map((i) => i.unitCost)).toEqual([180_00, 150_00]);
    expect(h.store.approvals.at(-1)).toMatchObject({ subjectId: r.id, status: "pending", stage: "head_office", critical: false, amount: r.total });
    expect(h.store.audit[0]).toMatchObject({ action: "submitted", actorId: "u-cl", centreId: "c-bnr" });
    expect(h.store.audit[0]!.subject).toMatch(/\(rq-BNR-.*\) — For the art week$/);
  });

  it("blocks a second routine request for the same centre and month", async () => {
    expect(await saveDraftRequest({ centreId: "c-bnr", period: period(h.store.today), items: lines })).toMatchObject({ ok: false, code: "conflict" });
  });

  it("keeps a centre leader inside their own centre", async () => {
    expect(await saveDraftRequest({ centreId: "c-kor", period: nextPeriod(), items: lines })).toMatchObject({ ok: false, code: "forbidden" });
    signIn("u-ho", "head_office");
    expect(await saveDraftRequest({ centreId: "c-bnr", period: nextPeriod(), items: lines })).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("edits and resubmits a request returned for revision, opening a new approval round", async () => {
    const r = h.store.requests.find((x) => x.status === "revision_requested" && x.priority === "routine")!;
    const leader = h.store.users.find((u) => u.centreIds.includes(r.centreId) && u.roles.includes("centre_leader"))!;
    signIn(leader.id, "centre_leader");
    const rounds = h.store.approvals.filter((a) => a.subjectId === r.id).length;
    const res = await submitRequest({ requestId: r.id, centreId: r.centreId, period: r.period, items: lines });
    expect(res.ok).toBe(true);
    expect(r.status).toBe("submitted");
    expect(h.store.requestItems.filter((i) => i.requestId === r.id)).toHaveLength(2);
    expect(h.store.approvals.filter((a) => a.subjectId === r.id)).toHaveLength(rounds + 1);
    expect(h.store.audit[0]!.action).toBe("resubmitted");
  });

  it("refuses to edit a submitted request", async () => {
    const r = h.store.requests.find((x) => x.status === "submitted" && x.centreId === "c-bnr" && x.priority === "routine")!;
    expect(await saveDraftRequest({ requestId: r.id, centreId: r.centreId, period: r.period, items: lines })).toMatchObject({ ok: false, code: "invalid_transition" });
  });

  it("raises an emergency with a critical final-stage approval and keeps the reason", async () => {
    const res = await raiseEmergency({ centreId: "c-bnr", reason: "Hand wash ran out", items: [{ productId: "p-10", proposedQty: 4 }] });
    expect(res.ok).toBe(true);
    const r = h.store.requests.find((x) => x.id === (res.ok && res.data!.id))!;
    expect(r).toMatchObject({ priority: "emergency", status: "submitted", total: 4 * 620_00 });
    expect(h.store.approvals.at(-1)).toMatchObject({ subjectId: r.id, critical: true, stage: "final", status: "pending" });
    expect(h.store.audit[0]!.subject).toMatch(/— Hand wash ran out$/);
    expect(await raiseEmergency({ centreId: "c-bnr", reason: "", items: [{ productId: "p-10", proposedQty: 4 }] })).toMatchObject({ ok: false, code: "validation" });
  });
});
