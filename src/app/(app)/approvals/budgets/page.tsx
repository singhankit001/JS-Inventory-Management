import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChartLine, Landmark, Receipt, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadBudgets } from "@/features/approvals/budgets";
import { ModulePageHeader } from "@/components/shell/module-header";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, toneDot } from "@/components/ui/badge";
import { PillGroup } from "@/components/ui/pill-group";
import { TrendCard } from "@/components/charts/trend-card";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { BudgetDialog } from "@/components/requests/budget-dialog";
import { cn } from "@/lib/cn";
import { moneyCompact, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Budgets & allocations" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ centre?: string; period?: string }> }) {
  const session = await requirePermission("budgets.read");
  const sp = await searchParams;
  const { repo, centre } = scopedRepository(session, sp.centre);
  const d = await loadBudgets(repo, sp.period);
  const used = d.totals.spent + d.totals.committed;
  const href = (p: string) => `/approvals/budgets?period=${p}${centre ? `&centre=${centre.id}` : ""}`;

  return (
    <>
      <ModulePageHeader role={session.role} module="approvals" active="budgets" title="Budgets & allocations"
        description="Each centre's monthly allocation against what is already spent (goods received) and committed (authorised orders still to arrive)."
        aside={can(session.role, "budgets.manage") && (d.editable
          ? <BudgetDialog key={d.active} rows={d.rows} period={d.active} periodLabel={d.label} />
          : <StatusBadge className="text-label">Past month · read-only</StatusBadge>)} />

      <div className="mb-4 max-w-full overflow-x-auto">
        <PillGroup variant="nav" ariaLabel="Budget period" activeKey={d.active} items={d.periods.map((p) => ({ key: p.key, label: p.key === d.current ? `${p.label} · now` : p.label, href: href(p.key) }))} />
      </div>

      <MetricGrid>
        <KpiCard variant="primary" icon={Landmark} label={`Allocated · ${d.label}`} value={<AnimatedNumber value={d.totals.allocated} format="moneyCompact" />} footnote={<span>{d.rows.length} centre{d.rows.length === 1 ? "" : "s"} in view</span>} />
        <KpiCard variant="secondary" icon={Wallet} label="Used incl. commitments" value={<AnimatedNumber value={d.totals.allocated ? used / d.totals.allocated : 0} format="percent" />} spark={d.spark}
          footnote={<span>{moneyCompact(d.totals.allocated - used)} headroom</span>} />
        <KpiCard icon={Receipt} label="Spent" value={<AnimatedNumber value={d.totals.spent} format="moneyCompact" />} footnote={<span>{moneyCompact(d.totals.committed)} committed on open orders</span>} />
        <KpiCard icon={AlertTriangle} label="Centres over budget" value={<AnimatedNumber value={d.totals.over} />} href="/approvals/exceptions" footnote={<span>Spent + committed above allocation</span>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card aria-labelledby="by-centre-h">
          <CardHeader id="by-centre-h" icon={Landmark} title="By centre" subtitle={`${d.label} · most used first`} />
          <ul className="grid gap-4">
            {d.rows.map((b, i) => (
              <li key={b.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <Link href={`/inventory/centres?centre=${b.id}`} className="truncate text-label font-medium underline-offset-4 hover:underline">{b.name}</Link>
                  <span className={cn("text-label font-medium tabular", b.over && "text-red")}>{b.over && <span className="sr-only">Over budget: </span>}{b.leftLabel}</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${b.name}: ${percent(b.spentPct)} spent, ${percent(b.committedPct)} committed of allocation`}>
                  <div className="bar-grow h-full bg-blue" style={{ width: `${Math.min(1, b.spentPct) * 100}%`, animationDelay: `${i * 50}ms` }} />
                  <div className={cn("bar-grow h-full", b.over ? "bg-red/60" : "bg-blue/35")} style={{ width: `${Math.min(1 - Math.min(1, b.spentPct), b.committedPct) * 100}%`, animationDelay: `${i * 50 + 100}ms` }} />
                </div>
                <p className="mt-1 text-[11.5px] text-ink-3 tabular">{b.detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-4 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5"><i className={cn("size-2 rounded-full", toneDot.blue)} />Spent</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-blue/35" />Committed</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-red/60" />Committed past allocation</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-surface-3 ring-1 ring-line" />Headroom</span>
          </div>
        </Card>
        <WidgetBoundary name="12-month budget trend">
          <TrendCard icon={ChartLine} title="12-month trend" subtitle={`${centre?.name ?? "Centres in view"} · spent + committed against allocation`}
            views={[{ key: "used", label: "Used", kind: "trend", data: d.trend, format: "money", aName: "Spent + committed", bName: "Allocated" }]} />
        </WidgetBoundary>
      </div>
    </>
  );
}
