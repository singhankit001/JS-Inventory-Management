import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Boxes, CalendarClock, ChartLine, ClipboardCheck, Gauge as GaugeIcon, Landmark, Lightbulb, PackageSearch, Siren, Truck, Users, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadExecutive } from "@/features/dashboards/executive";
import { dateEyebrow, firstName, greeting } from "@/features/dashboards/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveStatus } from "@/components/dashboard/live-status";
import { WelcomeCard, DayTimeline } from "@/components/dashboard/welcome";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { ActivityTimeline, DataList } from "@/components/dashboard/lists";
import { CentreBoard } from "@/components/dashboard/inventory";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge, toneDot } from "@/components/ui/badge";
import { ComparisonBars, Gauge, ProgressRing, TrendIndicator } from "@/components/charts/svg";
import { FlowBars } from "@/components/charts/lazy";
import { TrendCard } from "@/components/charts/trend-card";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Executive dashboard" };

export default async function ExecutiveDashboard({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("dashboard.executive");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadExecutive(repo);
  const today = repo.today();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: centre?.name ?? "All centres" }, { label: "Dashboard" }]}
        title="Dashboard"
        aside={<LiveStatus title={`${d.centreCount} centre${d.centreCount === 1 ? "" : "s"} open`} detail={`${d.welcome.approvals} approvals · ${d.welcome.alerts} critical items`} progress={d.kpis.utilisation} />}
      />

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WelcomeCard
          dateLabel={dateEyebrow(today)}
          greeting={`${greeting()}, ${firstName(session.user.name)}.`}
          actions={<>
            <Link href="/modules/approvals" className={buttonClass("primary", "sm")}><ClipboardCheck />Approvals</Link>
            <Link href="/modules/operations" className={buttonClass("secondary", "sm")}><Landmark />Centres</Link>
          </>}
          footer={<DayTimeline events={d.welcome.events} nowHour={d.welcome.nowHour} label="Today's operational timeline" />}
        >
          <p>
            <b>{d.welcome.approvals} approvals</b> are waiting, <b>{d.welcome.deliveriesToday} deliveries</b> are due today across <b>{d.centreCount} centres</b>.{" "}
            {d.welcome.critical > 0 && <em>{d.welcome.critical} critical approval{d.welcome.critical > 1 ? "s need" : " needs"} a decision.</em>}
          </p>
        </WelcomeCard>

        <Card aria-label="Total inventory valuation">
          <CardHeader icon={Boxes} title="Inventory valuation" action={<Link href="/modules/inventory" className={buttonClass("secondary", "sm")}>Stock ›</Link>} />
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-metric-lg font-medium tracking-[-0.03em] tabular">{d.valuation.total}</span>
            <StatusBadge tone="green">{d.valuation.units} units</StatusBadge>
          </div>
          <p className="mt-1 mb-3 text-label text-ink-3">Budget headroom per month, last 6 months</p>
          <WidgetBoundary name="Budget headroom"><FlowBars data={d.valuation.variance} /></WidgetBoundary>
          <div className="mt-3 flex gap-4 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5"><i className={cn("size-2 rounded-full", toneDot.green)} />Under budget</span>
            <span className="flex items-center gap-1.5"><i className={cn("size-2 rounded-full", toneDot.orange)} />Over budget</span>
          </div>
        </Card>
      </div>

      <MetricGrid className="mt-4">
        <KpiCard variant="primary" icon={Wallet} label="Procurement spend this month" value={d.kpis.spend} spark={d.kpis.spendSpark}
          footnote={<TrendIndicator direction={d.kpis.spendChange >= 0 ? "up" : "down"}>{percent(Math.abs(d.kpis.spendChange))} vs last month (month to date)</TrendIndicator>} />
        <KpiCard variant="secondary" icon={Siren} label="Pending critical approvals" value={d.kpis.critical} href="/modules/approvals"
          footnote={<span>{d.kpis.pending} approvals pending in total</span>} />
        <KpiCard icon={GaugeIcon} label="Budget utilisation" value={percent(d.kpis.utilisation)} spark={d.kpis.utilSpark} sparkTone="green"
          footnote={<TrendIndicator direction="flat" good={d.kpis.utilisation <= 0.9}>Month to date</TrendIndicator>} />
        <KpiCard icon={Truck} label="Open purchase orders" value={d.kpis.openPOs} spark={d.kpis.poSpark} sparkTone="orange"
          footnote={<span>{d.kpis.openPOValue} committed</span>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WidgetBoundary name="Consumption trend">
          <TrendCard icon={ChartLine} title="Monthly consumption" subtitle="Value of stock used, last 12 months"
            views={[
              { key: "value", label: "Value", kind: "trend", data: d.consumption, format: "money", aName: "This month", bName: "Previous month" },
              { key: "units", label: "Units", kind: "column", data: d.consumptionUnits, format: "count", aName: "Units used" },
            ]} />
        </WidgetBoundary>
        <Card aria-label="Centre spending comparison">
          <CardHeader icon={Landmark} title="Centre spend" subtitle="This month · line marks budget" />
          <ComparisonBars rows={d.centreSpend} label="Spend by centre" />
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card aria-label="Supplier performance">
          <CardHeader icon={Users} title="Supplier performance" subtitle="On-time delivery rate" />
          <ul className="grid gap-3">
            {d.suppliers.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <ProgressRing value={s.onTime} size={40} stroke={4} tone={s.onTime >= 0.9 ? "green" : s.onTime >= 0.8 ? "amber" : "red"} label={`${s.name} on-time`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium">{s.name}</p>
                  <p className="text-[12px] text-ink-3">Quality {percent(s.quality)} · {s.lead}d lead</p>
                </div>
                {s.status !== "approved" && <StatusBadge tone="amber">{s.status}</StatusBadge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card aria-label="Critical stock alerts">
          <CardHeader icon={PackageSearch} title="Critical stock" subtitle={`${d.alertsTotal} items at or below half their reorder point`} />
          <DataList rows={d.alerts} empty="No critical stock" label="Critical stock alerts" />
        </Card>
        <Card aria-label="Procurement cycle performance" className="md:col-span-2 xl:col-span-1">
          <CardHeader icon={CalendarClock} title="Procurement cycle" subtitle="Orders delivered on time" />
          <Gauge value={d.cycle.onTime} target={0.92} label="On-time delivery" caption="Target 92%" />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium tabular">{d.cycle.cycleDays.toFixed(1)}d</p><p className="text-[11px] text-ink-3">PO → receipt</p></div>
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium tabular">{d.cycle.receipts}</p><p className="text-[11px] text-ink-3">Receipts</p></div>
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium tabular">{d.cycle.discrepancies}</p><p className="text-[11px] text-ink-3">Discrepancies</p></div>
          </div>
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card aria-label="Management insights">
          <CardHeader icon={Lightbulb} title="Management insights" subtitle="Rule-based from this page's data · AI model arrives in Phase 3" />
          {d.insights.length === 0 ? <p className="text-label text-ink-3">Nothing unusual this month.</p> : (
            <ul className="grid gap-2.5">
              {d.insights.map((i) => (
                <li key={i.id} className="flex gap-3 rounded-tile bg-surface-2 px-4 py-3 text-body text-ink-2">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", toneDot[i.tone])} aria-hidden />{i.text}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card aria-label="Recent operational activity">
          <CardHeader icon={BadgeCheck} title="Recent activity" action={<Link className={buttonClass("ghost", "sm")} href="/governance/audit">Audit log ›</Link>} />
          <ActivityTimeline items={d.activity} />
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="centres-h">
        <h2 id="centres-h" className="mb-3 text-title">Centre inventory</h2>
        <CentreBoard centres={d.centres} categories={(await repo.categories()).map((c) => ({ id: c.id, name: c.name }))} note="Cells are SKUs, coloured by stock against reorder point" />
      </section>
    </>
  );
}
