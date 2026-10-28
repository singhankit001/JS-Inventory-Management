import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeIndianRupee, ChartLine, ClipboardCheck, FileWarning, GitCompareArrows, Inbox, Landmark, PackageX, Truck, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadHeadOffice } from "@/features/dashboards/head-office";
import { dateEyebrow, firstName, greeting } from "@/features/dashboards/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveStatus } from "@/components/dashboard/live-status";
import { WelcomeCard, DayTimeline } from "@/components/dashboard/welcome";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { DataList } from "@/components/dashboard/lists";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge, toneDot } from "@/components/ui/badge";
import { PillGroup } from "@/components/ui/pill-group";
import { CategoryDistribution, ComparisonBars, TrendIndicator } from "@/components/charts/svg";
import { TrendCard } from "@/components/charts/trend-card";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { DataTable, type Column } from "@/components/data/data-table";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Head Office dashboard" };

const queueColumns: Column[] = [
  { key: "item", header: "Item" },
  { key: "type", header: "Type", hideBelow: "md" },
  { key: "centre", header: "Centre", hideBelow: "sm" },
  { key: "amount", header: "Value", kind: "money", align: "right" },
  { key: "vsHistory", header: "vs history", align: "right", hideBelow: "lg" },
  { key: "submitted", header: "Submitted", kind: "date", hideBelow: "md" },
  { key: "priority", header: "Priority", kind: "badge", hideBelow: "lg" },
  { key: "status", header: "Status", kind: "badge" },
];

