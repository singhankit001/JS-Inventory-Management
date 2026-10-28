"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Plus, Siren, Trash2 } from "lucide-react";
import { raiseEmergency } from "@/app/actions/requests";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, Field, QuantityInput, Select } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";
import { textareaClass } from "./approval-review";
import { money } from "@/lib/format";

export interface EmergencyProduct { id: string; label: string; hint: string; unitCost: number }
const MAX_LINES = 5;

/** "Raise emergency request": a few lines and a reason. Lands as a critical approval for Head Office. */
export function EmergencyDialog({ centres, products }: { centres: { id: string; name: string }[]; products: EmergencyProduct[] }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [centreId, setCentreId] = useState(centres[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState([{ key: 0, productId: "", qty: 1 }]);
  const [errors, setErrors] = useState<{ reason?: string; lines?: string; form?: string }>({});
  const total = lines.reduce((s, l) => s + (products.find((p) => p.id === l.productId)?.unitCost ?? 0) * l.qty, 0);
  const update = (key: number, patch: Partial<(typeof lines)[number]>) => { setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))); setErrors({}); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = lines.filter((l) => l.productId && l.qty > 0);
    const next = {
      reason: reason.trim() ? undefined : "Say what happened, so Head Office can prioritise it.",
      lines: !filled.length ? "Add at least one product with a quantity." : new Set(filled.map((l) => l.productId)).size < filled.length ? "Each product may appear only once." : undefined,
    };
    setErrors(next);
    if (next.reason || next.lines) return;
    start(async () => {
      try {
        const res = await raiseEmergency({ centreId, reason: reason.trim(), items: filled.map((l) => ({ productId: l.productId, proposedQty: l.qty })) });
        if (!res.ok) { setErrors({ form: res.error }); toast({ tone: "error", title: "Emergency not raised", body: res.error }); return; }
        toast({ tone: "success", title: "Emergency raised", body: res.message });
        setOpen(false);
        router.push(`/requests/${res.data!.id}`);
      } catch { toast({ tone: "error", title: "Emergency not raised", body: "The server could not be reached. Try again." }); }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="primary"><Siren />Raise emergency request</Button></DialogTrigger>
      <DialogContent title="Raise emergency request" description="Out-of-cycle items you cannot wait for. Goes straight to Head Office as critical · saved to demo data (resets daily)." className="max-h-[80vh] overflow-y-auto">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {centres.length > 1 && (
            <Field label="Centre">{(a) => <Select {...a} value={centreId} onChange={(e) => setCentreId(e.target.value)}>{centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
          )}
          <Field label="Reason" error={errors.reason}>
            {(a) => <textarea {...a} className={textareaClass} maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setErrors({}); }} placeholder="e.g. Hand wash ran out after a stomach bug in two classrooms." />}
          </Field>
          <fieldset className="grid gap-2.5">
            <legend className="mb-1.5 text-label font-medium text-ink-2">Items</legend>
            {lines.map((l, i) => (
              <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor={`${uid}-p${l.key}`} className="sr-only">Product {i + 1}</label>
                  <Combobox id={`${uid}-p${l.key}`} options={products} value={l.productId || undefined} onChange={(productId) => update(l.key, { productId })} placeholder="Search products…" aria-invalid={errors.lines && !l.productId ? true : undefined} />
                </div>
                <div>
                  <label htmlFor={`${uid}-q${l.key}`} className="sr-only">Quantity {i + 1}</label>
                  <QuantityInput id={`${uid}-q${l.key}`} value={l.qty} min={1} onChange={(qty) => update(l.key, { qty })} />
                </div>
                <Button variant="ghost" size="sm" className="size-10 px-0" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 /></Button>
              </div>
            ))}
            {errors.lines && <p role="alert" className="text-[12px] text-red">{errors.lines}</p>}
            {lines.length < MAX_LINES && (
              <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, productId: "", qty: 1 }])}><Plus />Add line</Button>
            )}
          </fieldset>
          {errors.form && <p role="alert" className="rounded-tile bg-red-soft px-3.5 py-2.5 text-label text-ink">{errors.form}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-label text-ink-3 tabular">Estimated {money(total)}</span>
            <Button type="submit" variant="primary" disabled={busy}><Siren />{busy ? "Raising…" : "Raise emergency"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
