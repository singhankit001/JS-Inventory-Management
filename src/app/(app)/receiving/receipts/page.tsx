import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, PackageCheck } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadReceipts } from "@/features/receiving/receipts";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column, type FilterDef } from "@/components/data/data-table";
import { ReceiveForm } from "@/components/dashboard/receive-form";
import { UrlDrawer } from "@/components/procurement/url-drawer";
import { ReceiptDetailBody } from "@/components/procurement/receipt-detail";

export const metadata: Metadata = { title: "Goods receipts" };

const columns: Column[] = [
  { key: "receipt", header: "Receipt", kind: "link" },
  { key: "date", header: "Date", kind: "date" },
  { key: "po", header: "PO", kind: "link" },
  { key: "supplier", header: "Supplier", hideBelow: "lg" },
  { key: "centre", header: "Centre", hideBelow: "md" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "ordered", header: "Due", kind: "count", align: "right", hideBelow: "sm" },
  { key: "received", header: "Received", kind: "count", align: "right", hideBelow: "sm" },
  { key: "damaged", header: "Damaged", kind: "count", align: "right", hideBelow: "md" },
];
const filters: FilterDef[] = [{ key: "status", label: "status" }, { key: "centre", label: "centre" }, { key: "supplier", label: "supplier" }];

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ centre?: string; receipt?: string; record?: string }> }) {
  const session = await requirePermission("receiving.read");
  const sp = await searchParams;
  const { repo } = scopedRepository(session, sp.centre);
  const canRecord = can(session.role, "receiving.record");
  const d = await loadReceipts(repo, { receipt: sp.receipt, record: sp.record, canRecord });

  return (
    <>
      <ModulePageHeader role={session.role} module="receiving" active="receipts" title="Goods receipts"
        description="Every delivery counted line by line against its purchase order."
        aside={canRecord ? <Link href="?record=1" scroll={false} className={buttonClass("primary", "sm")}><PackageCheck />Record receipt</Link> : undefined} />

      <div className="stagger grid gap-4">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Receipt summary">
          <StatTile label="Receipts" value={d.counts.total} />
          <StatTile label="With discrepancy" value={d.counts.discrepancy} />
          <StatTile label="Pending confirmation" value={d.counts.pending} />
        </div>
        <Card aria-label="Goods receipts">
          <CardHeader icon={ClipboardList} title="Receipts" subtitle="Newest first · open one for its line-level verification" />
          <DataTable columns={columns} rows={d.rows} label="Goods receipts" filters={filters} pageSize={12} exportName="goods-receipts"
            emptyTitle="No receipts yet" emptyBody="Receipts recorded against issued purchase orders appear here." />
        </Card>
      </div>

      {sp.receipt && (
        <UrlDrawer param="receipt" title={d.detail ? `Receipt ${d.detail.number}` : "Receipt not found"} description={d.detail?.po ? `Against ${d.detail.po.label}` : undefined}>
          {d.detail ? <ReceiptDetailBody d={d.detail} /> : <EmptyState title="Not in your centres" body="That receipt does not exist or belongs to a centre outside your assignment." />}
        </UrlDrawer>
      )}
      {sp.record && (
        <UrlDrawer param="record" dialog wide title="Record goods receipt" description={d.picked ? `${d.picked} is first in the list — choose it to count its lines.` : "Count what arrived against the purchase order."}>
          {d.options ? <ReceiveForm options={d.options} /> : <EmptyState title="Recording needs the receiving.record permission" className="py-8" />}
        </UrlDrawer>
      )}
    </>
  );
}
