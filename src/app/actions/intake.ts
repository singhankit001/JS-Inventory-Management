"use server";

import type { CommandInput } from "@/domain/commands";
import type { AIProcessingJob, ID, MonthlyRequest, RequestItem } from "@/domain/types";
import { AI_JOB, transition } from "@/domain/workflows";
import { period } from "@/lib/data/seed";
import { demoCommand, type DemoResult } from "@/lib/demo/command";
import { avgMonthlyUse, periodLabel } from "@/features/requests/logic";
import { money } from "@/lib/format";

/**
 * Registers an audio/video request as an AI job. Only metadata (type, size) reaches the server — the media itself never
 * leaves the browser in Phase 1. The worker steps (start → flag for review) are simulated here through the AI_JOB machine
 * so the job lands where a real worker would leave it: needs_review.
 */
export async function uploadMedia(input: CommandInput<"uploadMedia">): Promise<DemoResult<{ jobId: ID }>> {
  return demoCommand("uploadMedia", input, (cmd, s) => {
    if (!s.centres.some((c) => c.id === cmd.centreId)) return { code: "not_found", error: "That centre does not exist." };
    return { permission: "requests.create", resource: { centreId: cmd.centreId } };
  }, (cmd, ctx) => {
    const job: AIProcessingJob = { id: ctx.id("ai"), kind: cmd.kind, centreId: cmd.centreId, status: "queued", createdAt: ctx.now };
    for (const step of ["start", "flagForReview"] as const) {
      const t = transition(AI_JOB, job.status, step, job);
      if (!t.ok) return { code: "invalid_transition", error: t.reason };
      job.status = t.to;
    }
    ctx.store.aiJobs.push(job);
    ctx.audit("uploaded media", `${cmd.kind === "audio_request" ? "Audio" : "Video"} request for AI drafting (${job.id})`, cmd.centreId);
    return { message: "Recording registered for drafting", data: { jobId: job.id } };
  });
}

/** A person confirms the AI draft: the job completes (AI_JOB confirm) and a draft monthly request for next month is created. */
export async function confirmAIDraft(input: CommandInput<"confirmAIDraft">): Promise<DemoResult<{ requestId: ID }>> {
  return demoCommand("confirmAIDraft", input, (cmd, s) => {
    const job = s.aiJobs.find((j) => j.id === cmd.jobId);
    if (!job || !job.centreId) return { code: "not_found", error: "That AI job no longer exists — process the recording again." };
    if (job.kind !== "audio_request" && job.kind !== "video_request") return { code: "validation", error: "Only audio or video request jobs become requests." };
    const t = transition(AI_JOB, job.status, "confirm", job);
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    const next = period(new Date(s.today.getFullYear(), s.today.getMonth() + 1, 1));
    const dup = s.requests.find((r) => r.centreId === job.centreId && r.period === next && r.priority === "routine");
    if (dup) return { code: "conflict", error: `This centre already has a ${periodLabel(next)} request (${dup.id}). Add the items there instead.` };
    return { permission: t.permission, resource: { centreId: job.centreId } };
  }, (cmd, ctx) => {
    const s = ctx.store;
    const job = s.aiJobs.find((j) => j.id === cmd.jobId)!;
    const centre = s.centres.find((c) => c.id === job.centreId)!;
    const next = period(new Date(s.today.getFullYear(), s.today.getMonth() + 1, 1));
    const id = `rq-${centre.code}-${next}`;
    const use = avgMonthlyUse(s.movements.filter((m) => m.centreId === centre.id), s.today);
    const items: RequestItem[] = [];
    for (const [j, l] of cmd.items.entries()) {
      // Prices and history come from the catalogue and the ledger, never from the draft.
      const p = s.products.find((x) => x.id === l.productId && x.status === "active");
      if (!p) return { code: "validation", error: "One of the products is no longer in the catalogue. Remove it and try again." };
      items.push({ id: `${id}-${j}`, requestId: id, productId: p.id, proposedQty: l.proposedQty, historicalAvgQty: Math.round(use.get(`${centre.id}:${p.id}`) ?? 0), unitCost: p.unitCost });
    }
    const t = transition(AI_JOB, job.status, "confirm", job);
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    job.status = t.to;
    const total = items.reduce((sum, i) => sum + i.proposedQty * i.unitCost, 0);
    const r: MonthlyRequest = { id, centreId: centre.id, period: next, status: "draft", priority: "routine", source: job.kind === "audio_request" ? "audio" : "video", submittedBy: ctx.actor.userId, total };
    s.requests.push(r);
    s.requestItems.push(...items);
    ctx.audit("saved draft", `Monthly request · ${centre.name} · ${periodLabel(next)} (${id}) — drafted from ${r.source} (${job.id})`, centre.id);
    return { message: `Draft request created · ${items.length} line${items.length === 1 ? "" : "s"}, ${money(total)}`, data: { requestId: id } };
  });
}