export default async function HeadOfficeDashboard({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("dashboard.head_office");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadHeadOffice(repo);
  const today = repo.today();
  const canApprove = can(session.role, "requests.approve");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: centre?.name ?? "All centres" }, { label: "Head Office" }]}
        title="Head Office"
        aside={<LiveStatus title={`${d.kpis.queueCount} in the approval queue`} detail={`${d.kpis.critical} urgent · ${percent(d.kpis.utilisation)} of budget used`} progress={d.kpis.utilisation} />}
      >
        {session.centres.length > 1 && (
          <div className="max-w-full overflow-x-auto">
            <PillGroup variant="nav" ariaLabel="Filter dashboard by centre" activeKey={centre?.id ?? "all"}
              items={[{ key: "all", label: "All centres", href: "/dashboards/head-office" }, ...session.centres.map((c) => ({ key: c.id, label: c.name, href: `/dashboards/head-office?centre=${c.id}` }))]} />
          </div>
        )}
      </PageHeader>

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WelcomeCard
          dateLabel={dateEyebrow(today)}
          greeting={`${greeting()}, ${firstName(session.user.name)}.`}
          actions={<>
            <Link href="/approvals" className={buttonClass("primary", "sm")}><ClipboardCheck />Approval queue</Link>
            <Link href="/approvals/budgets" className={buttonClass("secondary", "sm")}><Wallet />Budgets</Link>
          </>}
          footer={<DayTimeline events={d.welcome.events} nowHour={d.welcome.nowHour} label="Today's requests, deliveries and price submissions" />}
        >
          <p>
            <b>{d.welcome.submitted} request{d.welcome.submitted === 1 ? "" : "s"}</b> {d.welcome.submitted === 1 ? "is" : "are"} waiting for review, <b>{d.welcome.revision} returned</b> for revision and <b>{d.welcome.poAuth} purchase order{d.welcome.poAuth === 1 ? "" : "s"}</b> need{d.welcome.poAuth === 1 ? "s" : ""} authorisation.{" "}
            {d.welcome.emergency > 0 && <em>{d.welcome.emergency} emergency request{d.welcome.emergency > 1 ? "s are" : " is"} open.</em>}
          </p>
        </WelcomeCard>

        <Card aria-label="Requests awaiting review versus history">
          <CardHeader icon={Inbox} title="Request review" action={<Link href="/requests" className={buttonClass("secondary", "sm")}>Requests ›</Link>} />
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-metric-lg font-medium tracking-[-0.03em]"><AnimatedNumber value={d.review.value} format="moneyCompact" /></span>
            <StatusBadge tone={d.review.vsHistory > 0.15 ? "orange" : "green"}>{d.review.vsHistory >= 0 ? "+" : "−"}{percent(Math.abs(d.review.vsHistory))} vs history</StatusBadge>
          </div>
          <p className="mt-1 mb-4 text-label text-ink-3">Submitted value · line marks the historical-average cost</p>
          {d.review.rows.length ? <ComparisonBars rows={d.review.rows} label="Request value versus historical average by centre" /> : <p className="text-label text-ink-3">No requests in review.</p>}
        </Card>
      </div>

      <MetricGrid className="mt-4">
        <KpiCard variant="primary" icon={ClipboardCheck} label="Value awaiting decision" value={<AnimatedNumber value={d.kpis.pendingValue} format="moneyCompact" />}
          footnote={<span>{d.kpis.queueCount} items · {d.kpis.critical} urgent</span>} />
        <KpiCard variant="secondary" icon={Wallet} label="Budget used incl. commitments" value={<AnimatedNumber value={d.kpis.utilisation} format="percent" />} spark={d.kpis.utilSpark} href="/approvals/budgets"
          footnote={<span>{d.kpis.headroom} headroom this month</span>} />
        <KpiCard icon={Truck} label="Open purchase orders" value={<AnimatedNumber value={d.kpis.openPOs} />}
          footnote={<TrendIndicator direction={d.kpis.overduePOs ? "up" : "flat"} good={!d.kpis.overduePOs}>{d.kpis.overduePOs} overdue · {d.kpis.openPOValue}</TrendIndicator>} />
        <KpiCard icon={AlertTriangle} label="Open exceptions" value={<AnimatedNumber value={d.kpis.exceptions} />}
          footnote={<span>{d.kpis.discrepancies} receiving · {d.kpis.invoiceExceptions} invoice</span>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WidgetBoundary name="Spend against budget">
          <TrendCard icon={ChartLine} title="Spend against budget" subtitle="Centres in view, last 6 months · current month to date"
            views={[{ key: "spend", label: "Spend", kind: "trend", data: d.spendTrend, format: "money", aName: "Spent", bName: "Allocated" }]} />
        </WidgetBoundary>
        <Card aria-label="Budget allocation by centre">
          <CardHeader icon={Landmark} title="Budget by centre" subtitle="This month · spent and committed of allocation" />
          <ul className="grid gap-4">
            {d.budgets.map((b, i) => (
              <li key={b.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <p className="truncate text-label font-medium">{b.name}</p>
                  <span className={cn("text-label font-medium tabular", b.over && "text-orange")}>{b.left}</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${b.name}: ${percent(b.spentPct)} spent, ${percent(b.committedPct)} committed`}>
                  <div className="bar-grow h-full bg-blue" style={{ width: `${Math.min(1, b.spentPct) * 100}%`, animationDelay: `${i * 70}ms` }} />
                  <div className="bar-grow h-full bg-blue/35" style={{ width: `${Math.min(1 - Math.min(1, b.spentPct), b.committedPct) * 100}%`, animationDelay: `${i * 70 + 120}ms` }} />
                </div>
                <p className="mt-1 text-[11.5px] text-ink-3 tabular">{b.detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-4 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5"><i className={cn("size-2 rounded-full", toneDot.blue)} />Spent</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-blue/35" />Committed</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-surface-3 ring-1 ring-line" />Headroom</span>
          </div>
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card aria-label="Price and supplier approvals">
          <CardHeader icon={BadgeIndianRupee} title="Price & supplier approvals" subtitle="Quoted price vs current catalogue cost" action={<Link href="/procurement/compare" className={buttonClass("ghost", "sm")}>Compare ›</Link>} />
          <DataList rows={d.priceApprovals} empty="No prices or suppliers awaiting approval" label="Price and supplier approvals" />
        </Card>
        <Card aria-label="Purchase order pipeline">
          <CardHeader icon={GitCompareArrows} title="PO pipeline" subtitle="Orders by stage · count and value" action={<Link href="/procurement/orders" className={buttonClass("ghost", "sm")}>Orders ›</Link>} />
          {d.pipeline.length ? <CategoryDistribution segments={d.pipeline} label="Purchase orders by stage" /> : <p className="text-label text-ink-3">No purchase orders.</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <StatTile label="Open orders" value={d.poTotals.open} />
            <StatTile label="Paid above quote · 30d" value={d.poTotals.variance} />
          </div>
        </Card>
        <Card aria-label="Receiving and invoice exceptions" className="md:col-span-2 xl:col-span-1">
          <CardHeader icon={FileWarning} title="Exceptions" subtitle="Receiving discrepancies (30 days) and open invoice mismatches" action={<Link href="/finance/payments" className={buttonClass("ghost", "sm")}>Reconcile ›</Link>} />
          <DataList rows={d.exceptions.slice(0, 6).map((e) => ({ ...e, icon: e.kind === "receipt" ? PackageX : FileWarning }))} empty="No open exceptions" label="Receiving and invoice exceptions" />
        </Card>
      </div>

      <Card className="mt-4" aria-labelledby="queue-h">
        <CardHeader id="queue-h" icon={ClipboardCheck} title="Approval queue" subtitle={`${d.kpis.queueCount} awaiting a decision · urgent items first · filter by status or use the centre pills above`}
          action={canApprove ? <Link href="/approvals" className={buttonClass("secondary", "sm")}>Open queue ›</Link> : undefined} />
        <DataTable columns={queueColumns} rows={d.queue} label="Approval queue" filters={[{ key: "status", label: "status" }, { key: "centre", label: "centre" }, { key: "type", label: "type" }]} exportName="approval-queue" emptyBody="Requests and purchase orders waiting on Head Office appear here." emptyTitle="Nothing awaiting approval" />
      </Card>
    </>
  );
}
