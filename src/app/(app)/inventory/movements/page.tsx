import type { Metadata } from "next";
import { ArrowLeftRight, Info } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadMovements, type LedgerQuery } from "@/features/inventory/movements";
import { ModulePageHeader } from "@/components/shell/module-header";
import { LedgerSync } from "@/components/inventory/ledger-sync";
import { DataTable, type Column } from "@/components/data/data-table";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { count, money, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Stock movements" };

const columns: Column[] = [
  { key: "at", header: "Date", kind: "date" },
  { key: "type", header: "Type", kind: "badge" },
  { key: "product", header: "Product", kind: "link" },
  { key: "category", header: "Category", hideBelow: "lg" },
  { key: "centre", header: "Centre", kind: "link", hideBelow: "md" },
  { key: "qty", header: "Qty", kind: "count", align: "right" },
  { key: "value", header: "Value", kind: "money", align: "right", hideBelow: "sm" },
  { key: "reference", header: "Reference", kind: "link", hideBelow: "lg" },
];

const signed = (n: number, f: (n: number) => string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${f(Math.abs(n))}`;

export default async function Movements({ searchParams }: { searchParams: Promise<LedgerQuery & { centre?: string }> }) {
  const session = await requirePermission("inventory.read");
  const sp = await searchParams;
  const { repo, centre } = scopedRepository(session, sp.centre);
  const d = await loadMovements(repo, sp);
  const t = d.totals;
  const tiles = [
    { label: "Receipts", g: t.receipt }, { label: "Consumption", g: t.consumption }, { label: "Adjustments", g: t.adjustment }, { label: "Transfers", g: t.transfer },
  ];

  return (
    <>
      <ModulePageHeader role={session.role} module="inventory" active="movements" title="Stock movements"
        description={`${centre ? `${centre.name} · ` : ""}Receipts, consumption, transfers and count adjustments since ${shortDate(d.from)}`}
        aside={<LedgerSync range={d.range} />} />

      <section aria-label="Movement totals" className="stagger mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile className="bg-surface shadow-card ring-1 ring-line/70" label={`${count(t.net.n)} movements · net change`} value={<>{signed(t.net.units, count)} units · {signed(t.net.value, money)}</>} />
        {tiles.map(({ label, g }) => (
          <StatTile key={label} className="bg-surface shadow-card ring-1 ring-line/70" label={`${label} · ${count(g.n)}`} value={<>{signed(g.units, count)} · {signed(g.value, money)}</>} />
        ))}
      </section>

      <Card aria-label="Movement ledger">
        <CardHeader icon={ArrowLeftRight} title="Ledger" subtitle="Newest first · quantities signed by their effect on stock · value at current unit cost" />
        {d.capped && (
          <p className="mb-3 flex items-start gap-1.5 rounded-tile bg-surface-2 px-3.5 py-2.5 text-label text-ink-2" role="note">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Showing the latest {count(d.rows.length)} of {count(d.matched)} matching movements. Totals above include all of them; narrow the range, pick a centre or filter to see older rows.
          </p>
        )}
        <DataTable columns={columns} rows={d.rows} label="Stock movements" pageSize={15} exportName={`movements-${d.range}`}
          filters={[{ key: "type", label: "type" }, { key: "centre", label: "centre" }, { key: "category", label: "category" }]}
          emptyTitle="No movements in this range" emptyBody="Try a longer date range or clear the filters." />
      </Card>
    </>
  );
}
