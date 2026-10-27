import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Banknote, CalendarClock, CalendarRange, ChartColumn, FileCheck2, Hourglass, Landmark, ReceiptIndianRupee, Scale, TriangleAlert, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadFinance } from "@/features/dashboards/finance";
import { dateEyebrow, firstName, greeting } from "@/features/dashboards/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveStatus } from "@/components/dashboard/live-status";
import { WelcomeCard } from "@/components/dashboard/welcome";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { DataList } from "@/components/dashboard/lists";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { PlannedAction, buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { CategoryDistribution, ComparisonBars, TrendIndicator } from "@/components/charts/svg";
import { TrendCard } from "@/components/charts/trend-card";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { DataTable, type Column } from "@/components/data/data-table";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { percent } from "@/lib/format";

export const metadata: Metadata = { title: "Finance dashboard" };

const invoiceColumns: Column[] = [
  { key: "number", header: "Invoice" },
  { key: "supplier", header: "Supplier", hideBelow: "sm" },
  { key: "centre", header: "Centre", hideBelow: "lg" },
  { key: "po", header: "PO", hideBelow: "lg" },
  { key: "amount", header: "Amount", kind: "money", align: "right" },
  { key: "due", header: "Due", kind: "date", hideBelow: "md" },
  { key: "ageing", header: "Ageing", kind: "badge", hideBelow: "md" },
  { key: "match", header: "3-way match", kind: "badge", hideBelow: "sm" },
  { key: "status", header: "Status", kind: "badge" },
];

export default async function FinanceDashboard({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("dashboard.finance");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadFinance(repo);
  const today = repo.today();
  const canManage = can(session.role, "finance.manage");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: centre?.name ?? "All centres" }, { label: "Finance" }]}
        title="Finance"
        aside={<LiveStatus title={`${d.welcome.outstanding} payable`} detail={`${d.kpis.openCount} open invoices · ${percent(d.kpis.matchRate)} matched`} progress={d.kpis.matchRate} />}
      />

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WelcomeCard
          dateLabel={dateEyebrow(today)}
          greeting={`${greeting()}, ${firstName(session.user.name)}.`}
          actions={<>
            <Link href="/modules/finance#invoices" className={buttonClass("primary", "sm")}><FileCheck2 />Invoices</Link>
            <Link href="/modules/finance#payments" className={buttonClass("secondary", "sm")}><Banknote />Payments</Link>
          </>}
          footer={
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Due this week" value={d.welcome.dueWeek} />
              <StatTile label="Overdue invoices" value={d.welcome.overdueCount} />
              <StatTile label="On query" value={d.kpis.onQuery} />
              <StatTile label="Matched" value={percent(d.kpis.matchRate)} />
            </div>
          }
        >
          <p>
            <b>{d.welcome.outstanding}</b> is outstanding to suppliers, with <b>{d.welcome.dueWeek} due this week</b> across {d.welcome.dueWeekCount} invoice{d.welcome.dueWeekCount === 1 ? "" : "s"}.{" "}
            {d.welcome.exceptions > 0 && <em>{d.welcome.exceptions} open invoice{d.welcome.exceptions > 1 ? "s fail" : " fails"} three-way match.</em>}
          </p>
        </WelcomeCard>

        <Card aria-label="Payables ageing">
          <CardHeader icon={Hourglass} title="Payables ageing" action={<Link href="/modules/finance#reconciliation" className={buttonClass("secondary", "sm")}>Reconcile ›</Link>} />
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-metric-lg font-medium tracking-[-0.03em]"><AnimatedNumber value={d.kpis.outstanding} format="moneyCompact" /></span>
            <StatusBadge tone={d.kpis.overdue ? "orange" : "green"}>{d.kpis.overdue ? `${d.kpis.overdueCount} overdue` : "Nothing overdue"}</StatusBadge>
          </div>
          <p className="mt-1 mb-4 text-label text-ink-3">Unpaid invoices by days past due date</p>
          <ComparisonBars rows={d.ageing} label="Outstanding payables by ageing bucket" />
        </Card>
      </div>

      <MetricGrid className="mt-4">
        <KpiCard variant="primary" icon={Wallet} label="Payables outstanding" value={<AnimatedNumber value={d.kpis.outstanding} format="moneyCompact" />}
          footnote={<span>{d.kpis.openCount} unpaid invoices</span>} />
        <KpiCard variant="secondary" icon={TriangleAlert} label="Overdue" value={<AnimatedNumber value={d.kpis.overdue} format="moneyCompact" />} href="/modules/finance#invoices"
          footnote={<span>{d.kpis.overdueCount} invoice{d.kpis.overdueCount === 1 ? "" : "s"} past due</span>} />
        <KpiCard icon={Banknote} label="Paid this month" value={<AnimatedNumber value={d.kpis.paidMonth} format="moneyCompact" />} spark={d.kpis.paidSpark} sparkTone="green"
          footnote={<TrendIndicator direction={d.kpis.paidChange >= 0 ? "up" : "down"}>{percent(Math.abs(d.kpis.paidChange))} vs last month (month to date)</TrendIndicator>} />
        <KpiCard icon={Scale} label="Match exceptions" value={<AnimatedNumber value={d.kpis.exceptions} />}
          footnote={<TrendIndicator direction="flat" good={d.kpis.matchRate >= 0.8}>{percent(d.kpis.matchRate)} of invoices matched</TrendIndicator>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WidgetBoundary name="Payments">
          <TrendCard icon={ChartColumn} title="Payments" subtitle="Paid to suppliers, last 6 months"
            views={[
              { key: "value", label: "Value", kind: "column", data: d.paymentViews.value, format: "money", aName: "Paid" },
              { key: "count", label: "Count", kind: "column", data: d.paymentViews.count, format: "count", aName: "Payments" },
            ]} />
        </WidgetBoundary>
        <Card aria-label="Recent payments">
          <CardHeader icon={BadgeCheck} title="Recent payments" action={<Link href="/modules/finance#payments" className={buttonClass("ghost", "sm")}>All ›</Link>} />
          <DataList rows={d.recentPayments} empty="No payments recorded" label="Recent payments" />
          {canManage && <div className="mt-4"><PlannedAction label="Record payment" icon={<Banknote className="size-4" />} /></div>}
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card aria-label="Three-way match status">
          <CardHeader icon={FileCheck2} title="Three-way match" subtitle="Invoice vs PO vs goods receipt" />
          {d.match.length ? <CategoryDistribution segments={d.match} label="Invoices by three-way match status" /> : <p className="text-label text-ink-3">No invoices.</p>}
        </Card>
        <Card aria-label="Invoices due this week">
          <CardHeader icon={CalendarClock} title="Due this week" subtitle={`${d.welcome.dueWeekCount} invoice${d.welcome.dueWeekCount === 1 ? "" : "s"} · ${d.welcome.dueWeek}`} />
          <DataList rows={d.dueThisWeek.slice(0, 6).map((r) => ({ ...r, icon: ReceiptIndianRupee }))} empty="Nothing due in the next 7 days" label="Invoices due this week" />
        </Card>
        <Card aria-label="Budget variance by centre" className="md:col-span-2 xl:col-span-1">
          <CardHeader icon={Landmark} title="Budget variance" subtitle="Spent + committed this month · line marks budget" />
          <ComparisonBars rows={d.variance} label="Budget variance by centre" />
        </Card>
      </div>

      <Card className="mt-4" aria-labelledby="invoices-h">
        <CardHeader id="invoices-h" icon={CalendarRange} title="Invoices" subtitle="Earliest due first · filter by status, search by supplier, centre or PO"
          action={canManage ? <PlannedAction label="Approve invoice" /> : undefined} />
        <DataTable columns={invoiceColumns} rows={d.invoices} label="Invoices" filter={{ key: "status", label: "status" }} exportName="invoices" emptyTitle="No invoices" />
      </Card>
    </>
  );
}
