import type { Metadata } from "next";
import { CalendarRange, ChartNoAxesCombined, ChartSpline, Layers, PackageOpen, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { FORECAST_METHOD, loadConsumption } from "@/features/analytics/consumption";
import { ModulePageHeader } from "@/components/shell/module-header";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { TrendCard } from "@/components/charts/trend-card";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data/data-table";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { Breakdown } from "@/components/analytics/breakdown";
import { ForecastChart } from "@/components/analytics/forecast-chart";
import { cn } from "@/lib/cn";
import { money, moneyCompact, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Consumption & forecasting" };

export default async function ConsumptionPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("analytics.read");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadConsumption(repo);
  const k = d.kpis;
  const columns: Column[] = [
    { key: "category", header: "Category", kind: "badge" },
    { key: "last", header: "Last 3 months", kind: "money", align: "right", hideBelow: "md" },
    ...d.nextLabels.map((l, i) => ({ key: `m${i + 1}`, header: l, kind: "money" as const, align: "right" as const, hideBelow: i ? ("sm" as const) : undefined })),
    { key: "band", header: "80% band", align: "right", hideBelow: "lg" },
  ];

  return (
    <>
      <ModulePageHeader role={session.role} module="analytics" active="consumption" title="Consumption & forecasting"
        description={`What centres use, when, and what the next three months should look like · ${centre?.name ?? "all centres in your scope"}.`}
        aside={<StatusBadge tone="blue" dot>Statistical forecast</StatusBadge>} />

      <MetricGrid>
        <KpiCard variant="primary" icon={PackageOpen} label={`Consumed in ${k.lastMonthLabel}`} value={<AnimatedNumber value={k.lastMonth} format="moneyCompact" />} footnote="At catalogue cost" />
        <KpiCard variant="secondary" icon={CalendarRange} label="This month, projected" value={<AnimatedNumber value={k.projected} format="moneyCompact" />} footnote={`${moneyCompact(k.mtd)} so far, scaled by elapsed days`} />
        <KpiCard icon={TrendingUp} label={`Forecast for ${k.nextLabel}`} value={<AnimatedNumber value={k.next} format="moneyCompact" />} footnote={`80% band ${moneyCompact(k.nextLow)}–${moneyCompact(k.nextHigh)}`} />
        <KpiCard icon={ShieldCheck} label="Forecast confidence" value={<AnimatedNumber value={k.confidence} format="percent" />} footnote="1 − band ÷ forecast; higher is tighter" />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WidgetBoundary name="Consumption trend">
          <TrendCard icon={ChartSpline} title="Consumption trend" subtitle="Monthly, last 12 months · current month to date"
            views={[
              { key: "value", label: "Value", kind: "trend", data: d.views.value, format: "money", aName: "Consumed at cost" },
              { key: "units", label: "Units", kind: "column", data: d.views.units, format: "count", aName: "Units consumed" },
            ]} />
        </WidgetBoundary>
        <Card aria-labelledby="breakdown-h">
          <CardHeader id="breakdown-h" icon={Layers} title="Where it goes" subtitle="12-month consumption, top 10" />
          <Breakdown views={d.breakdown} label="Consumption" />
        </Card>
      </div>

      <Card className="mt-4" aria-labelledby="forecast-h">
        <CardHeader id="forecast-h" icon={ChartNoAxesCombined} title="Next three months" subtitle="Statistical forecast; AI Demand Forecasting will replace it"
          action={<StatusBadge tone="neutral"><Sparkles className="size-3" aria-hidden />AI not connected</StatusBadge>} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ForecastChart history={d.forecast.history} points={d.forecast.points} label={`Consumption forecast: ${d.forecast.points.map((p) => `${p.label} ${moneyCompact(p.value)} (${moneyCompact(p.low)} to ${moneyCompact(p.high)})`).join(", ")}`} />
          <div className="grid content-start gap-4">
            <dl className="grid grid-cols-3 gap-2">
              {d.forecast.points.map((p) => (
                <div key={p.label} className="rounded-tile bg-surface-2 px-3 py-2.5">
                  <dt className="text-[11.5px] text-ink-3">{p.label}</dt>
                  <dd className="text-body font-medium tabular">{moneyCompact(p.value)}</dd>
                  <dd className="text-[11px] text-ink-3 tabular">{moneyCompact(p.low)}–{moneyCompact(p.high)}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="mb-2 text-label font-medium">Method — seasonal moving average</p>
              <ol className="grid list-decimal gap-1.5 pl-4 text-label text-ink-2">{FORECAST_METHOD.map((m) => <li key={m}>{m}</li>)}</ol>
              <p className="mt-2 text-[12px] text-ink-3">Band ± {money(d.forecast.spread)}. One year of history means no trend term; growth or new centres are not anticipated.</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card aria-labelledby="season-h">
          <CardHeader id="season-h" icon={CalendarRange} title="Seasonality" subtitle="Each month against the 12-month average (100%)" />
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Seasonal index by month">
            {d.seasonality.map((s) => (
              <li key={s.period} className={cn("rounded-tile px-3 py-2.5", s.index < 0.8 ? "bg-orange-soft" : "bg-surface-2")}>
                <p className="text-[11.5px] text-ink-3">{s.label}{s.partial && " · projected"}</p>
                <p className={cn("text-body font-medium tabular", s.index < 0.8 && "text-orange")}>{percent(s.index)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">Highlighted months run 20%+ below average — summer break and festival closures.</p>
        </Card>
        <Card aria-labelledby="catf-h">
          <CardHeader id="catf-h" icon={Layers} title="Forecast by category" subtitle="Same method per category, at catalogue cost" />
          <DataTable columns={columns} rows={d.byCategory} label="Forecast by category" pageSize={10} exportName="category-forecast" emptyTitle="No consumption to forecast" />
        </Card>
      </div>
    </>
  );
}
