import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, CalendarDays, ClipboardList, PackageCheck, PackageX, ShieldCheck, Truck, TriangleAlert } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadReceiving } from "@/features/dashboards/receiving";
import { dateEyebrow, firstName, greeting } from "@/features/dashboards/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveStatus } from "@/components/dashboard/live-status";
import { WelcomeCard, DayTimeline } from "@/components/dashboard/welcome";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { DataList } from "@/components/dashboard/lists";
import { ReceiveForm } from "@/components/dashboard/receive-form";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { ComparisonBars, Gauge, TrendIndicator } from "@/components/charts/svg";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Receiving dashboard" };

export default async function ReceivingDashboard({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("dashboard.receiving");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadReceiving(repo);
  const today = repo.today();
  const canRecord = can(session.role, "receiving.record");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: centre?.name ?? d.centreLabel }, { label: "Receiving" }]}
        title="Receiving"
        aside={<LiveStatus title={`${d.welcome.dueToday} due today`} detail={`${d.welcome.week} this week · ${d.welcome.overdue} overdue`} progress={d.accuracy.rate} />}
      />

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WelcomeCard
          dateLabel={dateEyebrow(today)}
          greeting={`${greeting()}, ${firstName(session.user.name)}.`}
          actions={<>
            {canRecord && <a href="#receive" className={buttonClass("primary", "sm")}><PackageCheck />Record receipt</a>}
            <Link href="/modules/receiving" className={buttonClass("secondary", "sm")}><Truck />Receiving module</Link>
          </>}
          footer={<DayTimeline events={d.welcome.events} nowHour={d.welcome.nowHour} label="Today's deliveries and receipts" />}
        >
          <p>
            <b>{d.welcome.dueToday} deliver{d.welcome.dueToday === 1 ? "y is" : "ies are"}</b> expected today and <b>{d.welcome.week}</b> over the next 7 days.{" "}
            {d.welcome.overdue > 0 && <em>{d.welcome.overdue} order{d.welcome.overdue > 1 ? "s are" : " is"} overdue — check with the supplier before closing the day.</em>}
          </p>
        </WelcomeCard>

        <Card aria-label="Receiving accuracy">
          <CardHeader icon={ShieldCheck} title="Receiving accuracy" subtitle="Receipts confirmed without discrepancy · last 30 days" />
          <Gauge value={d.accuracy.rate} target={0.9} label="Clean receipts" caption="Target 90%" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile label="Receipts" value={d.accuracy.receipts} />
            <StatTile label="Discrepancies" value={d.accuracy.discrepancies} />
            <StatTile label="Pending" value={d.accuracy.pending} />
          </div>
        </Card>
      </div>

      <MetricGrid className="mt-4">
        <KpiCard variant="primary" icon={Truck} label="Deliveries expected today" value={<AnimatedNumber value={d.kpis.dueToday} />}
          footnote={<span>{d.welcome.week} due in the next 7 days</span>} />
        <KpiCard variant="secondary" icon={AlarmClock} label="Overdue deliveries" value={<AnimatedNumber value={d.kpis.overdue} />}
          footnote={<span>{d.kpis.overdue ? `Oldest is ${d.kpis.oldestOverdue} day${d.kpis.oldestOverdue === 1 ? "" : "s"} late` : "Nothing overdue"}</span>} />
        <KpiCard icon={ClipboardList} label="Receipts, last 14 days" value={<AnimatedNumber value={d.kpis.receipts14} />} spark={d.kpis.receiptsSpark} sparkTone="green"
          footnote={<TrendIndicator direction={d.kpis.receiptsToday ? "up" : "flat"}>{d.kpis.receiptsToday} recorded today</TrendIndicator>} />
        <KpiCard icon={PackageX} label="Units short or damaged" value={<AnimatedNumber value={d.kpis.issues} />} spark={d.kpis.issuesSpark} sparkTone="orange"
          footnote={<span>{d.kpis.short} short · {d.kpis.damaged} damaged · 30 days</span>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-label="Delivery schedule this week">
          <CardHeader icon={CalendarDays} title="This week's deliveries" subtitle="Issued purchase orders by expected date" action={d.later > 0 ? <StatusBadge>{d.later} later</StatusBadge> : undefined} />
          <ol className="mb-4 grid grid-cols-7 gap-1.5" aria-label="Deliveries per day, next 7 days">
            {d.week.map((day, i) => (
              <li key={day.key} className={cn("rounded-tile px-1 py-2.5 text-center", i === 0 ? "bg-primary-card text-primary-card-ink" : "bg-surface-2")} aria-label={`${day.weekday} ${day.day}: ${day.count} deliveries`}>
                <p className={cn("text-[11px]", i === 0 ? "text-primary-card-ink-2" : "text-ink-3")}>{day.weekday}</p>
                <p className="text-body font-medium tabular">{day.day}</p>
                <p className="mt-1 flex justify-center gap-0.5" aria-hidden>
                  {day.count ? Array.from({ length: Math.min(day.count, 3) }, (_, k) => <i key={k} className="size-1.5 rounded-full bg-blue" />) : <i className="size-1.5 rounded-full bg-line-strong" />}
                </p>
              </li>
            ))}
          </ol>
          <DataList rows={d.schedule} empty="No deliveries expected this week" label="Overdue and upcoming deliveries" />
        </Card>

        <Card id="receive" aria-labelledby="receive-h" className="scroll-mt-28 target:ring-2 target:ring-focus">
          <CardHeader id="receive-h" icon={PackageCheck} title="Record goods receipt" subtitle="Count what arrived against the purchase order" />
          {canRecord ? <ReceiveForm options={d.options} /> : <EmptyState title="Recording needs the receiving.record permission" className="py-8" />}
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card aria-label="Recent goods receipts">
          <CardHeader icon={ClipboardList} title="Recent receipts" subtitle="Latest goods receipts for your centres" />
          <DataList rows={d.receipts} empty="No receipts recorded yet" label="Recent goods receipts" />
        </Card>
        <Card aria-label="Damage and shortage by supplier">
          <CardHeader icon={TriangleAlert} title="Damage & shortage" subtitle="Units short or damaged by supplier · last 30 days" />
          {d.suppliers.length ? <ComparisonBars rows={d.suppliers} label="Units short or damaged by supplier" /> : <EmptyState title="No damage or shortages" body={`${percent(d.accuracy.rate)} of receipts were clean.`} className="py-8" />}
        </Card>
      </div>
    </>
  );
}
