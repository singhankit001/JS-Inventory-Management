"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Banknote, CircleHelp, Lock, ShieldCheck } from "lucide-react";
import { approveInvoice, queryInvoice } from "@/app/actions/finance";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";

type Check = { ok: true } | { ok: false; reason: string };

/** Approve / Query / Record payment for one invoice. Availability comes from the INVOICE machine (server), never guessed here. */
export function InvoiceActions({ invoiceId, number, canManage, approve, query, pay }: {
  invoiceId: string; number: string; canManage: boolean; approve: Check; query: Check; pay: boolean;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();

  const done = (res: Awaited<ReturnType<typeof approveInvoice>>, onOk?: () => void) => {
    if (res.ok) { toast({ tone: "success", title: res.message }); onOk?.(); }
    else toast({ tone: "error", title: "Not saved", body: res.error });
    return res.ok;
  };

  if (!canManage) {
    return <p className="flex items-center gap-2 text-label text-ink-3"><Lock className="size-4" aria-hidden />Your role can view invoices but not query, approve or pay them.</p>;
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!approve.ok || pending} aria-describedby={approve.ok ? undefined : "approve-why"} onClick={() => start(async () => { done(await approveInvoice({ invoiceId })); })}>
          <ShieldCheck />Approve
        </Button>
        <Button disabled={!query.ok || pending} onClick={() => { setError(undefined); setOpen(true); }}><CircleHelp />Query</Button>
        {pay && <Link href={`/finance/payments?new=1&invoice=${invoiceId}`} className={buttonClass("secondary")}><Banknote />Record payment</Link>}
      </div>
      {!approve.ok && <p id="approve-why" className="text-label text-ink-3"><span className="font-medium text-ink-2">Approve unavailable:</span> {approve.reason}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Query ${number}`} description="The supplier is asked to explain or credit the difference. The reason is kept in the audit trail.">
          <form className="grid gap-4" onSubmit={(e) => {
            e.preventDefault();
            if (!reason.trim()) return setError("Say what is wrong so the supplier can fix it");
            start(async () => { done(await queryInvoice({ invoiceId, reason }), () => { setOpen(false); setReason(""); }); });
          }}>
            <Field label="Reason" error={error} hint="e.g. Billed 5 packs more than received; price above PO">
              {(a11y) => <textarea {...a11y} required maxLength={1000} rows={4} value={reason} onChange={(e) => { setReason(e.target.value); setError(undefined); }}
                className="w-full rounded-control border border-line-strong/80 bg-surface px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink-3 focus:border-focus focus:ring-4 focus:ring-focus/15 aria-[invalid=true]:border-red" />}
            </Field>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button>Cancel</Button></DialogClose>
              <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Put on query"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
