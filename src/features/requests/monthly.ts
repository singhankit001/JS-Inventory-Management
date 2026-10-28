import type { Repository } from "@/lib/data/provider";
import type { MonthlyRequest, RequestItem } from "@/domain/types";
import type { Segment } from "@/components/charts/svg";
import { REQUEST_STATUS, indexBy, lastPeriods } from "@/features/dashboards/shared";
import { period } from "@/lib/data/seed";
import { periodLabel, signedPct } from "./logic";

const PIPELINE: MonthlyRequest["status"][] = ["draft", "submitted", "revision_requested", "approved", "rejected", "ordered", "fulfilled"];
const SOURCE = { form: "Form", audio: "Audio", video: "Video" } as const;

export const historicalValue = (lines: RequestItem[]) => lines.reduce((s, i) => s + i.historicalAvgQty * i.unitCost, 0);

export async function loadMonthlyRequests(repo: Repository, periodParam?: string) {
  const today = repo.today();
  const [requests, items, centres] = await Promise.all([repo.requests(), repo.requestItems(), repo.centres()]);
  const cmap = indexBy(centres, "id");
  const current = period(today);
  // Last three months plus next month (centres may draft ahead of the window).
  const periods = [period(new Date(today.getFullYear(), today.getMonth() + 1, 1)), ...lastPeriods(today, 3).reverse()];
  const active = periodParam === "all" || periods.includes(periodParam ?? "") ? periodParam! : current;
  const inPeriod = requests.filter((r) => active === "all" || r.period === active);
  const linesOf = new Map<string, RequestItem[]>();
  for (const i of items) linesOf.set(i.requestId, [...(linesOf.get(i.requestId) ?? []), i]);

  const rows = inPeriod
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "") || a.centreId.localeCompare(b.centreId))
    .map((r) => {
      const lines = linesOf.get(r.id) ?? [];
      const hist = historicalValue(lines);
      const centre = cmap.get(r.centreId)?.name ?? r.centreId;
      return {
        id: r.id,
        request: { label: `${centre} · ${periodLabel(r.period)}${r.priority === "emergency" ? " · emergency" : ""}`, href: `/requests/${r.id}` },
        centre, period: periodLabel(r.period), status: REQUEST_STATUS[r.status],
        priority: r.priority === "emergency" ? { label: "Emergency", tone: "red" as const } : { label: "Routine", tone: "neutral" as const },
        source: SOURCE[r.source], lines: lines.length, total: r.total, historical: hist || null, vsHistory: hist ? signedPct(r.total / hist - 1) : null,
        submitted: r.submittedAt ?? null,
      };
    });

  const routine = inPeriod.filter((r) => r.priority === "routine");
  const notStarted = active === "all" ? 0 : centres.filter((c) => !routine.some((r) => r.centreId === c.id)).length;
  const pipeline: Segment[] = [
    ...(notStarted ? [{ label: "Not started", value: notStarted, tone: "neutral" as const, display: String(notStarted) }] : []),
    ...PIPELINE.map((s) => ({ label: REQUEST_STATUS[s].label, value: inPeriod.filter((r) => r.status === s).length, tone: REQUEST_STATUS[s].tone })).filter((s) => s.value > 0).map((s) => ({ ...s, display: String(s.value) })),
  ];
  const withHist = rows.filter((r) => r.historical);
  const hist = withHist.reduce((s, r) => s + r.historical!, 0);

  return {
    active, current,
    periods: [...periods.map((p) => ({ key: p, label: periodLabel(p) })), { key: "all", label: "All" }],
    rows, pipeline,
    totals: {
      value: inPeriod.reduce((s, r) => s + r.total, 0),
      vsHistory: hist ? signedPct(withHist.reduce((s, r) => s + r.total, 0) / hist - 1) : "—",
      awaiting: inPeriod.filter((r) => r.status === "submitted").length,
      revision: inPeriod.filter((r) => r.status === "revision_requested").length,
      emergencies: inPeriod.filter((r) => r.priority === "emergency").length,
    },
  };
}
