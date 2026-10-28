import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/data/seed";
import { AI_CAPABILITIES, demoProvider, extractPhrases, matchScore, outputStatus, previewInputs, type AICapabilityId, type AIDataset } from "./contracts";

const seed = buildSeed(new Date(2026, 9, 27));
const data: AIDataset = seed;
const ids: Record<string, Set<string>> = {
  centre: new Set(seed.centres.map((c) => c.id)), product: new Set(seed.products.map((p) => p.id)), supplier: new Set(seed.suppliers.map((s) => s.id)),
  invoice: new Set(seed.invoices.map((i) => i.id)), purchase_order: new Set(seed.purchaseOrders.map((p) => p.id)),
};

describe("demo AI provider", () => {
  const inputs = previewInputs(data);
  const run = (c: AICapabilityId) => demoProvider(data).run(c, inputs[c] as never);

  it.each(AI_CAPABILITIES.map((c) => c.id))("%s is deterministic, flagged demo and cites real records", async (id) => {
    const [a, b] = await Promise.all([run(id), demoProvider(buildSeed(new Date(2026, 9, 27))).run(id, inputs[id] as never)]);
    expect(a).toEqual(b);
    expect(a.demo).toBe(true);
    expect(a.confidence).toBeGreaterThanOrEqual(0);
    expect(a.confidence).toBeLessThanOrEqual(1);
    expect(a.explanation.length).toBeGreaterThan(0);
    for (const c of a.citations) expect(ids[c.kind]?.has(c.id), `${c.kind} ${c.id}`).toBe(true);
  });

  it("cites at least one record for capabilities that point at records", async () => {
    for (const id of ["request_intelligence", "inventory_analysis", "budget_intelligence", "document_intelligence", "reconciliation", "operational_assistant"] as const)
      expect((await run(id)).citations.length, id).toBeGreaterThan(0);
  });

  it("drafts need review; insights complete on their own (AI_JOB machine)", () => {
    expect(outputStatus("request_intelligence")).toBe("needs_review");
    expect(outputStatus("document_intelligence")).toBe("needs_review");
    expect(outputStatus("executive_insights")).toBe("completed");
  });

  it("extracts quantities from the transcript and matches the catalogue", async () => {
    expect(extractPhrases("We need 12 boxes of jumbo crayons, 10 litres of hand wash and 3 first aid kit refills.")).toEqual([
      { qty: 12, phrase: "jumbo crayons" }, { qty: 10, phrase: "hand wash" }, { qty: 3, phrase: "first aid kit refills" },
    ]);
    expect(matchScore("jumbo crayons", "Jumbo wax crayons (12)")).toBe(1);
    expect(matchScore("sparkly stickers", "Jumbo wax crayons (12)")).toBe(0);
    const { result } = await demoProvider(data).run("request_intelligence", inputs.request_intelligence);
    expect(result.lines.find((l) => l.phrase === "jumbo crayons")?.productId).toBe("p-1");
    expect(result.lines.find((l) => l.phrase === "sparkly stickers")?.productId).toBeNull();
  });
});
