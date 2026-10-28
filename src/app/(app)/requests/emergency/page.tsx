import type { Metadata } from "next";
import Link from "next/link";
import { History, Siren, TimerReset } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadEmergencies } from "@/features/requests/emergency";
import { centreProducts } from "@/features/requests/new";
import { EMERGENCY_SLA_HOURS, ageLabel } from "@/features/requests/logic";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column } from "@/components/data/data-table";
import { EmergencyDialog } from "@/components/requests/emergency-dialog";
import { cn } from "@/lib/cn";
import { count, money } from "@/lib/format";

export const metadata: Metadata = { title: "Emergency requests" };

const columns: Column[] = [
  { key: "request", header: "Request", kind: "link" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "lines", header: "Lines", kind: "count", align: "right", hideBelow: "sm" },
  { key: "total", header: "Total", kind: "money", align: "right" },
  { key: "raised", header: "Raised", kind: "date", hideBelow: "md" },
];

export default async function EmergencyRequestsPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("requests.read");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadEmergencies(repo);
  const canRaise = can(session.role, "requests.create") && session.centres.length > 0;
  // shortcut: stock hints come from the first assigned centre; centre leaders hold one centre today.
  const catalogue = canRaise ? await centreProducts(repo, (centre ?? session.centres[0]!).id) : undefined;

  return (
    <>
      <ModulePageHeader role={session.role} module="requests" active="emergency" title="Emergency requests"
        description={`Out-of-cycle requests skip the monthly window and go to Head Office as critical. Target: a decision within ${EMERGENCY_SLA_HOURS} hours.`}
        aside={canRaise && catalogue && (
          <EmergencyDialog centres={session.centres.map((c) => ({ id: c.id, name: c.name }))}
            products={catalogue.products.map((p) => ({ id: p.id, label: p.name, hint: `${count(p.onHand)} on hand`, unitCost: p.unitCost }))} />
        )} />

      <div className="stagger grid gap-4">
        <Card aria-labelledby="open-h">
          <CardHeader id="open-h" icon={TimerReset} title="Open emergencies" subtitle={`${d.open.length} open · ${d.breached} past the ${EMERGENCY_SLA_HOURS} h decision target`} />
          {d.open.length === 0 ? (
            <EmptyState icon={Siren} title="No open emergencies" body="Raised emergencies stay here until Purchasing orders them." className="py-8" />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {d.open.map((o) => (
                <li key={o.id}>
                  <Link href={o.href} className="block h-full rounded-tile bg-surface-2 p-4 ring-1 ring-line transition-colors hover:bg-surface-3/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-body font-medium">{o.centre}</p>
                        <p className="text-[12px] text-ink-3">Raised {o.raised} · {money(o.total)}</p>
                      </div>
                      <StatusBadge tone={o.breached ? "red" : o.status.tone} dot>{o.breached ? "SLA breached" : o.status.label}</StatusBadge>
                    </div>
                    {o.reason && <p className="mt-3 line-clamp-2 text-label text-ink-2">“{o.reason}”</p>}
                    <p className="mt-2 line-clamp-2 text-[12px] text-ink-3">{o.lines.join(" · ")}</p>
                    <div className="mt-3">
                      <div className="flex justify-between text-[11.5px] text-ink-3 tabular">
                        <span>{o.waitingDecision ? "Waiting for a decision" : "Decided · awaiting order"}</span>
                        <span className={cn(o.breached && "font-medium text-red")}>{ageLabel(o.hours)}{o.waitingDecision && ` of ${EMERGENCY_SLA_HOURS} h`}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={o.waitingDecision ? `${o.hours} of ${EMERGENCY_SLA_HOURS} hours used${o.breached ? ", target breached" : ""}` : "Decision made"}>
                        <div className={cn("bar-grow h-full rounded-full", o.breached ? "bg-red" : o.waitingDecision ? "bg-orange" : "bg-green")} style={{ width: `${o.sla * 100}%` }} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="em-history-h">
          <CardHeader id="em-history-h" icon={History} title="All emergency requests" subtitle="Every out-of-cycle request in your centres" />
          <DataTable columns={columns} rows={d.rows} label="Emergency requests" filters={[{ key: "status", label: "status" }, { key: "centre", label: "centre" }]} exportName="emergency-requests"
            emptyTitle="No emergency requests" emptyBody="Use “Raise emergency request” when something cannot wait for the monthly cycle." />
        </Card>
      </div>
    </>
  );
}
