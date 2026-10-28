"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Banknote } from "lucide-react";
import { recordPayment } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { DateInput, Field, Input, Select } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";
import { money } from "@/lib/format";

export interface QueueRow { id: string; number: string; supplier: string; centre: string; amount: number; due: string; overdue: boolean }

const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Approved-unpaid invoices with a "Record payment" dialog. `?new=1` opens it; `?invoice=` preselects. The server policy
 *  still refuses anything that is not approved, so this list is a convenience, not the control. */
export function PaymentQueue({ rows, canManage, openOnLoad, preselect }: { rows: QueueRow[]; canManage: boolean; openOnLoad: boolean; preselect?: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(openOnLoad && canManage);
  const first = rows.find((r) => r.id === preselect) ?? rows[0];
  const [invoiceId, setInvoiceId] = useState(first?.id ?? "");
  const [rupees, setRupees] = useState(first ? String(first.amount / 100) : "");
  const [date, setDate] = useState(localDate());
  const [method, setMethod] = useState<"neft" | "upi" | "cheque">("neft");
  const [error, setError] = useState<string>();
  const chosen = rows.find((r) => r.id === invoiceId);

  const openFor = (r: QueueRow) => { setInvoiceId(r.id); setRupees(String(r.amount / 100)); setError(undefined); setOpen(true); };
  const submit = () => {
    const amount = Math.round(Number(rupees) * 100);
    if (!chosen) return setError("Choose an approved invoice");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter the amount paid");
    if (amount > chosen.amount) return setError(`Cannot exceed the invoice (${money(chosen.amount)})`);
    if (!date || date > localDate()) return setError("Pick today or an earlier date");
    start(async () => {
      const res = await recordPayment({ invoiceId, amount, paidAt: new Date(`${date}T12:00:00`).toISOString(), method });
      if (res.ok) { toast({ tone: "success", title: res.message }); setOpen(false); }
      else toast({ tone: "error", title: "Payment not recorded", body: res.error });
    });
  };

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState title="Nothing approved and unpaid" body="Approve matched invoices from the inbox; they queue here for payment." action={<Link href="/finance/invoices" className="text-label font-medium underline-offset-4 hover:underline">Open the invoice inbox</Link>} className="py-8" />
      ) : (
        <ul className="-mx-2 grid" aria-label="Approved invoices awaiting payment">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line/60 px-2 py-2.5 last:border-0">
              <div className="min-w-0 flex-1 basis-48">
                <Link href={`/finance/invoices/${r.id}`} className="truncate text-body font-medium underline-offset-4 hover:underline">{r.number} · {r.supplier}</Link>
                <p className="truncate text-[12px] text-ink-3">{r.centre}</p>
              </div>
              <StatusBadge tone={r.overdue ? "orange" : "neutral"}>{r.due}</StatusBadge>
              <span className="w-24 text-right text-body font-medium tabular">{money(r.amount)}</span>
              {canManage && <Button size="sm" onClick={() => openFor(r)} aria-label={`Record payment for ${r.number}`}><Banknote />Pay</Button>}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Record payment" description="Records a payment already made from the bank. Only approved invoices can be paid. Saved to demo data (resets daily).">
          {rows.length === 0 ? <p className="text-body text-ink-2">No approved invoices are waiting for payment.</p> : (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <Field label="Invoice">
                {(a) => <Select {...a} value={invoiceId} onChange={(e) => { const r = rows.find((x) => x.id === e.target.value); setInvoiceId(e.target.value); if (r) setRupees(String(r.amount / 100)); setError(undefined); }}>
                  {rows.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.supplier} · {money(r.amount)}</option>)}
                </Select>}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount (₹)" hint={chosen ? `Billed ${money(chosen.amount)}; less shows under reconciliation` : undefined}>
                  {(a) => <Input {...a} type="number" inputMode="decimal" min={0.01} step={0.01} value={rupees} onChange={(e) => { setRupees(e.target.value); setError(undefined); }} />}
                </Field>
                <Field label="Paid on">{(a) => <DateInput {...a} max={localDate()} value={date} onChange={(e) => { setDate(e.target.value); setError(undefined); }} />}</Field>
              </div>
              <Field label="Method">
                {(a) => <Select {...a} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="neft">NEFT</option><option value="upi">UPI</option><option value="cheque">Cheque</option></Select>}
              </Field>
              {error && <p role="alert" className="text-label text-red">{error}</p>}
              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button>Cancel</Button></DialogClose>
                <Button type="submit" variant="primary" disabled={pending}>{pending ? "Recording…" : "Record payment"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {canManage && rows.length > 0 && <Button variant="primary" className="mt-4" onClick={() => openFor(chosen ?? rows[0]!)}><Banknote />Record payment</Button>}
    </>
  );
}
