import type { AIProcessingJob, Integration } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import type { Step } from "@/components/ui/stepper";
import { AI_JOB, allowedCommands } from "@/domain/workflows";
import { indexBy } from "@/features/dashboards/shared";
import { relative, shortDate, time } from "@/lib/format";

export const INTEGRATION_STATUS: Record<Integration["status"], { label: string; tone: Tone }> = {
  not_configured: { label: "Not configured", tone: "neutral" }, connected: { label: "Connected", tone: "green" },
  degraded: { label: "Degraded", tone: "amber" }, down: { label: "Down", tone: "red" },
};
/** What each connection switches on once Phase 2 wires it. */
const UNLOCKS: Record<string, string> = {
  "int-db": "Permanent records in Postgres instead of demo data that resets daily, with centre isolation enforced in the database.",
  "int-mail": "Invitation emails, request-deadline reminders and approval alerts outside the app.",
  "int-ai": "Real transcription for audio and video requests and invoice OCR — the jobs in the queue below.",
  "int-acc": "Approved invoices and payments pushed to the accounting system without re-keying.",
};
export const JOB_KIND: Record<AIProcessingJob["kind"], string> = { audio_request: "Audio request", video_request: "Video request", invoice_ocr: "Invoice OCR", insight: "Insight" };
export const JOB_STATUS: Record<AIProcessingJob["status"], { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" }, processing: { label: "Processing", tone: "blue" }, needs_review: { label: "Needs review", tone: "amber" },
  completed: { label: "Completed", tone: "slate" }, failed: { label: "Failed", tone: "red" },
};
const COMMAND_LABEL: Record<keyof typeof AI_JOB.commands, string> = {
  start: "Start processing", flagForReview: "Flag for review", fail: "Mark failed", finish: "Finish", confirm: "Confirm draft",
};

/**
 * The AI_JOB machine as a stepper. Drafts that become requests or payables always pass "Needs review" (the machine's
 * `finish` guard); insights skip it. A failed job stops at processing.
 */
export function jobSteps(job: Pick<AIProcessingJob, "kind" | "status">): Step[] {
  const path: AIProcessingJob["status"][] = job.kind === "insight" ? ["queued", "processing", "completed"] : ["queued", "processing", "needs_review", "completed"];
  if (job.status === "failed") return path.map((s, i) => ({ label: JOB_STATUS[s].label, state: i === 0 ? "done" : i === 1 ? "blocked" : "upcoming", detail: i === 1 ? "Failed — needs a retry" : undefined }));
  const at = path.indexOf(job.status);
  return path.map((s, i) => ({ label: JOB_STATUS[s].label, state: i < at || job.status === "completed" ? "done" : i === at ? "current" : "upcoming" }));
}

const DAYS = 14;

export async function loadIntegrations(repo: Repository) {
  const today = repo.today();
  const [integrations, jobs, centres] = await Promise.all([repo.integrations(), repo.aiJobs(), repo.centres()]);
  const cmap = indexBy(centres, "id");
  const sorted = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const by = (s: AIProcessingJob["status"]) => jobs.filter((j) => j.status === s).length;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1));
  const days = Array.from({ length: DAYS }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const centreName = (id?: string) => (id ? cmap.get(id)?.name ?? id : "Organisation");

  return {
    integrations: integrations.map((i) => ({
      id: i.id, name: i.name, ...INTEGRATION_STATUS[i.status], unlocks: UNLOCKS[i.id] ?? "",
      checked: i.lastCheckedAt ? `Checked ${relative(i.lastCheckedAt, today)}` : "Never checked — not wired yet",
    })),
    connected: integrations.filter((i) => i.status === "connected").length,
    counts: { total: jobs.length, open: by("queued") + by("processing"), review: by("needs_review"), failed: by("failed"), completed: by("completed") },
    byStatus: (Object.keys(JOB_STATUS) as AIProcessingJob["status"][]).map((s) => ({ label: JOB_STATUS[s].label, value: by(s), display: String(by(s)), tone: JOB_STATUS[s].tone })),
    throughput: days.map((d, i) => ({
      label: i === DAYS - 1 ? "Today" : shortDate(d.toISOString()),
      value: jobs.filter((j) => new Date(j.createdAt).toDateString() === d.toDateString()).length,
    })),
    rows: sorted.map((j) => ({
      id: j.id,
      job: { label: j.id.toUpperCase(), href: `/governance/integrations?job=${j.id}` },
      kind: JOB_KIND[j.kind],
      centre: j.centreId ? { label: centreName(j.centreId), href: `/inventory/centres/${j.centreId}` } : "Organisation",
      status: JOB_STATUS[j.status],
      created: j.createdAt,
    })),
    jobs: Object.fromEntries(sorted.map((j) => [j.id, {
      id: j.id, kind: JOB_KIND[j.kind], centre: centreName(j.centreId), centreId: j.centreId, status: JOB_STATUS[j.status],
      created: `${shortDate(j.createdAt)} · ${time(j.createdAt)}`, steps: jobSteps(j),
      next: allowedCommands(AI_JOB, j.status, { kind: j.kind }).map((c) => COMMAND_LABEL[c]),
    }])),
  };
}
