import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CalendarCheck2, ChartColumn, FileWarning, Hourglass, Landmark, ListOrdered, PieChart, Scale } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadPayments } from "@/features/finance/payments";
import { ModulePageHeader } from "@/components/shell/module-header";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { DataList } from "@/components/dashboard/lists";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { CategoryDistribution } from "@/components/charts/svg";
import { TrendCard } from "@/components/charts/trend-card";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/data-table";
import { WidgetBoundary } from "@/components/feedback/error-boundary";
import { PaymentQueue } from "@/components/finance/payment-queue";

export const metadata: Metadata = { title: "Payments & reconciliation" };

const columns: Column[] = [
  { key: "paid", header: "Paid", kind: "date" },
  { key: "invoice", header: "Invoice", kind: "link" },
  { key: "supplier", header: "Supplier", kind: "link", hideBelow: "sm" },
  { key: "centre", header: "Centre", kind: "link", hideBelow: "lg" },
  { key: "method", header: "Method", hideBelow: "md" },
  { key: "amount", header: "Amount", kind: "money", align: "right" },
  { key: "ties", header: "Reconciled", kind: "badge", hideBelow: "md" },
];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ centre?: string; new?: string; invoice?: string }> }) {
  const session = await requirePermission("finance.read");
  const sp = await searchParams;
  const { repo } = scopedRepository(session, sp.centre);
  const d = await loadPayments(repo);
  const k = d.kpis;
  const canManage = can(session.role, "finance.manage");

  return (
    <>
      <ModulePageHeader role={session.role} module="finance" active="payments" title="Payments & reconciliation"
        description="What has been paid, what is approved and waiting, and anything that does not tie out."
        aside={<Link href="/finance/invoices" className={buttonClass("secondary", "sm")}><ListOrdered />Invoice inbox</Link>} />

      <MetricGrid>
        <KpiCard variant="primary" icon={Banknote} label="Paid this month" value={<AnimatedNumber value={k.paidMonth} format="moneyCompact" />} spark={k.spark} footnote={`${k.paidMonthCount} payment${k.paidMonthCount === 1 ? "" : "s"} month to date`} />
        <KpiCard variant="secondary" icon={Hourglass} label="Approved, awaiting payment" value={<AnimatedNumber value={k.queueValue} format="moneyCompact" />} footnote={`${k.queueCount} invoice${k.queueCount === 1 ? "" : "s"} in the queue`} />
        <KpiCard icon={CalendarCheck2} label="Paid, last 12 months" value={<AnimatedNumber value={k.yearValue} format="moneyCompact" />} footnote={`${k.yearCount} payments`} />
        <KpiCard icon={Scale} label="Reconciliation exceptions" value={<AnimatedNumber value={k.exceptions} />} footnote="Short-paid or awaiting goods" />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WidgetBoundary name="Payments by month">
          <TrendCard icon={ChartColumn} title="Payments by month" subtitle="Paid to suppliers, last 12 months · current month to date"
            views={[
              { key: "value", label: "Value", kind: "column", data: d.monthly.value, format: "money", aName: "Paid" },
              { key: "count", label: "Count", kind: "column", data: d.monthly.count, format: "count", aName: "Payments" },
            ]} />
        </WidgetBoundary>
        <Card aria-labelledby="queue-h">
          <CardHeader id="queue-h" icon={Landmark} title="Payment queue" subtitle="Approved invoices, earliest due first" />
          <PaymentQueue rows={d.queue} canManage={canManage} openOnLoad={sp.new === "1"} preselect={sp.invoice} />
          {!canManage && <p className="mt-3 text-[12px] text-ink-3">Your role can view payments but not record them.</p>}
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card aria-labelledby="method-h">
          <CardHeader id="method-h" icon={PieChart} title="Method split" subtitle="Last 12 months, by value" />
          {d.methods.length ? <CategoryDistribution segments={d.methods} label="Payments by method" /> : <p className="text-label text-ink-3">No payments in the last 12 months.</p>}
        </Card>
        <Card aria-labelledby="recon-h">
          <CardHeader id="recon-h" icon={FileWarning} title="Reconciliation exceptions" subtitle="Paid amount differs from the invoice, or no goods receipt to match against" />
          <div className="max-h-[22rem] overflow-y-auto pr-1">
            <DataList label="Reconciliation exceptions" empty="Everything ties out" rows={d.exceptions.map((r) => ({ ...r, icon: FileWarning }))} />
          </div>
        </Card>
      </div>

      <Card className="mt-4" aria-labelledby="payments-h">
        <CardHeader id="payments-h" icon={Banknote} title="Payments" subtitle="Newest first" />
        <DataTable columns={columns} rows={d.rows} label="Payments" pageSize={10} exportName="payments" filters={[{ key: "method", label: "method" }, { key: "ties", label: "reconciled" }]}
          emptyTitle="No payments yet" emptyBody="Payments appear here once an approved invoice is paid." />
      </Card>
    </>
  );
}
