import type { Metadata } from "next";
import { FileSpreadsheet, ShieldCheck } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadReports } from "@/features/analytics/reports";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ReportBuilder } from "@/components/analytics/report-builder";

export const metadata: Metadata = { title: "Reports & exports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("analytics.read");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadReports(repo);

  return (
    <>
      <ModulePageHeader role={session.role} module="analytics" active="reports" title="Reports & exports"
        description={`Prebuilt reports over the last 12 months · ${centre?.name ?? "all centres in your scope"}. Exports contain only records you are allowed to see.`}
        aside={<StatusBadge tone="neutral"><ShieldCheck className="size-3" aria-hidden />Scoped to your centres</StatusBadge>} />
      <Card aria-labelledby="reports-h">
        <CardHeader id="reports-h" icon={FileSpreadsheet} title="Report builder" subtitle="Choose a report, set the period and centre, preview, then download the CSV" />
        <ReportBuilder reports={d.reports} periods={d.periods} centres={d.centres} />
      </Card>
      <p className="mt-4 text-[12px] text-ink-3">CSV files are built in your browser from the rows above (money in rupees, two decimals). Scheduled email delivery and PDF reports are planned for Phase 2.</p>
    </>
  );
}
