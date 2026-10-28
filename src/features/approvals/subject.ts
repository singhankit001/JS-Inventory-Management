import type { Repository } from "@/lib/data/provider";
import type { Approval } from "@/domain/types";
import { indexBy } from "@/features/dashboards/shared";
import { periodLabel } from "@/features/requests/logic";

/** Loads what's needed to name and link any approval's subject (request, PO, supplier price, invoice). */
export async function subjectResolver(repo: Repository) {
  const [requests, pos, quotations, products, suppliers, centres, invoices] = await Promise.all([
    repo.requests(), repo.purchaseOrders(), repo.quotations(), repo.products(), repo.suppliers(), repo.centres(), repo.invoices(),
  ]);
  const rmap = indexBy(requests, "id"), pomap = indexBy(pos, "id"), qmap = indexBy(quotations, "id"), pmap = indexBy(products, "id");
  const smap = indexBy(suppliers, "id"), cmap = indexBy(centres, "id"), imap = indexBy(invoices, "id");
  const centre = (id?: string) => (id ? cmap.get(id)?.name ?? id : "All centres");
  const subject = (a: Approval): { title: string; href: string } => {
    switch (a.subjectType) {
      case "monthly_request": {
        const r = rmap.get(a.subjectId);
        return { title: r ? `${centre(r.centreId)} · ${periodLabel(r.period)}${r.priority === "emergency" ? " emergency" : ""} request` : a.subjectId, href: `/requests/${a.subjectId}` };
      }
      case "purchase_order": {
        const po = pomap.get(a.subjectId);
        return { title: po ? `${po.number} · ${smap.get(po.supplierId)?.name ?? "Supplier"}` : a.subjectId, href: `/procurement/orders?po=${a.subjectId}` };
      }
      case "supplier_price": {
        const q = qmap.get(a.subjectId);
        return { title: q ? `${pmap.get(q.productId)?.name ?? "Product"} · ${smap.get(q.supplierId)?.name ?? "Supplier"}` : a.subjectId, href: "/procurement/compare" };
      }
      case "invoice": {
        const inv = imap.get(a.subjectId);
        return { title: inv ? `${inv.number} · ${smap.get(inv.supplierId)?.name ?? "Supplier"}` : a.subjectId, href: `/finance/invoices/${a.subjectId}` };
      }
    }
  };
  return { subject, centre, rmap, pomap, qmap, pmap, smap, cmap, requests, centres };
}
