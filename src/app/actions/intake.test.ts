import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const session = { user: { id: "u-cl" }, role: "centre_leader", scope: ["c-bnr"], centres: [] };
vi.mock("@/lib/auth/session", () => ({ requireSession: async () => session }));

const { demoStore } = await import("@/lib/data/provider");
const { uploadMedia, confirmAIDraft } = await import("./intake");
const store = demoStore();

describe("intake actions", () => {
  it("validates media metadata and keeps centre leaders in their centre", async () => {
    expect(await uploadMedia({ centreId: "c-bnr", kind: "audio_request", contentType: "video/mp4", sizeBytes: 10 })).toMatchObject({ ok: false, code: "validation" });
    expect(await uploadMedia({ centreId: "c-kor", kind: "audio_request", contentType: "audio/webm", sizeBytes: 10 })).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("opens a job that waits for review, then turns the confirmed draft into a draft request once", async () => {
    const up = await uploadMedia({ centreId: "c-bnr", kind: "audio_request", contentType: "audio/webm", sizeBytes: 2048 });
    expect(up.ok).toBe(true);
    const jobId = up.ok ? up.data!.jobId : "";
    expect(store.aiJobs.find((j) => j.id === jobId)?.status).toBe("needs_review");

    expect(await confirmAIDraft({ jobId, items: [{ productId: "p-1", proposedQty: 12 }, { productId: "p-1", proposedQty: 2 }] })).toMatchObject({ ok: false, code: "validation" });
    const res = await confirmAIDraft({ jobId, items: [{ productId: "p-1", proposedQty: 12 }, { productId: "p-10", proposedQty: 10 }] });
    expect(res).toMatchObject({ ok: true });
    const id = res.ok ? res.data!.requestId : "";
    const r = store.requests.find((x) => x.id === id)!;
    expect(r).toMatchObject({ status: "draft", source: "audio", centreId: "c-bnr", submittedBy: "u-cl" });
    expect(r.total).toBe(12 * store.products.find((p) => p.id === "p-1")!.unitCost + 10 * store.products.find((p) => p.id === "p-10")!.unitCost);
    expect(store.aiJobs.find((j) => j.id === jobId)?.status).toBe("completed");
    expect(await confirmAIDraft({ jobId, items: [{ productId: "p-1", proposedQty: 1 }] })).toMatchObject({ ok: false, code: "invalid_transition" });
  });
});
