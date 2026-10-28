import Link from "next/link";
import { WorkflowStepper } from "@/components/ui/stepper";
import { StatusBadge } from "@/components/ui/badge";
import { StatTile, Eyebrow } from "@/components/ui/card";
import { DataList } from "@/components/dashboard/lists";
import type { PoDetail } from "@/features/procurement/orders";
import { count, money } from "@/lib/format";
import { PoActions } from "./po-actions";

const link = "font-medium text-ink underline-offset-4 hover:underline";

/** Body of the PO drawer: progress, facts, line-level ordered/received/outstanding, receipts, invoices and actions. */
export function PoDetailBody({ d }: { d: PoDetail }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={d.status.tone} dot>{d.status.label}</StatusBadge>
        {d.late > 0 && <StatusBadge tone="red">{d.late}d late</StatusBadge>}
      </div>
      <WorkflowStepper steps={d.steps} label={`${d.number} progress`} />
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Supplier" value={<Link className={link} href={d.supplier.href}>{d.supplier.name}</Link>} />
        <StatTile label="Centre" value={<Link className={link} href={d.centre.href}>{d.centre.name}</Link>} />
        <StatTile label="Total" value={d.total} />
        <StatTile label="Price variance" value={d.variance === 0 ? "On contract" : `${d.variance > 0 ? "+" : "−"}${money(Math.abs(d.variance))}`} />
        <StatTile label="Raised" value={`${d.created} · ${d.raisedBy}`} />
        <StatTile label="Expected" value={d.expected} />
      </div>
      <PoActions poId={d.id} actions={d.actions} />

      <section aria-label="Order lines">
        <Eyebrow className="mb-2">Lines · {count(d.units.outstanding)} of {count(d.units.ordered)} units outstanding</Eyebrow>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[22rem] text-left text-label">
            <thead className="text-[11px] text-ink-3">
              <tr>
                <th scope="col" className="py-1.5 pr-2 font-medium">Product</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Ordered</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Received</th>
                <th scope="col" className="py-1.5 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <th scope="row" className="py-2 pr-2 font-normal">
                    {l.href ? <Link href={l.href} className={link}>{l.product}</Link> : l.product}
                    <span className="block text-[11.5px] text-ink-3 tabular">{l.unitPrice} / {l.uom} · {l.lineTotal}</span>
                  </th>
                  <td className="py-2 pr-2 text-right tabular">{count(l.ordered)}</td>
                  <td className="py-2 pr-2 text-right tabular">{count(l.received)}{l.damaged > 0 && <span className="block text-[11px] text-orange">+{l.damaged} damaged</span>}</td>
                  <td className="py-2 text-right font-medium tabular">{l.outstanding ? count(l.outstanding) : <span className="text-green">Done</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Goods receipts">
        <Eyebrow className="mb-1">Goods receipts</Eyebrow>
        <DataList rows={d.receipts} empty="Nothing received yet" label="Goods receipts" />
      </section>
      <section aria-label="Invoices">
        <Eyebrow className="mb-1">Invoices</Eyebrow>
        <DataList rows={d.invoices} empty="No invoice yet" label="Invoices" />
      </section>
    </div>
  );
}
