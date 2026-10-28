import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, Boxes, ClipboardCheck, Grid3x3, History, Table2 } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadCentreDetail } from "@/features/inventory/centres";
import { ModulePageHeader } from "@/components/shell/module-header";
import { HeatLegend } from "@/components/inventory/centre-grid";
import { InventoryHeatmap } from "@/components/dashboard/inventory";
import { DataList } from "@/components/dashboard/lists";
import { DataTable, type Column } from "@/components/data/data-table";
import { Card, CardHeader, Eyebrow, StatTile } from "@/components/ui/card";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { count, monthLabel, percent } from "@/lib/format";

type Params = { params: Promise<{ id: string }> };

// Static title: resolving the name here would bypass the scope check below and leak other centres' names.
export const metadata: Metadata = { title: "Centre inventory" };

const COUNT_BADGE: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" }, in_progress: { label: "In progress", tone: "blue" }, submitted: { label: "Submitted", tone: "green" },
};

const columns: Column[] = [
  { key: "product", header: "Product", kind: "link" },
  { key: "category", header: "Category", hideBelow: "md" },
  { key: "onHand", header: "On hand", kind: "count", align: "right" },
  { key: "uom", header: "Unit", hideBelow: "lg" },
  { key: "reorder", header: "Reorder at", kind: "count", align: "right", hideBelow: "sm" },
  { key: "state", header: "State", kind: "badge" },
  { key: "cover", header: "Days of cover", align: "right" },
  { key: "value", header: "Value", kind: "money", align: "right", hideBelow: "lg" },
];

export default async function CentreInventoryDetail({ params }: Params) {
  const session = await requirePermission("inventory.read");
  const { id } = await params;
  // Out-of-scope and unknown centres look the same: no hint that another centre exists.
  const { repo, centre } = scopedRepository(session, id);
  if (!centre) notFound();
  const d = await loadCentreDetail(repo, centre.id, session.centres);
  if (!d) notFound();
  const { stats } = d;

  return (
    <>
      <ModulePageHeader role={session.role} module="inventory" active="centres" title={d.centre.name}
        crumbs={[{ label: "Centre inventory", href: "/inventory/centres" }]}
        description={`${d.centre.city} · ${d.centre.code} · days of cover use the last 90 days of consumption`}
        aside={<>
          <Link href={`/inventory/movements?centre=${centre.id}`} className={buttonClass("secondary", "sm")}><ArrowLeftRight />Movements</Link>
          <Link href={`/inventory/counts?centre=${centre.id}`} className={buttonClass("primary", "sm")}><ClipboardCheck />Stock counts</Link>
        </>} />

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-label="SKU health by category">
          <CardHeader icon={Grid3x3} title="SKU health by category" subtitle="One cell per SKU · hover or focus for stock on hand" action={<HeatLegend tone={d.centre.tone} />} />
          <div className="grid gap-5 sm:grid-cols-2">
            {d.heat.map((g) => (
              <div key={g.id}>
                <Eyebrow className="mb-2">{g.name} · {g.cells.filter((c) => c.state !== "healthy").length} below reorder</Eyebrow>
                <InventoryHeatmap cells={g.cells} tone={d.centre.tone} label={`${g.name} SKU health`} />
              </div>
            ))}
          </div>
        </Card>
        <Card aria-label="Centre stock summary">
          <CardHeader icon={Boxes} title="Stock on hand" subtitle="At current unit cost" />
          <p className="text-metric-lg font-medium tracking-[-0.03em] tabular"><AnimatedNumber value={stats.value} format="money" /></p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <StatTile label="Units" value={count(stats.units)} />
            <StatTile label="SKUs" value={stats.skus} />
            <StatTile label="Healthy" value={percent(stats.healthyRatio)} />
            <StatTile label="Under 14 days cover" value={stats.shortCover} />
          </div>
          <Eyebrow className="mt-5 mb-2">{monthLabel(d.counts.period)} stock counts</Eyebrow>
          <ul className="grid gap-2">
            {(["opening", "closing"] as const).map((k) => (
              <li key={k} className="flex items-center justify-between rounded-tile bg-surface-2 px-3.5 py-2.5 text-label">
                <span className="capitalize">{k} count</span><StatusBadge tone={COUNT_BADGE[d.counts[k]]!.tone} dot>{COUNT_BADGE[d.counts[k]]!.label}</StatusBadge>
              </li>
            ))}
          </ul>
          <Link href={`/inventory/counts?centre=${centre.id}`} className={buttonClass("ghost", "sm", "mt-3")}>Counts & variance ›</Link>
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-label="Stock table">
          <CardHeader icon={Table2} title="Stock" subtitle={`${stats.critical} critical · ${stats.low} low · shortest cover first`} />
          <DataTable columns={columns} rows={d.table} label={`${d.centre.name} stock`} filters={[{ key: "category", label: "category" }, { key: "state", label: "state" }]}
            pageSize={10} exportName={`stock-${d.centre.code.toLowerCase()}`} emptyTitle="No stock lines at this centre" />
        </Card>
        <Card aria-label="Recent movements">
          <CardHeader icon={History} title="Recent movements" action={<Link href={`/inventory/movements?centre=${centre.id}`} className={buttonClass("ghost", "sm")}>Ledger ›</Link>} />
          <DataList rows={d.recent} empty="No movements yet" label={`${d.centre.name} recent movements`} />
        </Card>
      </div>
    </>
  );
}
