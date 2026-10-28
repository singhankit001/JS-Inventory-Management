import { describe, expect, it, vi } from "vitest";
import { jobSteps } from "./integrations";

vi.mock("server-only", () => ({}));

const states = (s: ReturnType<typeof jobSteps>) => s.map((x) => `${x.label}:${x.state}`);

describe("jobSteps", () => {
  it("routes AI drafts through human review", () => {
    expect(states(jobSteps({ kind: "audio_request", status: "needs_review" }))).toEqual(["Queued:done", "Processing:done", "Needs review:current", "Completed:upcoming"]);
  });
  it("lets insights skip review and marks completed jobs fully done", () => {
    expect(states(jobSteps({ kind: "insight", status: "completed" }))).toEqual(["Queued:done", "Processing:done", "Completed:done"]);
  });
  it("stops a failed job at processing", () => {
    expect(states(jobSteps({ kind: "invoice_ocr", status: "failed" }))).toEqual(["Queued:done", "Processing:blocked", "Needs review:upcoming", "Completed:upcoming"]);
  });
});
