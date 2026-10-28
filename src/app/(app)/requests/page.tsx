import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, GitBranch, Plus, Siren } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadMonthlyRequests } from "@/features/requests/monthly";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { PillGroup } from "@/components/ui/pill-group";
import { CategoryDistribution } from "@/components/charts/svg";
import { DataTable, type Column } from "@/components/data/data-table";
import { moneyCompact } from "@/lib/format";

export const metadata: Metadata = { title: "Monthly requests" };

const columns: Column[] = [
  { key: "request", header: "Request", kind: "link" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "priority", header: "Priority", kind: "badge", hideBelow: "md" },
  { key: "source", header: "Source", hideBelow: "lg" },
  { key: "lines", header: "Lines", kind: "count", align: "right", hideBelow: "md" },
  { key: "total", header: "Total", kind: "money", align: "right" },
  { key: "historical", header: "At history", kind: "money", align: "right", hideBelow: "lg" },
  { key: "vsHistory", header: "vs history", align: "right", hideBelow: "sm" },
  { key: "submitted", header: "Submitted", kind: "date", hideBelow: "lg" },
];

export default async function MonthlyRequestsPage({ searchParams }: { searchParams: Promise<{ centre?: string; period?: string }> }) {
  const session = await requirePermission("requests.read");
  const sp = await searchParams;
  const { repo, centre } = scopedRepository(session, sp.centre);
  const d = await loadMonthlyRequests(repo, sp.period);
  const scoped = (p: string) => `/requests?period=${p}${centre ? `&centre=${centre.id}` : ""}`;
  const label = d.periods.find((p) => p.key === d.active)!.label;

  return (
    <>
      <ModulePageHeader role={session.role} module="requests" active="monthly" title="Monthly requests"
        description={`Every centre's request for the month, from draft to fulfilled${centre ? ` · ${centre.name}` : session.centres.length === 1 ? ` · ${session.centres[0]!.name}` : ""}.`}
        aside={can(session.role, "requests.create") && <>
          <Link href="/requests/emergency" className={buttonClass("secondary", "md")}><Siren />Emergency</Link>
          <Link href="/requests/new" className={buttonClass("primary", "md")}><Plus />New request</Link>
        </>} />

      <div className="stagger grid gap-4">
        <Card aria-labelledby="pipeline-h">
          <CardHeader id="pipeline-h" icon={GitBranch} title={`Pipeline · ${label}`} subtitle={d.active === "all" ? "All periods in view" : "Requests by status; centres without a routine request show as not started"}
            action={<div className="max-w-full overflow-x-auto"><PillGroup variant="segmented" ariaLabel="Request period" activeKey={d.active} items={d.periods.map((p) => ({ key: p.key, label: p.label, href: scoped(p.key) }))} /></div>} />
          {d.pipeline.length ? <CategoryDistribution segments={d.pipeline} label={`Requests by status, ${label}`} /> : <p className="text-label text-ink-3">No requests for {label}.</p>}
          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Requested value" value={moneyCompact(d.totals.value)} />
            <StatTile label="vs historical average" value={d.totals.vsHistory} />
            <StatTile label="Awaiting Head Office" value={`${d.totals.awaiting} · ${d.totals.revision} returned`} />
            <StatTile label="Emergency requests" value={d.totals.emergencies} />
          </div>
        </Card>

        <Card aria-labelledby="requests-h">
          <CardHeader id="requests-h" icon={ClipboardList} title="Requests" subtitle="Total is the proposed value; “at history” prices the same lines at each centre's 3-month average use" />
          <DataTable columns={columns} rows={d.rows} label={`Requests, ${label}`} pageSize={10} exportName={`requests-${d.active}`}
            filters={[{ key: "status", label: "status" }, { key: "centre", label: "centre" }, { key: "priority", label: "priority" }]}
            emptyTitle={`No requests for ${label}`} emptyBody="Centres raise one routine request per month; drafts appear here as soon as they are saved." />
        </Card>
      </div>
    </>
  );
}
