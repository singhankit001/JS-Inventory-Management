import type { PurchaseOrder } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { dayOffset, indexBy, poOutstanding } from "@/features/dashboards/shared";
import { deliveryBadge } from "@/features/dashboards/receiving";
import { centreHref, poHref, supplierHref } from "@/features/procurement/shared";
import { count, moneyCompact, shortDate, time } from "@/lib/format";

export type Bucket = "overdue" | "today" | "week" | "fortnight" | "later" | "balance";
export const BUCKETS: { key: Bucket; label: string; hint: string }[] = [
  { key: "overdue", label: "Overdue", hint: "Past the expected date — chase the supplier" },
  { key: "today", label: "Today", hint: "Expected at the centre today" },
  { key: "week", label: "Next 7 days", hint: "Tomorrow to a week out" },
  { key: "fortnight", label: "8–14 days", hint: "The week after" },
  { key: "later", label: "Later", hint: "More than two weeks out" },
  { key: "balance", label: "Balances owed", hint: "Part delivered; the rest has no new booked date" },
];

/** Which agenda group an open PO belongs to: part-received balances apart, issued orders by days to expected. */
export function bucketOf(p: Pick<PurchaseOrder, "status" | "expectedAt">, today: Date): Bucket {
  if (p.status === "partially_received") return "balance";
  const off = dayOffset(p.expectedAt, today);
  return off < 0 ? "overdue" : off === 0 ? "today" : off <= 7 ? "week" : off <= 14 ? "fortnight" : "later";
}

export async function loadDeliveries(repo: Repository, supplierId?: string) {
  const today = repo.today();
  const [pos, lines, rLines, suppliers, centres] = await Promise.all([repo.purchaseOrders(), repo.purchaseOrderLines(), repo.receiptLines(), repo.suppliers(), repo.centres()]);
  const smap = indexBy(suppliers, "id"), cmap = indexBy(centres, "id");
  const { byPo } = poOutstanding(lines, rLines);
  const open = pos.filter((p) => p.status === "issued" || p.status === "partially_received");
  const shown = open.filter((p) => !supplierId || p.supplierId === supplierId).sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
  const lineCount = (id: string) => lines.filter((l) => l.purchaseOrderId === id).length;

  const items = shown.map((p) => {
    const off = dayOffset(p.expectedAt, today);
    const badge: { label: string; tone: Tone } = p.status === "partially_received" ? { label: "Balance owed", tone: "violet" } : deliveryBadge(off);
    return {
      id: p.id, bucket: bucketOf(p, today), number: p.number, href: poHref(p.id), recordHref: `/receiving/receipts?record=${p.id}`,
      supplier: { name: smap.get(p.supplierId)?.name ?? p.supplierId, href: supplierHref(p.supplierId) },
      centre: { name: cmap.get(p.centreId)?.name ?? p.centreId, href: centreHref(p.centreId) },
      when: `${shortDate(p.expectedAt)}, ${time(p.expectedAt)}`, badge,
      detail: `${count(byPo(p).units)} units · ${lineCount(p.id)} line${lineCount(p.id) === 1 ? "" : "s"} · ${moneyCompact(byPo(p).value)}`,
    };
  });

  const strip = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const n = shown.filter((p) => p.status === "issued" && dayOffset(p.expectedAt, today) === i).length;
    return { key: d.toDateString(), weekday: d.toLocaleDateString("en-IN", { weekday: "short" }), day: d.getDate(), count: n, weekend: d.getDay() === 0 };
  });

  return {
    groups: BUCKETS.map((b) => ({ ...b, items: items.filter((i) => i.bucket === b.key) })).filter((g) => g.items.length || g.key === "today"),
    strip,
    overdue: items.filter((i) => i.bucket === "overdue").length,
    total: items.length,
    suppliers: [...new Set(open.map((p) => p.supplierId))].map((id) => ({ id, label: smap.get(id)?.name ?? id })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
