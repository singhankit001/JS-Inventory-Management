"use client";

import { useId, useState, useTransition } from "react";
import { PackageCheck } from "lucide-react";
import { recordGoodsReceipt } from "@/app/actions/receiving";
import { lineError, maxReceivable, receiptOutcome } from "@/features/dashboards/receiving";
import { Field, QuantityInput, Select } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/feedback/toast";
import { count } from "@/lib/format";

export interface ReceiveLine { id: string; product: string; uom: string; ordered: number; outstanding: number }
export interface ReceiveOption { id: string; label: string; centre: string; expected: string; overdue: boolean; partial: boolean; lines: ReceiveLine[] }
type Counts = Record<string, { received: number; damaged: number }>;

/** Record an item-level goods receipt against an open PO. Writes to the in-memory demo data via a server action. */
export function ReceiveForm({ options }: { options: ReceiveOption[] }) {
  const toast = useToast();
  const uid = useId();
  const [pending, start] = useTransition();
  const [poId, setPoId] = useState("");
  const [counts, setCounts] = useState<Counts>({});
  const po = options.find((o) => o.id === poId);
  const rows = (po?.lines ?? []).map((l) => {
    const c = counts[l.id] ?? { received: l.outstanding, damaged: 0 };
    const input = { outstanding: l.outstanding, receivedQty: c.received, damagedQty: c.damaged };
    return { l, c, input, error: lineError(input) };
  });
  // Same pure function the server uses, so the preview matches what will be saved.
  const outcome = rows.length ? receiptOutcome(rows.map((r) => r.input)) : undefined;
  const nothing = rows.length > 0 && rows.every((r) => r.c.received === 0);
  const invalid = rows.some((r) => r.error) || nothing;

  if (!options.length) return <EmptyState icon={PackageCheck} title="Nothing awaiting receipt" body="Issued purchase orders for your centres appear here." className="py-8" />;

  const pick = (id: string) => {
    setPoId(id);
    setCounts(Object.fromEntries((options.find((o) => o.id === id)?.lines ?? []).map((l) => [l.id, { received: l.outstanding, damaged: 0 }])));
  };
  const set = (id: string, next: { received: number; damaged: number }) => setCounts((prev) => ({ ...prev, [id]: next }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!po || invalid) return;
    start(async () => {
      try {
        const res = await recordGoodsReceipt({ purchaseOrderId: po.id, lines: rows.map((r) => ({ purchaseOrderLineId: r.l.id, receivedQty: r.c.received, damagedQty: r.c.damaged })) });
        if (res.ok) {
          toast({ tone: "success", title: res.title, body: res.body });
          pick("");
        } else toast({ tone: "error", title: "Receipt not saved", body: res.error });
      } catch {
        toast({ tone: "error", title: "Receipt not saved", body: "The server could not be reached. Try again." });
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label="Record goods receipt">
      <Field label="Purchase order" hint={po ? `${po.centre} · expected ${po.expected}${po.overdue ? " (overdue)" : po.partial ? " · balance of a part delivery" : ""}` : "Issued and part-received orders for your centres"}>
        {(a11y) => (
          <Select {...a11y} value={poId} onChange={(e) => pick(e.target.value)} required>
            <option value="" disabled>Choose a delivery…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}{o.overdue ? " · overdue" : o.partial ? " · part received" : ""}</option>)}
          </Select>
        )}
      </Field>
      {po && outcome && (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[30rem] text-left text-label">
              <caption className="sr-only">Count each line of {po.label}</caption>
              <thead className="text-[11px] text-ink-3">
                <tr>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Product</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">UoM</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Outstanding</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Received</th>
                  <th scope="col" className="py-1.5 font-medium">Damaged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ l, c, error }) => {
                  const id = `${uid}-${l.id}`;
                  return (
                    <tr key={l.id} className="align-top">
                      <th scope="row" className="py-2 pr-2 font-normal">
                        <span className="block text-body text-ink">{l.product}</span>
                        {error && <span id={`${id}-err`} role="alert" className="block text-[12px] text-red">{error}</span>}
                      </th>
                      <td className="py-2 pr-2 text-ink-2">{l.uom}</td>
                      <td className="py-2 pr-2 text-right tabular">
                        {count(l.outstanding)}
                        {l.outstanding !== l.ordered && <span className="block text-[11px] text-ink-3">of {count(l.ordered)}</span>}
                      </td>
                      <td className="py-2 pr-2">
                        <label htmlFor={`${id}-r`} className="sr-only">Received, {l.product}</label>
                        <QuantityInput id={`${id}-r`} value={c.received} max={maxReceivable(l.outstanding)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined}
                          onChange={(n) => set(l.id, { received: n, damaged: Math.min(c.damaged, n) })} />
                      </td>
                      <td className="py-2">
                        <label htmlFor={`${id}-d`} className="sr-only">Damaged, {l.product}</label>
                        <QuantityInput id={`${id}-d`} value={c.damaged} max={c.received} onChange={(n) => set(l.id, { received: c.received, damaged: n })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Outstanding" value={`${count(outcome.ordered)} units`} />
            <StatTile label="Will record as" value={<StatusBadge tone={outcome.status === "confirmed" ? "green" : "amber"} dot>{outcome.status === "confirmed" ? "Confirmed" : "Discrepancy"}</StatusBadge>} />
          </div>
          <p className="text-[12px] text-ink-3" aria-live="polite">
            {nothing ? "Enter the quantities that arrived — at least one line must have units received." : <>
              {[outcome.short && `${outcome.short} short`, outcome.over && `${outcome.over} over`, outcome.damaged && `${outcome.damaged} damaged`].filter(Boolean).join(", ") || "Everything outstanding arrived in good condition"}
              {" — "}the PO will be {outcome.poStatus === "received" ? "closed as received" : `left part received with ${count(outcome.remaining)} units still owed`}.
            </>}
          </p>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone="neutral">Saves to demo data · resets daily</StatusBadge>
        <Button type="submit" variant="primary" disabled={!po || pending || invalid}><PackageCheck />{pending ? "Saving…" : "Record receipt"}</Button>
      </div>
    </form>
  );
}
