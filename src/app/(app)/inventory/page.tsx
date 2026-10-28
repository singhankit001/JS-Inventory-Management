import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Boxes, ChartLine, ClipboardCheck, HeartPulse, Landmark, Layers, PackageMinus, TrendingUp } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadInventoryOverview } from "@/features/inventory/overview";
import { ModulePageHeader } from "@/components/shell/module-header";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { DataList } from "@/components/dashboard/lists";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { CategoryDistribution, TrendIndicator } from "@/components/charts/svg";
import { TrendCard } from "@/components/charts/trend-card";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { count, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Inventory overview" };

export default async function InventoryOverview({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("inventory.read");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadInventoryOverview(repo);
  const below = d.health.low + d.health.critical;

  return (
    <>
      <ModulePageHeader role={session.role} module="inventory" active="overview" title="Inventory overview"
        description={`${centre?.name ?? (d.centreCount === 1 ? "Your centre" : `${d.centreCount} centres`)} · stock valued at current unit cost`}
        aside={<>
          <Link href="/inventory/alerts" className={buttonClass("secondary", "sm")}><BellRing />Alerts</Link>
          <Link href="/inventory/counts" className={buttonClass("primary", "sm")}><ClipboardCheck />Stock counts</Link>
        </>} />

      <MetricGrid>
        <KpiCard variant="primary" icon={Boxes} label="Network stock value" value={<AnimatedNumber value={d.totalValue} format="moneyCompact" />} spark={d.valueSpark}
          footnote={<TrendIndicator direction={d.valueChange >= 0 ? "up" : "down"}>{percent(Math.abs(d.valueChange))} vs last month-end</TrendIndicator>} />
        <KpiCard variant="secondary" icon={Layers} label="Units on hand" value={<AnimatedNumber value={d.units} />} spark={d.unitsSpark}
          footnote={<span>{count(d.skuPairs)} SKU-centre lines · spark = units used per month</span>} />
        <KpiCard icon={HeartPulse} label="Healthy SKUs" value={<AnimatedNumber value={d.healthyRatio} format="percent" />}
          footnote={<span>Above reorder point at their centre</span>} />
        <KpiCard icon={PackageMinus} label="At or below reorder" value={<AnimatedNumber value={below} />} href="/inventory/alerts"
          footnote={<TrendIndicator direction="flat" good={d.health.critical === 0}>{d.health.critical} critical · view alerts</TrendIndicator>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WidgetBoundary name="Stock trend">
          <TrendCard icon={ChartLine} title="Stock value & consumption" subtitle="Last 12 months · value at current unit cost" views={d.trend} />
        </WidgetBoundary>
        <Card aria-label="Stock value by category">
          <CardHeader icon={Landmark} title="Where the value sits" subtitle="Stock value by category" />
          <CategoryDistribution segments={d.categories} label="Stock value by category" />
          <p className="mt-6 mb-2 text-label text-ink-3">SKU health across {count(d.skuPairs)} lines</p>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Healthy" value={count(d.health.healthy)} />
            <StatTile label="Low" value={count(d.health.low)} />
            <StatTile label="Critical" value={count(d.health.critical)} />
          </div>
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-2">
        <Card aria-label="Centres ranked by stock value">
          <CardHeader icon={Landmark} title="Centres by stock value" subtitle="Share of SKUs above reorder point" action={<Link href="/inventory/centres" className={buttonClass("ghost", "sm")}>All centres ›</Link>} />
          <DataList rows={d.centres} empty="No centres in your scope" label="Centres ranked by stock value" />
        </Card>
        <Card aria-label="Top movers">
          <CardHeader icon={TrendingUp} title="Top movers" subtitle="Highest consumption value, last 30 days · change vs the 30 before" action={<Link href="/inventory/movements" className={buttonClass("ghost", "sm")}>Ledger ›</Link>} />
          <DataList rows={d.movers} empty="No consumption in the last 30 days" label="Top moving products" />
        </Card>
      </div>
    </>
  );
}
