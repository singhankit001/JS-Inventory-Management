import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, FileText } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { actorFromSession } from "@/lib/auth/policy";
import { loadOrders } from "@/features/procurement/orders";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column, type FilterDef } from "@/components/data/data-table";
import { UrlDrawer } from "@/components/procurement/url-drawer";
import { PoDetailBody } from "@/components/procurement/po-detail";
import { RaisePoForm } from "@/components/procurement/raise-po-form";

export const metadata: Metadata = { title: "Purchase orders" };

const columns: Column[] = [
  { key: "number", header: "PO", kind: "link" },
  { key: "supplier", header: "Supplier" },
  { key: "centre", header: "Centre", hideBelow: "md" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "lines", header: "Lines", kind: "count", align: "right", hideBelow: "lg" },
  { key: "total", header: "Total", kind: "money", align: "right" },
  { key: "expected", header: "Expected", kind: "date", hideBelow: "sm" },
  { key: "outstanding", header: "Outstanding", kind: "money", align: "right", hideBelow: "lg" },
];
const filters: FilterDef[] = [{ key: "status", label: "status" }, { key: "supplier", label: "supplier" }, { key: "centre", label: "centre" }];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ centre?: string; po?: string; new?: string }> }) {
  const session = await requirePermission("procurement.read");
  const sp = await searchParams;
  const { repo } = scopedRepository(session, sp.centre);
  const canRaise = can(session.role, "procurement.manage");
  const d = await loadOrders(repo, actorFromSession(session), { po: sp.po, raise: canRaise && sp.new === "1" });

  return (
    <>
      <ModulePageHeader role={session.role} module="procurement" active="orders" title="Purchase orders"
        description="Raise, authorise and track every order to its receipt and invoice."
        aside={canRaise ? <Link href="?new=1" scroll={false} className={buttonClass("primary", "sm")}><FilePlus2 />Raise PO</Link> : undefined} />

      <div className="stagger grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Order summary" role="group">
          <StatTile label="Awaiting authorisation" value={d.summary.awaiting} />
          <StatTile label="Drafts" value={d.summary.drafts} />
          <StatTile label={`Open orders · ${d.summary.openValue} to deliver`} value={d.summary.open} />
          <StatTile label="Late deliveries" value={d.summary.late} />
        </div>
        <Card aria-label="Purchase orders">
          <CardHeader icon={FileText} title="All purchase orders" subtitle="Newest first · open a PO for its lines, receipts and invoices" />
          <DataTable columns={columns} rows={d.rows} label="Purchase orders" filters={filters} pageSize={12} exportName="purchase-orders"
            emptyTitle="No purchase orders yet" emptyBody={canRaise ? "Raise a PO from an approved request or the catalogue." : "Orders raised by Purchasing appear here."} />
        </Card>
      </div>

      {sp.po && (
        <UrlDrawer param="po" title={d.detail ? d.detail.number : "Purchase order not found"} description={d.detail ? `${d.detail.supplier.name} · ${d.detail.centre.name}` : undefined}>
          {d.detail ? <PoDetailBody d={d.detail} /> : <EmptyState title="Not in your centres" body="That purchase order does not exist or belongs to a centre outside your assignment." />}
        </UrlDrawer>
      )}
      {d.raise && (
        <UrlDrawer param="new" dialog wide title="Raise purchase order" description="It goes to an authoriser before it is issued to the supplier.">
          <RaisePoForm data={d.raise} />
        </UrlDrawer>
      )}
    </>
  );
}
