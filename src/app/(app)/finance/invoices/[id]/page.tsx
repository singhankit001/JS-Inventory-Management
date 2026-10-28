import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, FileText, GitCompareArrows, PackageCheck, Receipt, Route, Truck, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadInvoice } from "@/features/finance/invoice";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { WorkflowStepper } from "@/components/ui/stepper";
import { DataList } from "@/components/dashboard/lists";
import { InvoiceActions } from "@/components/finance/invoice-actions";
import { cn } from "@/lib/cn";
import { count, money } from "@/lib/format";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ centre?: string }> };

export const metadata: Metadata = { title: "Invoice detail" };

const th = "border-b border-line px-3 py-2 text-[11.5px] font-medium text-ink-3";
const td = "border-b border-line/60 px-3 py-2.5";

export default async function InvoicePage({ params, searchParams }: Params) {
  const session = await requirePermission("finance.read");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadInvoice(repo, (await params).id);
  if (!d) notFound();
  const { invoice: inv, match: m } = d;
  const linesTotal = d.paper.reduce((s, l) => s + l.total, 0);

  return (
    <>
      <ModulePageHeader role={session.role} module="finance" active="invoices" title={inv.number} crumbs={[{ label: "Invoice inbox", href: "/finance/invoices" }]}
        description={<><Link href={d.supplier.href} className="underline-offset-4 hover:underline">{d.supplier.name}</Link> · <Link href={d.centre.href} className="underline-offset-4 hover:underline">{d.centre.name}</Link> · {money(inv.amount)} due {inv.due}</>}
        aside={<div className="flex flex-wrap gap-2"><StatusBadge tone={inv.status.tone} dot>{inv.status.label}</StatusBadge><StatusBadge tone={inv.match.tone} dot>{inv.match.label}</StatusBadge><StatusBadge tone={inv.ageing.tone}>{inv.ageing.label}</StatusBadge></div>} />

      <Card aria-labelledby="progress-h">
        <CardHeader id="progress-h" icon={Route} title="Progress" subtitle="Received → three-way match → approved → paid. Only matched invoices can be approved; only approved invoices can be paid." />
        <WorkflowStepper steps={d.steps} label={`${inv.number} progress`} />
        <div className="mt-5 border-t border-line pt-4">
          <InvoiceActions invoiceId={inv.id} number={inv.number} canManage={can(session.role, "finance.manage")} approve={d.actions.approve} query={d.actions.query} pay={d.actions.pay} />
        </div>
      </Card>

      <div className="stagger mt-4 grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card aria-labelledby="doc-h">
          <CardHeader id="doc-h" icon={FileText} title="Document" subtitle="Rendered from demo data; scanned PDFs arrive with Document Intelligence" />
          <article className="rounded-tile border border-line bg-surface-2 p-5 text-label shadow-card sm:p-6" aria-label={`Invoice ${inv.number} as rendered from the record`}>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-line-strong pb-4">
              <div>
                <Eyebrow>From</Eyebrow>
                <p className="text-body font-medium text-ink">{d.supplier.name}</p>
              </div>
              <div className="text-right">
                <p className="text-title font-normal tracking-[-0.01em]">Invoice</p>
                <p className="text-ink-2 tabular">{inv.number}</p>
              </div>
            </header>
            <dl className="grid grid-cols-2 gap-3 py-4">
              <div><dt className="text-ink-3">Bill to</dt><dd className="text-ink">Jumpstart · {d.centre.name}{d.centre.city && `, ${d.centre.city}`}</dd></div>
              <div><dt className="text-ink-3">PO reference</dt><dd className="text-ink tabular">{d.po?.number ?? "—"}</dd></div>
              <div><dt className="text-ink-3">Due</dt><dd className="text-ink tabular">{inv.due}</dd></div>
              <div><dt className="text-ink-3">Tax</dt><dd className="text-ink">Not modelled (tax-free totals)</dd></div>
            </dl>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[22rem] border-separate border-spacing-0 text-left">
                <caption className="sr-only">Lines at PO terms</caption>
                <thead><tr><th className={th}>Item</th><th className={cn(th, "text-right")}>Qty</th><th className={cn(th, "text-right")}>Rate</th><th className={cn(th, "text-right")}>Amount</th></tr></thead>
                <tbody>
                  {d.paper.map((l) => (
                    <tr key={l.id}><td className={td}>{l.product}<span className="block text-[11.5px] text-ink-3">{l.sku}</span></td><td className={cn(td, "text-right tabular")}>{count(l.qty)} {l.uom}</td><td className={cn(td, "text-right tabular")}>{money(l.price)}</td><td className={cn(td, "text-right tabular")}>{money(l.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 grid gap-1.5 text-right">
              <div className="flex justify-end gap-6"><dt className="text-ink-3">Lines at PO terms</dt><dd className="w-28 tabular">{money(linesTotal)}</dd></div>
              <div className="flex justify-end gap-6 text-body font-medium"><dt>Invoice total (billed)</dt><dd className="w-28 tabular">{money(inv.amount)}</dd></div>
            </dl>
          </article>
          <p className="mt-3 text-[12px] text-ink-3">Invoice records carry the billed total only; line detail is shown at purchase-order terms until Document Intelligence reads the supplier&apos;s own lines.</p>
        </Card>

        <Card aria-labelledby="match-h">
          <CardHeader id="match-h" icon={GitCompareArrows} title="Three-way match" subtitle="Ordered (PO) vs good units received (goods receipts) vs billed" action={<StatusBadge tone={inv.match.tone} dot>{inv.match.label}</StatusBadge>} />
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-left text-body">
              <caption className="sr-only">Three-way match per purchase order line</caption>
              <thead>
                <tr><th className={th} scope="col">Product</th><th className={cn(th, "text-right")} scope="col">Ordered</th><th className={cn(th, "text-right")} scope="col">PO price</th><th className={cn(th, "text-right")} scope="col">Received</th><th className={cn(th, "text-right")} scope="col">Billable</th><th className={th} scope="col">Check</th></tr>
              </thead>
              <tbody>
                {m.rows.map((r) => (
                  <tr key={r.id} className={cn(r.flag !== "ok" && "bg-surface-2")}>
                    <td className={td}><Link href={`/inventory/catalogue?q=${r.sku}`} className="font-medium underline-offset-4 hover:underline">{r.product}</Link></td>
                    <td className={cn(td, "text-right tabular")}>{count(r.orderedQty)}</td>
                    <td className={cn(td, "text-right tabular")}>{money(r.unitPrice)}</td>
                    <td className={cn(td, "text-right tabular", r.receivedQty !== r.orderedQty && "font-medium text-amber")}>{count(r.receivedQty)}{r.damagedQty > 0 && <span className="block text-[11.5px] font-normal text-ink-3">{r.damagedQty} damaged</span>}</td>
                    <td className={cn(td, "text-right tabular")}>{money(r.billable)}</td>
                    <td className={td}><StatusBadge tone={r.flagLabel.tone} dot>{r.flagLabel.label}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[["PO total", money(m.poTotal)], ["Billable (received × PO price)", money(m.billable)], ["Billed", money(m.billed)]].map(([k, v]) => (
              <div key={k} className="rounded-tile bg-surface-2 px-3.5 py-2.5"><dt className="text-[11.5px] text-ink-3">{k}</dt><dd className="text-body font-medium tabular">{v}</dd></div>
            ))}
            <div className={cn("rounded-tile px-3.5 py-2.5", m.variance ? "bg-orange-soft text-orange" : "bg-green-soft text-green")}>
              <dt className="text-[11.5px]">Variance</dt>
              <dd className="text-body font-medium tabular">{m.variance === 0 ? "None" : `${money(Math.abs(m.variance))} ${m.variance > 0 ? "over-billed" : "under-billed"}`}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] text-ink-3">Variance = billed − billable. Short, damaged or undelivered lines and prices above the PO all show up here; the match status is what the approval gate checks.</p>
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card aria-labelledby="links-h">
          <CardHeader id="links-h" icon={Building2} title="Linked records" />
          <DataList label="Linked records" empty="No linked records" rows={[
            ...(d.po ? [{ id: "po", icon: Truck, title: d.po.number, sub: `Purchase order · raised ${d.po.raised} · ${d.po.status}`, href: d.po.href }] : []),
            { id: "supplier", icon: Receipt, title: d.supplier.name, sub: "Supplier", href: d.supplier.href },
            { id: "centre", icon: Building2, title: d.centre.name, sub: `Centre · ${d.centre.city}`, href: d.centre.href },
          ]} />
        </Card>
        <Card aria-labelledby="gr-h">
          <CardHeader id="gr-h" icon={PackageCheck} title="Goods receipts" subtitle={`${d.receipts.length} against ${d.po?.number ?? "this PO"}`} />
          <DataList label="Goods receipts" empty="Nothing received yet — the invoice cannot match until goods arrive" rows={d.receipts.map((r) => ({ ...r, icon: PackageCheck }))} />
        </Card>
        <Card aria-labelledby="pay-h">
          <CardHeader id="pay-h" icon={Wallet} title="Payments" />
          <DataList label="Payments" empty={inv.rawStatus === "approved" ? "Approved — waiting for payment" : "No payments yet"} rows={d.payments.map((p) => ({ ...p, icon: Wallet }))} />
        </Card>
      </div>
    </>
  );
}
