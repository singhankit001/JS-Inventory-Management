import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/domain/types";
import { buildSeed, type SeedData } from "@/lib/data/seed";

// Runs the real server actions through demoCommand (schema → workflow → policy → run → audit) against a fresh seed.
const h = vi.hoisted(() => ({ store: undefined as unknown as SeedData, session: undefined as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/data/provider", () => ({ demoStore: () => h.store }));
vi.mock("@/lib/auth/session", () => ({ requireSession: async () => h.session }));

const { decideApproval, setBudget } = await import("@/app/actions/approvals");
const { period } = await import("@/lib/data/seed");

function signIn(userId: string, role: Role) {
  const user = h.store.users.find((u) => u.id === userId)!;
  h.session = { user, role, scope: user.centreIds.length ? user.centreIds : "all", centres: h.store.centres };
}
const pendingRequest = () => h.store.approvals.find((a) => a.subjectType === "monthly_request" && a.status === "pending" && h.store.requests.find((r) => r.id === a.subjectId)?.status === "submitted")!;

beforeEach(() => { h.store = buildSeed(); signIn("u-ho", "head_office"); });

describe("decideApproval", () => {
  it("approves a request with a trimmed line: approval, request, quantities and audit all change", async () => {
    const a = pendingRequest();
    const items = h.store.requestItems.filter((i) => i.requestId === a.subjectId);
    const first = items[0]!;
    const res = await decideApproval({ approvalId: a.id, decision: "approved", lines: [{ requestItemId: first.id, approvedQty: first.proposedQty - 1 }] });
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.message).toMatch(/1 line trimmed.*resets daily/);
    expect(a).toMatchObject({ status: "approved", decidedBy: "u-ho" });
    expect(h.store.requests.find((r) => r.id === a.subjectId)!.status).toBe("approved");
    expect(first.approvedQty).toBe(first.proposedQty - 1);
    expect(items.slice(1).every((i) => i.approvedQty === i.proposedQty)).toBe(true);
    expect(h.store.audit[0]).toMatchObject({ action: "approved", actorId: "u-ho", centreId: a.centreId });
    expect(h.store.audit[0]!.subject).toContain(`(${a.subjectId})`);
  });

  it("returns for revision with a comment the centre can read", async () => {
    const a = pendingRequest();
    const res = await decideApproval({ approvalId: a.id, decision: "revision_requested", comment: "Trim crayons" });
    expect(res.ok).toBe(true);
    expect(h.store.requests.find((r) => r.id === a.subjectId)!.status).toBe("revision_requested");
    expect(h.store.audit[0]!.subject).toMatch(/— Trim crayons$/);
  });

  it("requires a comment to return or reject", async () => {
    const a = pendingRequest();
    expect(await decideApproval({ approvalId: a.id, decision: "rejected" })).toMatchObject({ ok: false, code: "validation" });
    expect(a.status).toBe("pending");
  });

  it("blocks Purchasing by separation of duties and centre leaders by permission", async () => {
    const a = pendingRequest();
    signIn("u-po", "purchasing");
    expect(await decideApproval({ approvalId: a.id, decision: "approved" })).toMatchObject({ ok: false, code: "forbidden", error: "Purchasing cannot approve requests it will then order." });
    signIn("u-cl", "centre_leader");
    expect(await decideApproval({ approvalId: a.id, decision: "approved" })).toMatchObject({ ok: false, code: "forbidden" });
    expect(a.status).toBe("pending");
  });

  it("refuses decided approvals, over-approval and PO approvals without changing anything", async () => {
    const decided = h.store.approvals.find((a) => a.subjectType === "monthly_request" && a.status === "approved")!;
    expect(await decideApproval({ approvalId: decided.id, decision: "rejected", comment: "late" })).toMatchObject({ ok: false, code: "invalid_transition" });

    const a = pendingRequest();
    const item = h.store.requestItems.find((i) => i.requestId === a.subjectId)!;
    const before = item.approvedQty;
    expect(await decideApproval({ approvalId: a.id, decision: "approved", lines: [{ requestItemId: item.id, approvedQty: item.proposedQty + 1 }] })).toMatchObject({ ok: false, code: "validation" });
    expect(a.status).toBe("pending");
    expect(item.approvedQty).toBe(before);

    const po = h.store.approvals.find((x) => x.subjectType === "purchase_order" && x.status === "pending");
    if (po) expect(await decideApproval({ approvalId: po.id, decision: "approved" })).toMatchObject({ ok: false, code: "invalid_transition" });
  });
});

describe("setBudget", () => {
  it("changes this month's allocation with an audit entry, Head Office only", async () => {
    const now = period(h.store.today);
    const b = h.store.budgets.find((x) => x.centreId === "c-bnr" && x.period === now)!;
    expect(await setBudget({ centreId: "c-bnr", period: now, allocated: 90_000_00 })).toMatchObject({ ok: true });
    expect(b.allocated).toBe(90_000_00);
    expect(h.store.audit[0]).toMatchObject({ action: "changed budget", centreId: "c-bnr" });
    signIn("u-ceo", "ceo");
    expect(await setBudget({ centreId: "c-bnr", period: now, allocated: 1 })).toMatchObject({ ok: false, code: "forbidden" });
  });
  it("creates next month's record but refuses past months and zero", async () => {
    const next = period(new Date(h.store.today.getFullYear(), h.store.today.getMonth() + 1, 1));
    const past = period(new Date(h.store.today.getFullYear(), h.store.today.getMonth() - 1, 1));
    expect(await setBudget({ centreId: "c-kor", period: next, allocated: 50_000_00 })).toMatchObject({ ok: true });
    expect(h.store.budgets.find((x) => x.centreId === "c-kor" && x.period === next)).toMatchObject({ allocated: 50_000_00, spent: 0, committed: 0 });
    expect(await setBudget({ centreId: "c-kor", period: past, allocated: 50_000_00 })).toMatchObject({ ok: false, code: "validation" });
    expect(await setBudget({ centreId: "c-kor", period: next, allocated: 0 })).toMatchObject({ ok: false, code: "validation" });
  });
});
