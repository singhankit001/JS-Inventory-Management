import { describe, expect, it, vi } from "vitest";
import { avgMonthlyUse, budgetImpact, requestSteps, suggestedQty, variance } from "./logic";

vi.mock("server-only", () => ({}));

const mv = (productId: string, quantity: number, occurredAt: string, type: "consumption" | "receipt" = "consumption") =>
  ({ id: `${productId}-${occurredAt}-${type}`, centreId: "c-1", productId, type, quantity, occurredAt });

describe("suggested quantity", () => {
  it("averages consumption over the three complete months before today, ignoring this month and receipts", () => {
    const today = new Date(2026, 9, 28); // Oct 2026
    const use = avgMonthlyUse([
      mv("p", 30, "2026-07-10T10:00:00Z"), mv("p", 60, "2026-08-10T10:00:00Z"), mv("p", 90, "2026-09-10T10:00:00Z"),
      mv("p", 500, "2026-10-02T10:00:00Z"), mv("p", 500, "2026-06-10T10:00:00Z"), mv("p", 999, "2026-09-12T10:00:00Z", "receipt"),
    ], today);
    expect(use.get("c-1:p")).toBe(60);
  });
  it("covers a month of use plus the reorder point, net of stock and open orders, never negative", () => {
    expect(suggestedQty(60, 20, 0, 30)).toBe(70);
    expect(suggestedQty(60, 20, 15, 30)).toBe(55);
    expect(suggestedQty(10.2, 0, 0, 0)).toBe(11);
    expect(suggestedQty(10, 200, 0, 30)).toBe(0);
  });
});

describe("budgetImpact", () => {
  it("reports headroom left after the request", () => {
    const i = budgetImpact({ allocated: 100_000, spent: 40_000, committed: 20_000 }, 30_000);
    expect(i).toMatchObject({ headroom: 40_000, after: 10_000, over: false, utilisation: 0.9 });
    expect(i.share).toEqual({ spent: 0.4, committed: 0.2, request: 0.3, allocation: 1 });
  });
  it("scales to total demand when the request overshoots, keeping the allocation mark inside the bar", () => {
    const i = budgetImpact({ allocated: 100_000, spent: 60_000, committed: 20_000 }, 45_000);
    expect(i).toMatchObject({ after: -25_000, over: true });
    expect(i.share.allocation).toBeCloseTo(0.8);
    expect(i.share.spent + i.share.committed + i.share.request).toBeCloseTo(1);
  });
  it("survives an empty budget", () => {
    expect(budgetImpact({ allocated: 0, spent: 0, committed: 0 }, 0)).toMatchObject({ utilisation: 0, over: false });
  });
});

describe("variance and steps", () => {
  it("flags lines beyond ±25% of history and treats no history as new", () => {
    expect(variance(130, 100)).toMatchObject({ flagged: true, tone: "orange", label: "+30%" });
    expect(variance(110, 100).flagged).toBe(false);
    expect(variance(5, 0)).toMatchObject({ ratio: null, flagged: false });
  });
  it("shows the revision loop and a blocked review when rejected", () => {
    const back = requestSteps("revision_requested", 1);
    expect(back.map((s) => s.state)).toEqual(["done", "current", "upcoming", "upcoming", "upcoming"]);
    expect(back[1]!.detail).toMatch(/resubmit/);
    expect(requestSteps("submitted", 2)[1]!.detail).toBe("2 revision rounds");
    expect(requestSteps("rejected", 0)[2]!.state).toBe("blocked");
    expect(requestSteps("fulfilled", 0).every((s) => s.state === "done")).toBe(true);
  });
});

describe("loaders on the seed", async () => {
  const { seedRepository } = await import("@/lib/data/provider");
  const { loadMonthlyRequests } = await import("./monthly");
  const { loadRequestDetail } = await import("./detail");
  it("lists this month's request for every centre and loads each detail", async () => {
    const repo = seedRepository("all");
    const list = await loadMonthlyRequests(repo);
    expect(list.rows.length).toBeGreaterThanOrEqual(15);
    for (const row of list.rows) expect(await loadRequestDetail(repo, row.id)).not.toBeNull();
  });
  it("hides other centres' requests from a centre-scoped repository", async () => {
    const repo = seedRepository(["c-and"]);
    expect((await loadMonthlyRequests(repo, "all")).rows.every((r) => r.centre === "Andheri West")).toBe(true);
    expect(await loadRequestDetail(seedRepository("all"), "rq-HSR-em1")).not.toBeNull();
    expect(await loadRequestDetail(repo, "rq-HSR-em1")).toBeNull();
  });
});

