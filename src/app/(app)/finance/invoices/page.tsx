import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, FileStack, ListChecks, Scale, TriangleAlert, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadInvoiceInbox } from "@/features/finance/invoices";
import { ModulePageHeader } from "@/components/shell/module-header";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/data-table";

export const metadata: Metadata = { title: "Invoice inbox" };

const columns: Column[] = [
  { key: "number", header: "Invoice", kind: "link" },
  { key: "supplier", header: "Supplier", kind: "link", hideBelow: "sm" },
  { key: "centre", header: "Centre", kind: "link", hideBelow: "lg" },
  { key: "amount", header: "Amount", kind: "money", align: "right" },
  { key: "due", header: "Due", kind: "date", hideBelow: "md" },
  { key: "days", header: "Days overdue", kind: "count", align: "right", hideBelow: "lg" },
  { key: "ageing", header: "Ageing", kind: "badge", hideBelow: "md" },
  { key: "match", header: "3-way match", kind: "badge", hideBelow: "sm" },
  { key: "status", header: "Status", kind: "badge" },
];

export default async function InvoiceInboxPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("finance.read");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadInvoiceInbox(repo);
  const k = d.kpis;

  return (
    <>
      <ModulePageHeader role={session.role} module="finance" active="invoices" title="Invoice inbox"
        description="Supplier invoices with their three-way match result and ageing. Open one to match it against the PO and goods receipt."
        aside={<Link href="/finance/payments" className={buttonClass("secondary", "sm")}><Banknote />Payments</Link>} />

      <MetricGrid>
        <KpiCard variant="primary" icon={Wallet} label="Outstanding" value={<AnimatedNumber value={k.outstanding} format="moneyCompact" />} footnote={`${k.openCount} unpaid invoice${k.openCount === 1 ? "" : "s"}`} />
        <KpiCard variant="secondary" icon={TriangleAlert} label="Overdue" value={<AnimatedNumber value={k.overdue} format="moneyCompact" />} footnote={`${k.overdueCount} past due date`} />
        <KpiCard icon={ListChecks} label="Waiting for review" value={<AnimatedNumber value={k.toReview} />} footnote={`${k.readyToApprove} matched and ready to approve`} />
        <KpiCard icon={Scale} label="Match exceptions" value={<AnimatedNumber value={k.exceptions} />} footnote={`${k.onQuery} on query with the supplier`} />
      </MetricGrid>

      <Card className="mt-4" aria-labelledby="inbox-h">
        <CardHeader id="inbox-h" icon={FileStack} title="Invoices" subtitle="Unpaid first, oldest due date first · filters stay in the link so a view can be shared" />
        <DataTable columns={columns} rows={d.rows} label="Invoices" pageSize={12} exportName="invoices"
          filters={[{ key: "status", label: "status" }, { key: "match", label: "match" }, { key: "ageing", label: "ageing" }, { key: "supplier", label: "supplier" }]}
          emptyTitle="No invoices in your scope" emptyBody="Invoices appear here once a supplier bills a purchase order for your centres." />
      </Card>
    </>
  );
}
