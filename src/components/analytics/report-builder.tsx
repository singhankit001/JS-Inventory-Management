"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Select } from "@/components/forms/fields";
import { DataTable, type Column } from "@/components/data/data-table";
import { useToast } from "@/components/feedback/toast";
import { buildCsv } from "@/features/analytics/csv";
import type { ReportDef } from "@/features/analytics/reports";
import { count } from "@/lib/format";

const periodLabel = (p: string) => { const [y, m] = p.split("-").map(Number); return new Date(y!, m! - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" }); };

/** Pick a report, set period and centre, preview the rows and download exactly those rows as CSV (built in the browser). */
export function ReportBuilder({ reports, periods, centres }: { reports: ReportDef[]; periods: string[]; centres: { id: string; name: string }[] }) {
  const toast = useToast();
  const [id, setId] = useState(reports[0]?.id);
  const [per, setPer] = useState("all");
  const [centre, setCentre] = useState("all");
  const report = reports.find((r) => r.id === id) ?? reports[0];
  const rows = useMemo(() => report?.rows.filter((r) => (per === "all" || !report.byPeriod || r._period === per) && (centre === "all" || r._centre === centre)) ?? [], [report, per, centre]);
  if (!report) return null;
  const columns: Column[] = report.columns.map((c, i) => ({ key: c.key, header: c.header, kind: c.kind, align: c.kind === "money" || c.kind === "count" ? "right" : undefined, hideBelow: i > 2 ? "md" : undefined }));

  const download = () => {
    const name = [report.id, report.byPeriod && per !== "all" ? per : "12m", centre === "all" ? "all-centres" : centres.find((c) => c.id === centre)?.name.toLowerCase().replace(/\W+/g, "-")].filter(Boolean).join("_");
    const blob = new Blob(["﻿" + buildCsv(report.columns, rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ tone: "success", title: `${name}.csv downloaded`, body: `${count(rows.length)} rows, generated in your browser.` });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <ul className="grid content-start gap-2" aria-label="Reports">
        {reports.map((r) => (
          <li key={r.id}>
            <button type="button" aria-pressed={r.id === report.id} onClick={() => setId(r.id)}
              className={cn("w-full rounded-tile px-4 py-3 text-left transition-colors", r.id === report.id ? "bg-primary-card text-primary-card-ink" : "bg-surface-2 hover:bg-surface-3")}>
              <span className="flex items-center gap-2 text-body font-medium"><FileSpreadsheet className="size-4 shrink-0" aria-hidden />{r.title}</span>
              <span className={cn("mt-0.5 block text-[12px]", r.id === report.id ? "text-primary-card-ink-2" : "text-ink-3")}>{r.summary}</span>
            </button>
          </li>
        ))}
      </ul>

      <section aria-label={`${report.title} preview`} className="min-w-0">
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Period" hint={report.byPeriod ? undefined : "Ageing is always as of today"}>
            {(a) => <Select {...a} value={report.byPeriod ? per : "all"} disabled={!report.byPeriod} onChange={(e) => setPer(e.target.value)}>
              <option value="all">Last 12 months</option>
              {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </Select>}
          </Field>
          <Field label="Centre">
            {(a) => <Select {...a} value={centre} onChange={(e) => setCentre(e.target.value)} disabled={centres.length < 2}>
              {centres.length > 1 && <option value="all">All centres in scope</option>}
              {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>}
          </Field>
          <Button variant="primary" onClick={download} disabled={!rows.length}><Download />Download CSV</Button>
        </div>
        <p className="mb-3 flex flex-wrap items-center gap-2 text-label text-ink-3">
          <StatusBadge tone="blue">{count(rows.length)} rows</StatusBadge>
          The download contains every row for these parameters; search below only narrows the preview.
        </p>
        <DataTable key={`${report.id}-${per}-${centre}`} columns={columns} rows={rows} label={report.title} pageSize={10}
          emptyTitle="No rows for these parameters" emptyBody="Try another period or centre." />
      </section>
    </div>
  );
}
