import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Lock, Scale, Store } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadCounts } from "@/features/inventory/counts";
import { ModulePageHeader } from "@/components/shell/module-header";
import { CentrePicker } from "@/components/inventory/centre-picker";
import { CountForm } from "@/components/inventory/count-form";
import { DataTable, type Column } from "@/components/data/data-table";
import { WorkflowStepper } from "@/components/ui/stepper";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/charts/svg";
import { count, money, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Stock counts & reconciliation" };

const varianceColumns: Column[] = [
  { key: "period", header: "Period" },
  { key: "centre", header: "Centre", kind: "link", hideBelow: "md" },
  { key: "product", header: "Product", kind: "link" },
  { key: "system", header: "System", kind: "count", align: "right", hideBelow: "sm" },
  { key: "counted", header: "Counted", kind: "count", align: "right", hideBelow: "sm" },
  { key: "variance", header: "Variance", kind: "count", align: "right" },
  { key: "value", header: "Value", kind: "money", align: "right", hideBelow: "lg" },
];

const reconColumns: Column[] = [
  { key: "centre", header: "Centre", kind: "link" },
  { key: "period", header: "Period" },
  { key: "opening", header: "Opening stock", kind: "money", align: "right", hideBelow: "lg" },
  { key: "receipts", header: "Receipts", kind: "money", align: "right", hideBelow: "md" },
  { key: "closing", header: "Closing count", kind: "money", align: "right", hideBelow: "sm" },
  { key: "consumption", header: "Consumption", kind: "money", align: "right" },
  { key: "discrepancy", header: "Discrepancy", kind: "money", align: "right", hideBelow: "sm" },
  { key: "submittedBy", header: "Submitted by", hideBelow: "lg" },
  { key: "status", header: "Verification", kind: "badge" },
  { key: "updated", header: "Last updated", kind: "date", hideBelow: "md" },
];

const signed = (n: number, f: (n: number) => string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${f(Math.abs(n))}`;

export default async function Counts({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("inventory.read");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const canCount = can(session.role, "inventory.count");
  const d = await loadCounts(repo, canCount);
  const { progress: p, summary: s } = d;

  return (
    <>
      <ModulePageHeader role={session.role} module="inventory" active="counts" title="Stock counts & reconciliation"
        description={`${centre?.name ?? (p.n === 1 ? "Your centre" : `${p.n} centres`)} · ${d.periodLabel} · closing counts due ${d.due}`}
        aside={<>
          <CentrePicker centres={session.centres.map((c) => ({ id: c.id, name: c.name }))} value={centre?.id} />
          {d.forms.length > 0 && <CountForm centres={d.forms} />}
        </>} />

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-label="Count progress this month">
          <CardHeader icon={ClipboardList} title={`${d.periodLabel} count cycle`} subtitle={p.n === 1 ? "Opening count → closing count → variances posted to the ledger" : "Progress across the centres you can see"}
            action={<ProgressRing value={p.n ? p.closingDone / p.n : 0} size={48} stroke={5} tone="green" label="Closing counts submitted" />} />
          <WorkflowStepper steps={d.steps} label="Stock count progress" className="mt-2" />
          {!canCount && (
            <p className="mt-5 flex items-start gap-2 rounded-tile bg-surface-2 px-3.5 py-2.5 text-label text-ink-2">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />Read-only: counts are recorded by each centre&apos;s leader. You can review status and variances here.
            </p>
          )}
          {canCount && d.forms.length === 0 && <p className="mt-5 rounded-tile bg-surface-2 px-3.5 py-2.5 text-label text-ink-2">All of this month&apos;s counts are submitted for your centre{p.n === 1 ? "" : "s"}.</p>}
        </Card>
        <Card aria-label="Variance this month">
          <CardHeader icon={Scale} title="Variance this month" subtitle="Counted minus system stock, at unit cost" />
          <p className="text-metric font-medium tracking-[-0.02em] tabular">{signed(s.value, money)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <StatTile label="Adjusted lines" value={s.lines} />
            <StatTile label="Net units" value={signed(s.units, count)} />
          </div>
          <p className="mt-3 text-[12px] text-ink-3">{s.shrinkLines} shrinkage lines over the last 12 months.</p>
        </Card>
      </div>

      <Card aria-label="Reconciliation by centre and period" className="mt-6">
        <CardHeader icon={Scale} title="Reconciliation" subtitle="Opening + receipts − consumption ± discrepancy = closing, at unit cost · last three months · simulated figures" />
        <DataTable columns={reconColumns} rows={d.reconRows} label="Stock reconciliation by centre and period" pageSize={10} exportName={`stock-reconciliation-${d.period}`}
          filters={[{ key: "centre", label: "centre" }, { key: "period", label: "period" }, { key: "status", label: "status" }, { key: "submittedBy", label: "submitter" }]}
          emptyTitle="No counts in this view" emptyBody="Change the filters, or pick another centre above." />
      </Card>

      <section aria-labelledby="centre-status-h" className="mt-6">
        <h2 id="centre-status-h" className="mb-3 flex items-center gap-2 text-title font-normal"><Store className="size-4 text-ink-3" aria-hidden />Status by centre</h2>
        <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.statusRows.map((r) => (
              <li key={r.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/inventory/centres/${r.id}`} className="truncate text-body font-medium underline-offset-4 hover:underline">{r.name}</Link>
                  <span className="shrink-0 text-[11.5px] text-ink-3 tabular">{r.submitted ? `Last ${shortDate(r.submitted)}` : ""}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-label text-ink-3">
                  <span className="flex items-center gap-1.5">Opening <StatusBadge tone={r.opening.tone} dot>{r.opening.label}</StatusBadge></span>
                  <span className="flex items-center gap-1.5">Closing <StatusBadge tone={r.closing.tone} dot>{r.closing.label}</StatusBadge></span>
                </div>
                <p className="text-[12px] text-ink-3">{r.lines ? `${r.lines} adjustment${r.lines === 1 ? "" : "s"} · ${signed(r.variance, money)}` : "No variance posted this month"}</p>
              </li>
          ))}
        </ul>
      </section>

      <Card aria-label="Variance history" className="mt-6">
        <CardHeader icon={Scale} title="Variance history" subtitle="Every count adjustment in the last 12 months · system rebuilt from the ledger" action={<Link href="/inventory/movements?f_type=Adjustment&range=90d" className="text-label text-ink-2 underline-offset-4 hover:text-ink hover:underline">In the ledger ›</Link>} />
        <DataTable columns={varianceColumns} rows={d.varianceRows} label="Count variances" pageSize={10} exportName={`count-variances-${d.period}`}
          filters={[{ key: "period", label: "period" }, { key: "centre", label: "centre" }]}
          emptyTitle="No count variances yet" emptyBody="Variances appear here when a submitted count differs from system stock." />
      </Card>
    </>
  );
}
