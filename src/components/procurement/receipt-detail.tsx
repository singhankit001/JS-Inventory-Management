import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Eyebrow, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import type { ReceiptDetail } from "@/features/receiving/receipts";
import { count } from "@/lib/format";

const link = "font-medium text-ink underline-offset-4 hover:underline";

/** Receipt drawer body: who/when, line-level verification against what was outstanding on arrival. */
export function ReceiptDetailBody({ d }: { d: ReceiptDetail }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={d.status.tone} dot>{d.status.label}</StatusBadge><span className="text-label text-ink-3">{d.when} · {d.receivedBy}</span></div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Purchase order" value={d.po ? <Link className={link} href={d.po.href}>{d.po.label}</Link> : "—"} />
        <StatTile label="Supplier" value={d.supplier ? <Link className={link} href={d.supplier.href}>{d.supplier.label}</Link> : "—"} />
        <StatTile label="Centre" value={<Link className={link} href={d.centre.href}>{d.centre.label}</Link>} />
        <StatTile label="Received / outstanding" value={`${count(d.totals.received)} / ${count(d.totals.ordered)}${d.totals.damaged ? ` · ${d.totals.damaged} damaged` : ""}`} />
      </div>
      <section aria-label="Line verification">
        <Eyebrow className="mb-2">Line verification</Eyebrow>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[22rem] text-left text-label">
            <thead className="text-[11px] text-ink-3">
              <tr>
                <th scope="col" className="py-1.5 pr-2 font-medium">Product</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Due</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Received</th>
                <th scope="col" className="py-1.5 font-medium">Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <th scope="row" className="py-2 pr-2 font-normal">{l.href ? <Link href={l.href} className={link}>{l.product}</Link> : l.product}<span className="block text-[11.5px] text-ink-3">{l.uom}</span></th>
                  <td className="py-2 pr-2 text-right tabular">{count(l.ordered)}</td>
                  <td className="py-2 pr-2 text-right tabular">{count(l.received)}</td>
                  <td className="py-2"><StatusBadge tone={l.verdict.tone}>{l.verdict.label}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-ink-3">“Due” is what the line still owed when this delivery arrived. Good units were added to stock as receipt movements.</p>
      </section>
      <Link href={`/inventory/movements?q=${encodeURIComponent(d.id)}`} className={buttonClass("secondary", "sm", "justify-self-start")}>See stock movements</Link>
    </div>
  );
}
