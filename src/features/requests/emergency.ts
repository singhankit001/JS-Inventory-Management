import type { Repository } from "@/lib/data/provider";
import { REQUEST_STATUS, indexBy } from "@/features/dashboards/shared";
import { shortDate, time } from "@/lib/format";
import { EMERGENCY_SLA_HOURS, auditNote, hoursSince, periodLabel, requestEvents } from "./logic";

const OPEN = ["submitted", "revision_requested", "approved"];

export async function loadEmergencies(repo: Repository, now = new Date()) {
  const [requests, items, products, centres, audit] = await Promise.all([repo.requests(), repo.requestItems(), repo.products(), repo.centres(), repo.audit()]);
  const pmap = indexBy(products, "id"), cmap = indexBy(centres, "id");
  const emergencies = requests.filter((r) => r.priority === "emergency").sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  const linesOf = (id: string) => items.filter((i) => i.requestId === id);

  const open = emergencies.filter((r) => OPEN.includes(r.status)).map((r) => {
    const hours = r.submittedAt ? hoursSince(r.submittedAt, now) : 0;
    const centre = cmap.get(r.centreId)?.name ?? r.centreId;
    // The SLA clock runs until Head Office decides; approved emergencies wait on Purchasing instead.
    const waitingDecision = r.status === "submitted";
    return {
      id: r.id, centre, centreId: r.centreId, href: `/requests/${r.id}`, status: REQUEST_STATUS[r.status], total: r.total, hours,
      sla: waitingDecision ? Math.min(1, hours / EMERGENCY_SLA_HOURS) : 1, breached: waitingDecision && hours > EMERGENCY_SLA_HOURS, waitingDecision,
      raised: r.submittedAt ? `${shortDate(r.submittedAt)}, ${time(r.submittedAt)}` : "—",
      lines: linesOf(r.id).map((i) => `${pmap.get(i.productId)?.name ?? i.productId} × ${i.proposedQty}`),
      reason: requestEvents(audit, r, centre).map((e) => auditNote(e.subject)).findLast(Boolean),
    };
  }).sort((a, b) => Number(b.breached) - Number(a.breached) || Number(b.waitingDecision) - Number(a.waitingDecision) || b.hours - a.hours);

  const rows = emergencies.map((r) => ({
    id: r.id, request: { label: `${cmap.get(r.centreId)?.name ?? r.centreId} · ${periodLabel(r.period)}`, href: `/requests/${r.id}` },
    centre: cmap.get(r.centreId)?.name ?? r.centreId, status: REQUEST_STATUS[r.status], lines: linesOf(r.id).length, total: r.total, raised: r.submittedAt ?? null,
  }));

  return { open, rows, breached: open.filter((o) => o.breached).length };
}
