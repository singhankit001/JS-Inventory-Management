import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const session = { user: { id: "u-fin" }, role: "finance", scope: "all", centres: [] };
vi.mock("@/lib/auth/session", () => ({ requireSession: async () => session }));

const { demoStore } = await import("@/lib/data/provider");
const { approveInvoice, queryInvoice, recordPayment } = await import("./finance");

const store = demoStore();
const pick = (f: (i: (typeof store.invoices)[number]) => boolean) => store.invoices.find(f)!;

describe("finance actions", () => {
  beforeEach(() => { session.role = "finance"; });

  it("blocks approval unless the three-way match passed, with the machine's reason", async () => {
    const bad = pick((i) => i.status === "received" && i.match !== "matched");
    const res = await approveInvoice({ invoiceId: bad.id });
    expect(res).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(!res.ok && res.error).toMatch(/Three-way match failed/);
    expect(bad.status).toBe("received");
  });

  it("approves a matched invoice and records the audit event", async () => {
    const ok = pick((i) => i.status === "received" && i.match === "matched");
    expect(await approveInvoice({ invoiceId: ok.id })).toMatchObject({ ok: true });
    expect(ok.status).toBe("approved");
    expect(store.audit[0]).toMatchObject({ action: "approved invoice", actorId: "u-fin" });
  });

  it("requires a reason to query and only queries received invoices", async () => {
    const inv = pick((i) => i.status === "received");
    expect(await queryInvoice({ invoiceId: inv.id, reason: " " })).toMatchObject({ ok: false, code: "validation" });
    expect(await queryInvoice({ invoiceId: inv.id, reason: "Price differs from PO" })).toMatchObject({ ok: true });
    expect(inv.status).toBe("query");
    expect(await queryInvoice({ invoiceId: inv.id, reason: "again" })).toMatchObject({ ok: false, code: "invalid_transition" });
  });

  it("only approved invoices can be paid (policy), and payments never exceed the invoice", async () => {
    const open = pick((i) => i.status === "query");
    const paidAt = new Date().toISOString();
    expect(await recordPayment({ invoiceId: open.id, amount: open.amount, paidAt, method: "neft" })).toMatchObject({ ok: false, code: "forbidden", error: "Only approved invoices can be paid." });
    const approved = pick((i) => i.status === "approved");
    expect(await recordPayment({ invoiceId: approved.id, amount: approved.amount + 1, paidAt, method: "upi" })).toMatchObject({ ok: false, code: "validation" });
    const before = store.payments.length;
    expect(await recordPayment({ invoiceId: approved.id, amount: approved.amount, paidAt, method: "upi" })).toMatchObject({ ok: true });
    expect(approved.status).toBe("paid");
    expect(store.payments).toHaveLength(before + 1);
  });

  it("denies roles without finance.manage", async () => {
    session.role = "ceo";
    const inv = pick((i) => i.status === "received");
    expect(await queryInvoice({ invoiceId: inv.id, reason: "Check price" })).toMatchObject({ ok: false, code: "forbidden" });
    expect(inv.status).toBe("received");
  });
});
