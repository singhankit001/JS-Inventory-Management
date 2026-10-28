import type { Repository } from "@/lib/data/provider";
import type { Centre } from "@/domain/types";
import { avgMonthlyUse, periodLabel } from "@/features/requests/logic";
import { period } from "@/lib/data/seed";
import { relative } from "@/lib/format";
import { JOB_STATUS } from "@/features/analytics/insights";
import { aiDataset, DEMO_TRANSCRIPT, demoProvider } from "./contracts";

/** Everything the intake screen needs: catalogue, per-centre history, the demo draft per centre and recent intake jobs. */
export async function loadIntake(repo: Repository, centres: Centre[]) {
  const today = repo.today();
  const data = await aiDataset(repo);
  const ai = demoProvider(data);
  const uoms = new Map((await repo.uoms()).map((u) => [u.id, u.code]));
  const drafts = await Promise.all(centres.map(async (c) => {
    const use = avgMonthlyUse(data.movements.filter((m) => m.centreId === c.id), today);
    const out = await ai.run("request_intelligence", { centreId: c.id, transcript: DEMO_TRANSCRIPT });
    return {
      centreId: c.id, centreName: c.name, confidence: out.confidence,
      history: Object.fromEntries(data.products.map((p) => [p.id, Math.round(use.get(`${c.id}:${p.id}`) ?? 0)])),
      lines: out.result.lines,
    };
  }));
  return {
    targetPeriod: periodLabel(period(new Date(today.getFullYear(), today.getMonth() + 1, 1))),
    transcript: DEMO_TRANSCRIPT,
    products: data.products.filter((p) => p.status === "active").map((p) => ({ id: p.id, label: `${p.name} (${uoms.get(p.uomId) ?? p.uomId})`, sku: p.sku })),
    drafts,
    jobs: data.aiJobs.filter((j) => j.kind === "audio_request" || j.kind === "video_request").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((j) => ({
      id: j.id, title: `${j.kind === "audio_request" ? "Audio" : "Video"} request · ${data.centres.find((c) => c.id === j.centreId)?.name ?? ""}`, sub: `${j.id.toUpperCase()} · ${relative(j.createdAt, today)}`, badge: JOB_STATUS[j.status],
    })),
  };
}
