import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, FileSearch, FileText, Hourglass, Inbox, Scale, ShoppingCart, Timer, Truck, Users, Wallet, Workflow } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadPurchasing } from "@/features/dashboards/purchasing";
import { dateEyebrow, firstName, greeting } from "@/features/dashboards/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveStatus } from "@/components/dashboard/live-status";
import { WelcomeCard, DayTimeline } from "@/components/dashboard/welcome";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { DataList } from "@/components/dashboard/lists";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge, toneDot } from "@/components/ui/badge";
import { CategoryDistribution, ProgressRing, TrendIndicator } from "@/components/charts/svg";
import { FlowBars } from "@/components/charts/lazy";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { DataTable } from "@/components/data/data-table";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Purchasing dashboard" };

export default async function PurchasingDashboard({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("dashboard.purchasing");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadPurchasing(repo);
  const canManage = can(session.role, "procurement.manage");
  const maxStage = Math.max(...d.pipeline.map((s) => s.count), 1);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: centre?.name ?? "All centres" }, { label: "Purchasing" }]}
        title="Purchasing"
        aside={<LiveStatus title={`${d.kpis.openPOs} open order${d.kpis.openPOs === 1 ? "" : "s"}`} detail={`${d.kpis.queue} ready to order · ${d.kpis.delayed} delayed`} progress={d.onSchedule} />}
      />

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WelcomeCard
          dateLabel={dateEyebrow(repo.today())}
          greeting={`${greeting()}, ${firstName(session.user.name)}.`}
          actions={<>
            <Link href="/modules/procurement" className={buttonClass("primary", "sm")}><ShoppingCart />Procurement</Link>
            <Link href="/procurement/compare" className={buttonClass("secondary", "sm")}><Scale />Compare suppliers</Link>
          </>}
          footer={<DayTimeline events={d.welcome.events} nowHour={d.welcome.nowHour} label="Today's deliveries and procurement activity" />}
        >
          <p>
            <b>{d.welcome.queue} approved request{d.welcome.queue === 1 ? "" : "s"}</b> worth <b>{d.welcome.queueValue}</b> {d.welcome.queue === 1 ? "is" : "are"} ready to order, <b>{d.welcome.awaitingReply} quotations</b> are awaiting a supplier reply and <b>{d.welcome.deliveriesToday} deliveries</b> are due today.{" "}
            {d.welcome.delayed > 0 && <em>{d.welcome.delayed} issued order{d.welcome.delayed > 1 ? "s are" : " is"} past the expected date.</em>}
          </p>
        </WelcomeCard>

        <Card aria-label="Price variance against quotations">
          <CardHeader icon={Scale} title="Price variance" subtitle="Paid against quoted · POs raised in the last 30 days" />
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-metric-lg font-medium tracking-[-0.03em]"><AnimatedNumber value={Math.abs(d.variance.net)} format="moneyCompact" /></span>
            <StatusBadge tone={d.variance.net > 0 ? "orange" : "green"}>{d.variance.net > 0 ? "over quote" : "under quote"}</StatusBadge>
          </div>
          <p className="mt-1 mb-3 text-label text-ink-3">{d.variance.under} POs under quote · {d.variance.over} over</p>
          <WidgetBoundary name="Price variance"><FlowBars data={d.variance.bars} /></WidgetBoundary>
          <div className="mt-3 flex gap-4 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5"><i className={cn("size-2 rounded-full", toneDot.green)} />Saved vs quote</span>
            <span className="flex items-center gap-1.5"><i className={cn("size-2 rounded-full", toneDot.orange)} />Paid over quote</span>
          </div>
        </Card>
      </div>

      <MetricGrid className="mt-4">
        <KpiCard variant="primary" icon={ClipboardList} label="Approved, waiting to order" value={<AnimatedNumber value={d.kpis.queue} />} href="/requests"
          footnote={<span>{d.kpis.queueValue} to commit{d.kpis.emergency ? ` · ${d.kpis.emergency} emergency` : ""}</span>} />
        <KpiCard variant="secondary" icon={Inbox} label="Quotations awaiting reply" value={<AnimatedNumber value={d.kpis.awaitingReply} />} href="/procurement/compare"
          footnote={<span>{d.kpis.toReview} received and ready to compare</span>} />
        <KpiCard icon={Wallet} label="Open PO value" value={<AnimatedNumber value={d.kpis.openValue} format="moneyCompact" />} href="/procurement/orders"
          footnote={<span>{d.kpis.openPOs} orders not yet fully received</span>} />
        <KpiCard icon={Timer} label="Delayed purchase orders" value={<AnimatedNumber value={d.kpis.delayed} />}
          footnote={<TrendIndicator direction={d.kpis.delayed ? "up" : "flat"} good={d.kpis.delayed === 0}>{d.kpis.delayed ? `Worst is ${d.kpis.worstLate} days late` : "Everything on schedule"}</TrendIndicator>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-label="Purchase order pipeline">
          <CardHeader icon={Workflow} title="PO pipeline" subtitle="Orders by stage · count and value" action={<Link className={buttonClass("ghost", "sm")} href="/procurement/orders">Orders ›</Link>} />
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Purchase order stages">
            {d.pipeline.map((s, i) => (
              <li key={s.status} className="relative flex flex-col rounded-tile bg-surface-2 p-3.5 last:col-span-2 sm:last:col-span-1">
                <span className="text-eyebrow font-medium tracking-[0.12em] text-ink-3 tabular">0{i + 1}</span>
                <span className="mt-0.5 min-h-9 text-label leading-tight text-ink-2">{s.label}</span>
                <span className="mt-2 text-metric font-medium tracking-[-0.02em]"><AnimatedNumber value={s.count} /></span>
                <span className="text-[12px] text-ink-3 tabular">{s.value}</span>
                <span className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                  <span className="bar-grow block h-full rounded-full bg-blue" style={{ width: `${(s.count / maxStage) * 100}%`, animationDelay: `${i * 70}ms` }} />
                </span>
                {i < d.pipeline.length - 1 && <ChevronRight className="absolute top-1/2 -right-2.5 z-10 hidden size-3 -translate-y-1/2 text-ink-3 sm:block" aria-hidden />}
              </li>
            ))}
          </ol>
          <div className="mt-4 grid grid-cols-1 gap-2 xs:grid-cols-3">
            <StatTile label="Open orders" value={<AnimatedNumber value={d.kpis.openPOs} />} />
            <StatTile label="Issued on schedule" value={<AnimatedNumber value={d.onSchedule} format="percent" />} />
            <StatTile label="Delayed" value={<AnimatedNumber value={d.kpis.delayed} />} />
          </div>
        </Card>
        <Card aria-label="Approved requests waiting to be ordered">
          <CardHeader icon={ClipboardList} title="Ready to order" subtitle="Approved by Head Office, no PO yet" />
          <DataList rows={d.queue} empty="Nothing waiting to be ordered" label="Approved requests waiting to be ordered" />
          {canManage && <div className="mt-4"><Link href="/procurement/orders?new=1" className={buttonClass("secondary", "md")}><FileText />Raise PO</Link></div>}
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card aria-label="Supplier scorecard">
          <CardHeader icon={Users} title="Supplier scorecard" subtitle="On-time rate · quality · lead time" />
          <ul className="grid gap-3">
            {d.suppliers.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <ProgressRing value={s.onTime} size={40} stroke={4} tone={s.onTime >= 0.9 ? "green" : s.onTime >= 0.8 ? "amber" : "red"} label={`${s.name} on-time`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium">{s.name}</p>
                  <p className="text-[12px] text-ink-3">Quality {percent(s.quality)} · {s.lead}d lead · {s.open} open{s.late ? ` · ${s.late} late` : ""}</p>
                </div>
                {s.status !== "approved" && <StatusBadge tone={s.status === "blocked" ? "red" : "amber"}>{s.status}</StatusBadge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card aria-label="Quotation status">
          <CardHeader icon={FileSearch} title="Quotations" subtitle={`${d.quotes.total} quotations on file`} action={<Link className={buttonClass("ghost", "sm")} href="/procurement/compare">All ›</Link>} />
          <CategoryDistribution segments={d.quotes.segments} label="Quotations by status" />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium"><AnimatedNumber value={d.quotes.productsCompared} /></p><p className="text-[11px] text-ink-3">Compared</p></div>
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium tabular">{d.quotes.avgSaving}</p><p className="text-[11px] text-ink-3">Avg saving</p></div>
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium"><AnimatedNumber value={d.quotes.expiringSoon} /></p><p className="text-[11px] text-ink-3">Expire ≤ 7d</p></div>
          </div>
          {canManage && <div className="mt-4"><Link href="/procurement/compare?request=1" className={buttonClass("secondary", "md")}><FileSearch />Request quotation</Link></div>}
        </Card>
        <Card aria-label="Delayed purchase orders" className="md:col-span-2 xl:col-span-1">
          <CardHeader icon={Truck} title="Delayed orders" subtitle="Issued and past the expected date" />
          <DataList rows={d.delayed} empty="No delayed orders" label="Delayed purchase orders" />
          {d.kpis.delayed > d.delayed.length && <p className="mt-3 text-label text-ink-3"><Hourglass className="mr-1 inline size-3.5" aria-hidden />{d.kpis.delayed - d.delayed.length} more delayed</p>}
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="prices-h">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="prices-h" className="text-title">Best price per product</h2>
            <p className="text-label text-ink-3">Lowest received or accepted quotation against the others · saving is per unit versus the highest quote</p>
          </div>
          <Link className={buttonClass("secondary", "sm")} href="/procurement/compare"><Scale />Supplier comparison</Link>
        </div>
        <Card>
          <DataTable
            label="Best price per product" exportName="best-prices" pageSize={10} filters={[{ key: "supplier", label: "best supplier" }, { key: "quotes", label: "quotes" }]}
            emptyTitle="No priced quotations yet"
            columns={[
              { key: "product", header: "Product" },
              { key: "supplier", header: "Best supplier", hideBelow: "sm" },
              { key: "best", header: "Best price", kind: "money", align: "right" },
              { key: "next", header: "Next best", kind: "money", align: "right", hideBelow: "md" },
              { key: "quotes", header: "Quotes", kind: "count", align: "right", hideBelow: "md" },
              { key: "saving", header: "Saving / unit", kind: "money", align: "right" },
              { key: "savingPct", header: "Saving", align: "right", hideBelow: "sm" },
              { key: "vsList", header: "vs list cost", align: "right", hideBelow: "lg" },
            ]}
            rows={d.prices}
          />
        </Card>
      </section>
    </>
  );
}
