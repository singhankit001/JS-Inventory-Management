import type { Metadata } from "next";
import { ChartColumn, History, PieChart, TrendingUp, Truck } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadHistory } from "@/features/procurement/history";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column, type FilterDef } from "@/components/data/data-table";
import { CategoryDistribution, ComparisonBars, TrendIndicator } from "@/components/charts/svg";
import { ColumnChart, TrendChart } from "@/components/charts/lazy";
import { ParamSelect } from "@/components/procurement/param-select";
import { money, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Purchasing history" };

const columns: Column[] = [
  { key: "number", header: "PO", kind: "link" },
  { key: "date", header: "Raised", kind: "date" },
  { key: "supplier", header: "Supplier" },
  { key: "centre", header: "Centre", hideBelow: "md" },
  { key: "status", header: "Status", kind: "badge", hideBelow: "sm" },
  { key: "total", header: "Total", kind: "money", align: "right" },
  { key: "variance", header: "Price variance", kind: "money", align: "right", hideBelow: "lg" },
];
const filters: FilterDef[] = [{ key: "supplier", label: "supplier" }, { key: "centre", label: "centre" }, { key: "status", label: "status" }];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ centre?: string; product?: string }> }) {
  const session = await requirePermission("procurement.read");
  const sp = await searchParams;
  const { repo } = scopedRepository(session, sp.centre);
  const d = await loadHistory(repo, sp.product);
  const h = d.headline;

  return (
    <>
      <ModulePageHeader role={session.role} module="procurement" active="history" title="Purchasing history"
        description="Twelve months of issued orders: where the money went, with whom, and how prices moved." />

      <div className="stagger grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Twelve-month totals">
          <StatTile label="Spend · 12 months" value={h.spend} />
          <StatTile label="Orders issued" value={h.orders} />
          <StatTile label="Average order" value={h.avg} />
          <StatTile label="Net price variance" value={`${h.variance > 0 ? "+" : h.variance < 0 ? "−" : ""}${money(Math.abs(h.variance))}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card aria-label="Spend by month">
            <CardHeader icon={ChartColumn} title="Spend by month" subtitle="Issued purchase orders by month raised" />
            <ColumnChart data={d.months} name="Spend" highlight={d.months.at(-1)?.label} />
          </Card>
          <Card aria-label="Spend by category">
            <CardHeader icon={PieChart} title="By category" subtitle="Order line value · 12 months" />
            {d.categories.length ? <CategoryDistribution segments={d.categories} label="Spend by category" /> : <EmptyState title="No orders yet" className="py-8" />}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card aria-label="Spend by supplier">
            <CardHeader icon={Truck} title="By supplier" subtitle="12 months" />
            {d.suppliers.length ? <ComparisonBars rows={d.suppliers} label="Spend by supplier" /> : <EmptyState title="No orders yet" className="py-8" />}
          </Card>
          <Card aria-label="Price trend">
            <CardHeader icon={TrendingUp} title="Price trend" subtitle={d.product ? `${d.product.name} · paid per unit vs list ${d.product.list}` : "Pick a product"}
              action={<ParamSelect param="product" label="Product" options={d.products} allLabel={null} fallback={d.product?.id} />} />
            {d.product ? (
              <>
                <TrendChart data={d.product.trend} aName="Average paid" bName="List price" height={200} />
                <p className="mt-2"><TrendIndicator direction={d.product.change > 0.005 ? "up" : d.product.change < -0.005 ? "down" : "flat"} good={d.product.change <= 0}>
                  {Math.abs(d.product.change) < 0.005 ? "Flat over the year" : `${percent(Math.abs(d.product.change))} ${d.product.change > 0 ? "dearer" : "cheaper"} than the first order in the window`}
                </TrendIndicator></p>
              </>
            ) : <EmptyState title="No product orders yet" className="py-8" />}
          </Card>
        </div>

        <Card aria-label="Past purchase orders">
          <CardHeader icon={History} title="Past purchase orders" subtitle="Issued in the last 12 months · export to CSV" />
          <DataTable columns={columns} rows={d.rows} label="Past purchase orders" filters={filters} pageSize={12} exportName="purchasing-history"
            emptyTitle="No issued orders in 12 months" />
        </Card>
      </div>
    </>
  );
}
