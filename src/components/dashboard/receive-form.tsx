"use client";

import { useState, useTransition } from "react";
import { PackageCheck } from "lucide-react";
import { recordGoodsReceipt } from "@/app/actions/receiving";
import { receiptOutcome } from "@/features/dashboards/receiving";
import { Field, QuantityInput, Select } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/feedback/toast";

export interface ReceiveOption { id: string; label: string; centre: string; expected: string; overdue: boolean; ordered: number }

/** Record a goods receipt against an issued PO. Writes to the in-memory demo data via a server action. */
export function ReceiveForm({ options }: { options: ReceiveOption[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [poId, setPoId] = useState("");
  const [received, setReceived] = useState(0);
  const [damaged, setDamaged] = useState(0);
  const po = options.find((o) => o.id === poId);
  const outcome = po ? receiptOutcome(po.ordered, received, damaged) : undefined;
  const damagedError = damaged > received ? "Damaged units cannot exceed units received" : undefined;

  if (!options.length) return <EmptyState icon={PackageCheck} title="Nothing awaiting receipt" body="Issued purchase orders for your centres appear here." className="py-8" />;

  const pick = (id: string) => {
    setPoId(id);
    setReceived(options.find((o) => o.id === id)?.ordered ?? 0);
    setDamaged(0);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!po || damagedError) return;
    start(async () => {
      try {
        const res = await recordGoodsReceipt({ purchaseOrderId: po.id, receivedQty: received, damagedQty: damaged });
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
      <Field label="Purchase order" hint={po ? `${po.centre} · expected ${po.expected}${po.overdue ? " (overdue)" : ""}` : "Issued orders for your centres"}>
        {(a11y) => (
          <Select {...a11y} value={poId} onChange={(e) => pick(e.target.value)} required>
            <option value="" disabled>Choose a delivery…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}{o.overdue ? " · overdue" : ""}</option>)}
          </Select>
        )}
      </Field>
      {po && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Units received">{(a11y) => <QuantityInput {...a11y} value={received} onChange={setReceived} />}</Field>
            <Field label="Units damaged" error={damagedError}>{(a11y) => <QuantityInput {...a11y} value={damaged} onChange={setDamaged} />}</Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Ordered (est.)" value={`${po.ordered} units`} />
            <StatTile label="Will record as" value={outcome && <StatusBadge tone={outcome.status === "confirmed" ? "green" : "amber"} dot>{outcome.status === "confirmed" ? "Confirmed" : "Discrepancy"}</StatusBadge>} />
          </div>
          {outcome && outcome.status === "discrepancy" && (
            <p className="text-[12px] text-ink-3" aria-live="polite">
              {[outcome.short && `${outcome.short} short`, outcome.over && `${outcome.over} over`, damaged && `${damaged} damaged`].filter(Boolean).join(", ")} — the PO will be marked {outcome.poStatus === "received" ? "received" : "partially received"}.
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone="neutral">Saves to demo data · resets daily</StatusBadge>
        <Button type="submit" variant="primary" disabled={!po || pending || !!damagedError}><PackageCheck />{pending ? "Saving…" : "Record receipt"}</Button>
      </div>
    </form>
  );
}
