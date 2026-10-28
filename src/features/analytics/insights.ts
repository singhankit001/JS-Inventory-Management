import type { AIProcessingJob } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { indexBy } from "@/features/dashboards/shared";
import { relative } from "@/lib/format";
import { AI_CAPABILITIES, ASSISTANT_QUESTIONS, aiDataset, demoProvider, previewInputs, type AICapabilityId, type AIOutput } from "@/features/ai/contracts";

export const JOB_STATUS: Record<AIProcessingJob["status"], { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" }, processing: { label: "Processing", tone: "blue" }, needs_review: { label: "Needs review", tone: "amber" },
  completed: { label: "Completed", tone: "green" }, failed: { label: "Failed", tone: "red" },
};
const JOB_KIND: Record<AIProcessingJob["kind"], string> = { audio_request: "Audio request", video_request: "Video request", invoice_ocr: "Invoice reading", insight: "Insight run" };

export async function loadInsights(repo: Repository) {
  const data = await aiDataset(repo);
  const ai = demoProvider(data);
  const inputs = previewInputs(data);
  const cmap = indexBy(data.centres, "id");
  // Every capability's demo output, computed from the caller's scoped data. No model, no network.
  const outputs = await Promise.all(AI_CAPABILITIES.map((c) => ai.run(c.id, inputs[c.id] as never) as Promise<AIOutput<unknown>>));
  const answers = await Promise.all(ASSISTANT_QUESTIONS.map((q) => ai.run("operational_assistant", { questionId: q.id })));
  return {
    provider: { name: ai.name, connected: ai.connected },
    capabilities: AI_CAPABILITIES.map((c, i) => ({ id: c.id as AICapabilityId, name: c.name, summary: c.summary, output: { ...outputs[i]!, result: undefined } })),
    answers: answers.map((a) => ({ ...a, result: undefined, question: a.result.question, questionId: a.result.questionId })),
    jobs: [...data.aiJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((j) => ({
      id: j.id, title: `${JOB_KIND[j.kind]}${j.centreId ? ` · ${cmap.get(j.centreId)?.name ?? ""}` : ""}`, sub: `${j.id.toUpperCase()} · ${relative(j.createdAt, data.today)}`, badge: JOB_STATUS[j.status],
    })),
  };
}
