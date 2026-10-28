import type { Metadata } from "next";
import { ChartColumn, ListChecks, TriangleAlert } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadDiscrepancies } from "@/features/receiving/discrepancies";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column, type FilterDef } from "@/components/data/data-table";
import { CategoryDistribution, ComparisonBars } from "@/components/charts/svg";
import { ColumnChart } from "@/components/charts/lazy";
import { AnimatedNumber } from "@/components/charts/animated-number";

export const metadata: Metadata = { title: "Delivery discrepancies" };

const columns: Column[] = [
  { key: "date", header: "Received", kind: "date" },
  { key: "po", header: "PO", kind: "link" },
  { key: "supplier", header: "Supplier", kind: "link", hideBelow: "md" },
  { key: "product", header: "Product", kind: "link" },
  { key: "type", header: "Issue", kind: "badge" },
  { key: "centre", header: "Centre", hideBelow: "lg" },
  { key: "receipt", header: "Receipt", kind: "link", hideBelow: "lg" },
  { key: "status", header: "Status", kind: "badge" },
];
const filters: FilterDef[] = [{ key: "status", label: "status" }, { key: "kind", label: "type" }, { key: "supplier", label: "supplier" }];

export default async function DiscrepanciesPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("receiving.read");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadDiscrepancies(repo);
  const t = d.totals;

  return (
    <>
      <ModulePageHeader role={session.role} module="receiving" active="discrepancies" title="Delivery discrepancies"
        description="Shortages, over-deliveries and damage found at the door over the last six months, by line and by supplier." />

      <div className="stagger grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Discrepancy totals, six months">
          <StatTile label="Units short" value={<AnimatedNumber value={t.short} />} />
          <StatTile label="Units over" value={<AnimatedNumber value={t.over} />} />
          <StatTile label="Units damaged" value={<AnimatedNumber value={t.damaged} />} />
          <StatTile label="Open lines" value={<AnimatedNumber value={t.open} />} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card aria-label="Discrepancies by supplier">
            <CardHeader icon={TriangleAlert} title="By supplier" subtitle="Units short, over or damaged · six months" />
            {d.suppliers.length ? <ComparisonBars rows={d.suppliers} label="Discrepancy units by supplier" /> : <EmptyState title="No discrepancies" body="Every delivery matched its order." className="py-8" />}
          </Card>
          <Card aria-label="Trend and resolution">
            <CardHeader icon={ChartColumn} title="Trend" subtitle="Discrepancy units per month" />
            <ColumnChart data={t.trend} name="Units" format="count" height={180} highlight={t.trend.at(-1)?.label} />
            <div className="mt-4">
              <CategoryDistribution label={`${t.open} open and ${t.resolved} resolved discrepancy lines`} segments={[
                { label: "Open — still owed", value: t.open, tone: "orange" },
                { label: "Resolved — made good or accepted", value: t.resolved, tone: "slate" },
              ]} />
            </div>
          </Card>
        </div>

        <Card aria-label="Discrepancy lines">
          <CardHeader icon={ListChecks} title="Lines" subtitle="Open first · short and damaged units stay open until the supplier makes them good" />
          <DataTable columns={columns} rows={d.rows} label="Discrepancy lines" filters={filters} pageSize={12} exportName="delivery-discrepancies"
            emptyTitle="No discrepancies in six months" emptyBody="Every delivery matched what was ordered." />
        </Card>
      </div>
    </>
  );
}
