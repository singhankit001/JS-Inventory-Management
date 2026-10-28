import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, CalendarClock, ChartLine, ClipboardList, ClipboardPen, PackageSearch, ScanBarcode, Siren, Truck, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadCentre, REQUEST_DEADLINE_DAY } from "@/features/dashboards/centre";
import { dateEyebrow, firstName, greeting } from "@/features/dashboards/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveStatus } from "@/components/dashboard/live-status";
import { WelcomeCard, DayTimeline } from "@/components/dashboard/welcome";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { DataList, StatusCard } from "@/components/dashboard/lists";
import { CentreSummaryCard } from "@/components/dashboard/inventory";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass, PlannedAction } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressRing, TrendIndicator } from "@/components/charts/svg";
import { TrendCard } from "@/components/charts/trend-card";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Centre dashboard" };

export default async function CentreDashboard({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("dashboard.centre");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadCentre(repo);
  const today = repo.today();
  const r = d.request;
  const healthy = d.centres.reduce((s, c) => s + c.cells.filter((x) => x.state === "healthy").length, 0);
  const cells = d.centres.reduce((s, c) => s + c.cells.length, 0);
  const pace = d.kpis.budgetUsed - d.kpis.monthElapsed;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: centre?.name ?? d.centreName }, { label: "Dashboard" }]}
        title={centre?.name ?? d.centreName}
        aside={<LiveStatus title={`${percent(cells ? healthy / cells : 0)} of stock healthy`} detail={`${d.kpis.critical} critical · ${d.kpis.deliveriesWeek} deliveries this week`} progress={cells ? healthy / cells : 0} />}
      />

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WelcomeCard
          dateLabel={dateEyebrow(today)}
          greeting={`${greeting()}, ${firstName(session.user.name)}.`}
          actions={<>
            <Link href="/modules/inventory" className={buttonClass("primary", "sm")}><Boxes />Stock</Link>
            <Link href="/modules/requests" className={buttonClass("secondary", "sm")}><ClipboardList />Requests</Link>
          </>}
          footer={<DayTimeline events={d.welcome.events} nowHour={d.welcome.nowHour} label="Today at your centre" />}
        >
          <p>
            <b>{d.welcome.critical} item{d.welcome.critical === 1 ? " is" : "s are"} critical</b> and <b>{d.welcome.deliveriesToday} deliver{d.welcome.deliveriesToday === 1 ? "y is" : "ies are"}</b> due today.{" "}
            {r.overdue ? <em>This month&apos;s request is {-r.daysLeft} day{r.daysLeft === -1 ? "" : "s"} past the {REQUEST_DEADLINE_DAY}th deadline.</em>
              : r.needsAction ? <>Your monthly request is due in <b>{r.daysLeft} day{r.daysLeft === 1 ? "" : "s"}</b>.</>
              : <>This month&apos;s request is <b>{r.status.label.toLowerCase()}</b>.</>}
          </p>
        </WelcomeCard>

        <Card aria-label="Monthly request and deadline">
          <CardHeader icon={ClipboardPen} title="Monthly request" subtitle={`Due on the ${REQUEST_DEADLINE_DAY}th of each month`} action={<StatusBadge tone={r.status.tone} dot>{r.status.label}</StatusBadge>} />
          <div className="flex items-baseline gap-2.5">
            <span className={cn("text-metric-lg font-medium tracking-[-0.03em] tabular", r.overdue && "text-red")}><AnimatedNumber value={Math.abs(r.daysLeft)} /></span>
            <span className="text-label text-ink-2">{r.overdue ? `day${r.daysLeft === -1 ? "" : "s"} overdue` : `day${r.daysLeft === 1 ? "" : "s"} left`}</span>
          </div>
          <p className="mt-1 mb-4 text-label text-ink-3">
            {r.nextCycle ? `This month is in. Next deadline: ${r.due}.` : r.overdue ? `Deadline was ${r.due} — submit as soon as possible.` : `Deadline: ${r.due}.`}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Lines" value={r.items} />
            <StatTile label="Value" value={r.total} />
            <StatTile label="Submitted" value={r.submitted ?? "—"} />
          </div>
          {r.emergencies > 0 && <p className="mt-3 text-[12px] text-ink-3">{r.emergencies} emergency request{r.emergencies > 1 ? "s" : ""} this month · {r.emergencyOpen} awaiting review</p>}
          <div className="mt-4"><PlannedAction label="New monthly request" icon={<ClipboardPen className="size-4" />} /></div>
        </Card>
      </div>

      <MetricGrid className="mt-4">
        <KpiCard variant="primary" icon={Boxes} label="Stock on hand" value={<AnimatedNumber value={d.kpis.stockValue} format="moneyCompact" />}
          footnote={<span>{d.kpis.units} units across {d.kpis.skus} SKUs</span>} />
        <KpiCard variant="secondary" icon={Siren} label="Items to restock" value={<AnimatedNumber value={d.kpis.attention} />} href="/inventory/alerts"
          footnote={<span>{d.kpis.critical} critical · at or below reorder point</span>} />
        <KpiCard icon={Wallet} label="Budget used this month" value={<AnimatedNumber value={d.kpis.budgetUsed} format="percent" />} spark={d.kpis.budgetSpark} sparkTone="green"
          footnote={<TrendIndicator direction={pace > 0 ? "up" : "down"} good={pace <= 0}>{percent(d.kpis.monthElapsed)} of the month gone</TrendIndicator>} />
        <KpiCard icon={Truck} label="Deliveries this week" value={<AnimatedNumber value={d.kpis.deliveriesWeek} />}
          footnote={<span>{d.kpis.overdue ? `${d.kpis.overdue} overdue` : "None overdue"}</span>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WidgetBoundary name="Consumption trend">
          <TrendCard icon={ChartLine} title="Consumption" subtitle="Value of stock used at your centre, last 12 months"
            views={[
              { key: "value", label: "Value", kind: "trend", data: d.consumption, format: "money", aName: "This month", bName: "Previous month" },
              { key: "units", label: "Units", kind: "column", data: d.consumptionUnits, format: "count", aName: "Units used" },
            ]} />
        </WidgetBoundary>
        <div className="grid gap-4">
          {d.centres.map((c) => <CentreSummaryCard key={c.id} centre={c} />)}
        </div>
      </div>

      <div className="stagger mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card aria-label="Items to restock">
          <CardHeader icon={PackageSearch} title="Restock list" subtitle={`${d.restockTotal} item${d.restockTotal === 1 ? "" : "s"} at or below reorder point`} />
          <DataList rows={d.restock} empty="All stock is above reorder point" label="Low and critical items" />
        </Card>
        <Card aria-label="Upcoming deliveries">
          <CardHeader icon={Truck} title="Upcoming deliveries" subtitle="Purchase orders on their way to you" />
          <DataList rows={d.deliveries} empty="No deliveries scheduled" label="Upcoming deliveries" />
        </Card>
        <Card aria-label="Stock count status" className="md:col-span-2 xl:col-span-1">
          <CardHeader icon={ScanBarcode} title="Stock counts" subtitle={`This month · closing count due in ${d.closingDueIn} day${d.closingDueIn === 1 ? "" : "s"}`} />
          <div className="grid gap-2">
            {d.counts.map((c) => <StatusCard key={c.id} label={c.label} status={c.status} tone={c.tone} detail={c.detail} />)}
          </div>
          <div className="mt-4"><PlannedAction label="Start stock count" icon={<ScanBarcode className="size-4" />} /></div>
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card aria-label="Budget used versus allocated">
          <CardHeader icon={Wallet} title="Budget" subtitle={`This month · ${d.budget.daysLeft} days to go`} />
          <div className="flex flex-wrap items-center gap-5">
            <ProgressRing value={d.budget.used} size={128} stroke={11} tone={d.budget.used > 0.9 ? "orange" : "blue"} label="Budget used">
              <span className="grid text-center"><span className="text-title font-medium">{percent(d.budget.used)}</span><span className="text-[11px] font-normal text-ink-3">used</span></span>
            </ProgressRing>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <StatTile label="Allocated" value={d.budget.allocated} />
              <StatTile label="Spent" value={d.budget.spent} />
              <StatTile label="Committed" value={d.budget.committed} />
              <StatTile label="Available" value={d.budget.available} />
            </div>
          </div>
        </Card>
        <Card aria-label="Recent deliveries received">
          <CardHeader icon={CalendarClock} title="Recently received" subtitle="Goods receipts recorded at your centre" />
          <DataList rows={d.receipts} empty="No deliveries received yet this month" label="Recent goods receipts" />
        </Card>
      </div>
    </>
  );
}
