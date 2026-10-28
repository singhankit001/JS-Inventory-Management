import type { Metadata } from "next";
import { CalendarDays, History, ScrollText, Users } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { indexBy } from "@/features/dashboards/shared";
import { time } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardHeader } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { DataTable, type Column, type FilterDef, type Row } from "@/components/data/data-table";

export const metadata: Metadata = { title: "Audit log" };

const columns: Column[] = [
  { key: "when", header: "When", kind: "date" },
  { key: "time", header: "Time", hideBelow: "sm" },
  { key: "actor", header: "Actor" },
  { key: "action", header: "Action" },
  { key: "subject", header: "Subject", hideBelow: "md" },
  { key: "centre", header: "Centre", hideBelow: "lg" },
];
const filters: FilterDef[] = [{ key: "action", label: "action" }, { key: "centre", label: "centre" }, { key: "actor", label: "actor" }];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("audit.read");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const [events, users, centres] = await Promise.all([repo.audit(), repo.users(), repo.centres()]);
  const umap = indexBy(users, "id"), cmap = indexBy(centres, "id");
  const today = repo.today();
  const dayStart = (offset: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset).getTime();

  const sorted = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const week = sorted.filter((e) => new Date(e.occurredAt).getTime() >= dayStart(6));
  const todayCount = sorted.filter((e) => new Date(e.occurredAt).getTime() >= dayStart(0)).length;
  const perDay = Array.from({ length: 7 }, (_, i) => week.filter((e) => { const t = new Date(e.occurredAt).getTime(); return t >= dayStart(6 - i) && t < dayStart(5 - i); }).length);
  const actors = new Set(week.map((e) => e.actorId)).size;

  const rows: Row[] = sorted.map((e) => ({
    id: e.id, when: e.occurredAt, time: time(e.occurredAt), actor: umap.get(e.actorId)?.name ?? "Unknown user", action: e.action, subject: e.subject,
    centre: e.centreId ? cmap.get(e.centreId)?.name ?? e.centreId : "Organisation",
  }));

  return (
    <>
      <PageHeader crumbs={[{ label: "Jumpstart", href: "/" }, { label: "Governance", href: "/modules/governance" }, { label: "Audit log" }]} title="Audit log" />

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard variant="primary" icon={CalendarDays} label="Events today" value={<AnimatedNumber value={todayCount} />} footnote={<span>{centre?.name ?? "All centres in scope"}</span>} />
        <KpiCard variant="secondary" icon={History} label="Events this week" value={<AnimatedNumber value={week.length} />} spark={perDay} footnote={<span>Last 7 days, including today</span>} />
        <KpiCard icon={Users} label="Distinct actors" value={<AnimatedNumber value={actors} />} footnote={<span>People who changed something this week</span>} />
      </div>

      <Card className="mt-4" aria-label="Audit events">
        <CardHeader icon={ScrollText} title="Events" subtitle="Every recorded state change, newest first" />
        <DataTable columns={columns} rows={rows} label="Audit events" filters={filters} pageSize={12} exportName="audit-log" emptyTitle="No audit events in scope" emptyBody="State changes in your centres appear here as they happen." />
      </Card>
    </>
  );
}
