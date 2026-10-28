import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Building2, ChartSpline, Gauge as GaugeIcon, Layers, PackageOpen, Percent, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadAnalyticsOverview } from "@/features/analytics/overview";
import { ModulePageHeader } from "@/components/shell/module-header";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { DataList } from "@/components/dashboard/lists";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { CategoryDistribution, ComparisonBars, Gauge } from "@/components/charts/svg";
import { TrendCard } from "@/components/charts/trend-card";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/data-table";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { count, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics overview" };

const columns: Column[] = [
  { key: "centre", header: "Centre", kind: "link" },
  { key: "city", header: "City", hideBelow: "md" },
  { key: "spent", header: "Spend, 12 months", kind: "money", align: "right" },
  { key: "avg", header: "Average / month", kind: "money", align: "right", hideBelow: "lg" },
  { key: "budget", header: "Budget / month", kind: "money", align: "right", hideBelow: "lg" },
  { key: "use", header: "Of allocation", kind: "badge" },
  { key: "consumed", header: "Consumed, 12 months", kind: "money", align: "right", hideBelow: "sm" },
];

export default async function AnalyticsOverviewPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("analytics.read");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadAnalyticsOverview(repo);
  const k = d.kpis;

  return (
    <>
      <ModulePageHeader role={session.role} module="analytics" active="overview" title="Analytics overview"
        description={`Spend, consumption and centre comparison over the last 12 months · ${centre?.name ?? "all centres in your scope"}.`}
        aside={<Link href="/analytics/reports" className={buttonClass("primary", "sm")}><ChartSpline />Reports & exports</Link>} />

      <MetricGrid>
        <KpiCard variant="primary" icon={Wallet} label="Spend, last 12 months" value={<AnimatedNumber value={k.spend} format="moneyCompact" />} footnote={`Best month: ${k.bestLabel}`} />
        <KpiCard variant="secondary" icon={PackageOpen} label="Consumed, last 12 months" value={<AnimatedNumber value={k.consumed} format="moneyCompact" />} footnote={`${count(k.units)} units at catalogue cost`} />
        <KpiCard icon={Percent} label="Budget used this month" value={<AnimatedNumber value={k.monthUse} format="percent" />} spark={k.spark} sparkTone="blue" footnote="Received goods, month to date" />
        <KpiCard icon={GaugeIcon} label="Spend vs allocation, 12 months" value={<AnimatedNumber value={k.yearUse} format="percent" />} footnote={k.yearUse > 1 ? "Above allocation" : "Within allocation"} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WidgetBoundary name="Spend and consumption">
          <TrendCard icon={ChartSpline} title="Spend & consumption" subtitle="Monthly, last 12 months · current month to date"
            views={[
              { key: "spend", label: "Spend", kind: "trend", data: d.views.spend, format: "money", aName: "Spend (goods received)", bName: "Allocation" },
              { key: "consumption", label: "Consumption", kind: "trend", data: d.views.consumption, format: "money", aName: "Consumed at cost" },
              { key: "units", label: "Units", kind: "column", data: d.views.units, format: "count", aName: "Units consumed" },
            ]} />
        </WidgetBoundary>
        <Card aria-labelledby="onbudget-h" className="flex flex-col">
          <CardHeader id="onbudget-h" icon={GaugeIcon} title="Months within budget" subtitle="Centre-months spent at or under allocation" />
          <div className="flex flex-1 items-center justify-center">
            <Gauge value={d.onBudget.value} target={0.9} label="Centre-months within budget" note="last 11 closed months" caption={`Target 90% · ${d.onBudget.within} of ${d.onBudget.total} centre-months`} />
          </div>
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card aria-labelledby="centres-h">
          <CardHeader id="centres-h" icon={Building2} title="Centre comparison" subtitle="12-month spend · line marks allocation" />
          <ComparisonBars rows={d.centreBars} label="Spend by centre against allocation" />
          <p className="mt-4 text-[12px] text-ink-3">Shown per centre: enrolment is not on the centre record yet, so per-child figures are not available.</p>
        </Card>
        <Card aria-labelledby="mix-h">
          <CardHeader id="mix-h" icon={Layers} title="Category mix" subtitle="Consumption at catalogue cost, 12 months" />
          <CategoryDistribution segments={d.categories} label="Consumption by category" />
        </Card>
        <Card aria-labelledby="top-h" className="md:col-span-2 xl:col-span-1">
          <CardHeader id="top-h" icon={ShoppingBag} title="Most consumed" subtitle="By value, 12 months" action={<Link href="/analytics/consumption" className={buttonClass("ghost", "sm")}>Forecast ›</Link>} />
          <DataList rows={d.topProducts.map((r) => ({ ...r, icon: Boxes }))} empty="No consumption recorded" label="Most consumed products" />
        </Card>
      </div>

      <Card className="mt-4" aria-labelledby="table-h">
        <CardHeader id="table-h" icon={Building2} title="Centres" subtitle={`Highest share of allocation first · ${percent(k.yearUse)} across your scope`}
          action={<Link href="/analytics/insights" className={buttonClass("ghost", "sm")}><Sparkles />AI insights</Link>} />
        <DataTable columns={columns} rows={d.centreTable} label="Centre comparison" pageSize={15} exportName="centre-comparison" filters={[{ key: "city", label: "city" }, { key: "use", label: "allocation" }]} emptyTitle="No centres in your scope" />
      </Card>
    </>
  );
}