describe("approval queue on the seed", async () => {
  const { seedRepository } = await import("@/lib/data/provider");
  const { loadApprovalQueue } = await import("@/features/approvals/queue");
  it("puts critical approvals first and only pending ones in the pending view", async () => {
    const q = await loadApprovalQueue(seedRepository("all"), "pending");
    expect(q.rows.length).toBe(q.totals.pending);
    expect(q.rows.every((r) => r.status.label === "Pending")).toBe(true);
    const firstStandard = q.rows.findIndex((r) => r.priority.label === "Standard");
    expect(q.rows.slice(firstStandard).some((r) => r.priority.label === "Critical")).toBe(false);
  });
});

describe("approval detail on the seed", async () => {
  const { seedRepository } = await import("@/lib/data/provider");
  const { loadApprovalDetail } = await import("@/features/approvals/detail");
  const repo = seedRepository("all");
  const ho = { userId: "u-ho", role: "head_office" as const, scope: "all" as const };
  it("loads every approval and gates decisions by workflow and policy", async () => {
    for (const a of await repo.approvals()) {
      const d = (await loadApprovalDetail(repo, a.id, ho))!;
      expect(d).not.toBeNull();
      if (a.status !== "pending") expect(d.decisions.every((x) => !x.allowed)).toBe(true);
      if (a.status === "pending" && a.subjectType === "monthly_request") expect(d.decisions.every((x) => x.allowed)).toBe(true);
      if (a.subjectType === "purchase_order") expect(d.decisions[0]!.reason).toMatch(/Purchase orders/);
    }
    const pending = (await repo.approvals()).find((a) => a.status === "pending" && a.subjectType === "monthly_request")!;
    const asPurchasing = await loadApprovalDetail(repo, pending.id, { userId: "u-po", role: "purchasing", scope: "all" });
    expect(asPurchasing!.decisions.every((x) => !x.allowed && /Purchasing cannot approve/.test(x.reason!))).toBe(true);
  });
});

describe("create request loader", async () => {
  const { seedRepository } = await import("@/lib/data/provider");
  const { loadNewRequest } = await import("./new");
  const repo = seedRepository(["c-and"]);
  it("defaults to the first month without a request and blocks duplicates with a way out", async () => {
    const d = await loadNewRequest(repo, {});
    expect(d.kind).toBe("form");
    if (d.kind !== "form") return;
    expect(d.periods[0]!.taken).toBeDefined();
    expect(d.products.every((p) => p.suggested >= 0 && p.categoryId !== "cat-pan")).toBe(true);
    const blocked = await loadNewRequest(repo, { period: d.periods[0]!.key });
    expect(blocked).toMatchObject({ kind: "blocked" });
    expect(blocked.kind === "blocked" && blocked.actions.some((a) => a.href.includes(d.period))).toBe(true);
  });
  it("only edits drafts and returned requests", async () => {
    const all = seedRepository("all");
    const submitted = (await all.requests()).find((r) => r.status === "submitted")!;
    expect(await loadNewRequest(all, { edit: submitted.id })).toMatchObject({ kind: "blocked" });
    const draft = (await all.requests()).find((r) => r.status === "draft")!;
    const d = await loadNewRequest(all, { edit: draft.id });
    expect(d.kind === "form" && Object.keys(d.initial).length).toBeGreaterThan(0);
  });
});

describe("emergency loader", async () => {
  const { seedRepository } = await import("@/lib/data/provider");
  const { loadEmergencies } = await import("./emergency");
  it("orders breached emergencies first and stops the SLA clock once decided", async () => {
    const d = await loadEmergencies(seedRepository("all"), new Date(Date.now() + 3 * 86_400_000));
    expect(d.open.length).toBeGreaterThan(0);
    expect(d.open[0]!.breached).toBe(true);
    expect(d.open.filter((o) => !o.waitingDecision).every((o) => !o.breached)).toBe(true);
  });
});
