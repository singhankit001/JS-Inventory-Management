import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Bot, CircleAlert, ListChecks, Plug, TriangleAlert } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadIntegrations } from "@/features/governance/integrations";
import { ModulePageHeader } from "@/components/shell/module-header";
import { ParamDrawer } from "@/components/admin/param-drawer";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PlannedAction } from "@/components/ui/button";
import { WorkflowStepper } from "@/components/ui/stepper";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { ComparisonBars } from "@/components/charts/svg";
import { ColumnChart } from "@/components/charts/lazy";
import { DataTable, type Column, type FilterDef } from "@/components/data/data-table";

export const metadata: Metadata = { title: "Integration & AI job health" };

const columns: Column[] = [
  { key: "job", header: "Job", kind: "link" },
  { key: "kind", header: "Kind" },
  { key: "centre", header: "Centre", kind: "link", hideBelow: "md" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "created", header: "Created", kind: "date", align: "right", hideBelow: "sm" },
];
const filters: FilterDef[] = [{ key: "status", label: "status" }, { key: "kind", label: "kind" }];

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ centre?: string; job?: string }> }) {
  const session = await requirePermission("admin.config");
  const sp = await searchParams;
  const { repo, centre } = scopedRepository(session, sp.centre);
  const d = await loadIntegrations(repo);
  const job = sp.job ? d.jobs[sp.job] : undefined;

  return (
    <>
      <ModulePageHeader role={session.role} module="governance" active="integrations" title="Integration & AI job health"
        description="External connections and the AI processing queue. Nothing external is wired yet, so every integration honestly reads “Not configured”."
        aside={<StatusBadge tone={d.connected ? "green" : "neutral"} dot>{d.connected} of {d.integrations.length} connected</StatusBadge>} />

      <section aria-label="Integrations" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {d.integrations.map((i) => (
          <Card key={i.id} as="article" aria-labelledby={`int-${i.id}`} className="flex flex-col">
            <header className="mb-3 flex items-start justify-between gap-3">
              <h2 id={`int-${i.id}`} className="text-title font-normal tracking-[-0.01em]">{i.name}</h2>
              <StatusBadge tone={i.tone} dot>{i.label}</StatusBadge>
            </header>
            <p className="text-label text-ink-3">Unlocks</p>
            <p className="text-body text-ink-2">{i.unlocks}</p>
            <p className="mt-auto pt-4 text-[12px] text-ink-3">{i.checked}</p>
          </Card>
        ))}
      </section>

      <MetricGrid className="mt-4">
        <KpiCard variant="primary" icon={TriangleAlert} label="Needs review" value={<AnimatedNumber value={d.counts.review} />} footnote={<span>AI drafts waiting for a person to confirm</span>} />
        <KpiCard variant="secondary" icon={CircleAlert} label="Failed" value={<AnimatedNumber value={d.counts.failed} />} footnote={<span>Retry arrives with the AI worker (Phase 2)</span>} />
        <KpiCard icon={Activity} label="Queued or processing" value={<AnimatedNumber value={d.counts.open} />} footnote={<span>{centre?.name ?? "All centres in scope"}</span>} />
        <KpiCard icon={ListChecks} label="Completed" value={<AnimatedNumber value={d.counts.completed} />} footnote={<span>of {d.counts.total} jobs on record</span>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-label="AI job throughput">
          <CardHeader icon={Bot} title="Throughput" subtitle="AI jobs created per day · last 14 days" />
          <ColumnChart data={d.throughput} name="Jobs created" format="count" highlight="Today" />
        </Card>
        <Card aria-label="Jobs by status">
          <CardHeader icon={Plug} title="Jobs by status" subtitle="Every job on record" />
          <ComparisonBars rows={d.byStatus} label="AI jobs by status" />
        </Card>
      </div>

      <Card className="mt-4" aria-label="AI job queue">
        <CardHeader icon={Bot} title="AI job queue" subtitle="Open a job to see where it is in its workflow. Demo preview — AI not connected." />
        <DataTable columns={columns} rows={d.rows} label="AI jobs" filters={filters} pageSize={10} exportName="ai-jobs"
          emptyTitle="Queue is empty" emptyBody="Audio, video and invoice uploads create jobs here." />
      </Card>

      {job && (
        <ParamDrawer param="job" title={`${job.kind} · ${job.id.toUpperCase()}`} description={`${job.centre} · created ${job.created}`}>
          <div className="mb-5 flex flex-wrap gap-1.5"><StatusBadge tone={job.status.tone} dot>{job.status.label}</StatusBadge><StatusBadge>Demo preview — AI not connected</StatusBadge></div>
          <WorkflowStepper steps={job.steps} label={`${job.kind} progress`} />
          <div className="mt-6 grid gap-2">
            <StatTile label="Allowed next by the workflow" value={job.next.length ? job.next.join(" · ") : "None — this job is finished"} />
            {job.centreId && <Link href={`/inventory/centres/${job.centreId}`} className="text-label font-medium text-ink underline-offset-4 hover:underline">{job.centre} inventory ›</Link>}
          </div>
          {job.next.length > 0 && <div className="mt-5"><PlannedAction label="Run job actions" /></div>}
        </ParamDrawer>
      )}
    </>
  );
}
