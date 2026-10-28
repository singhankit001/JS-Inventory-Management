"use client";

import { useId, useState } from "react";
import { FilePlus2, Trash2 } from "lucide-react";
import { raisePO } from "@/app/actions/procurement";
import { Combobox, DateInput, Field, Input, QuantityInput, Select } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/card";
import type { RaiseData } from "@/features/procurement/orders";
import { money } from "@/lib/format";
import { useDemoAction } from "./use-demo-action";
import { useCloseParam } from "./url-drawer";

interface Line { productId: string; quantity: number; rupees: string }

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

/** Raise PO: supplier → centre → lines from the supplier's catalogue, prices prefilled from its contract quote. */
export function RaisePoForm({ data }: { data: RaiseData }) {
  const uid = useId();
  const close = useCloseParam("new");
  const { pending, run } = useDemoAction();
  const [supplierId, setSupplierId] = useState("");
  const [centreId, setCentreId] = useState(data.centres.length === 1 ? data.centres[0]!.id : "");
  const [expected, setExpected] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [tried, setTried] = useState(false);
  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const catalogue = data.products.filter((p) => supplier?.categoryIds.includes(p.categoryId) && !lines.some((l) => l.productId === p.id));
  const name = (id: string) => data.products.find((p) => p.id === id);

  const parsed = lines.map((l) => ({ ...l, unitPrice: Math.round(Number(l.rupees) * 100) }));
  const priceError = (l: (typeof parsed)[number]) => (!/^\d+(\.\d{1,2})?$/.test(l.rupees.trim()) || !Number.isFinite(l.unitPrice) ? "Enter a price in rupees, e.g. 120.50" : undefined);
  const total = parsed.reduce((s, l) => s + l.quantity * (priceError(l) ? 0 : l.unitPrice), 0);
  const errors = {
    supplier: !supplierId ? "Choose a supplier" : undefined,
    centre: !centreId ? "Choose the centre to deliver to" : undefined,
    expected: !expected ? "Choose an expected delivery date" : expected < data.today ? "Expected date cannot be in the past" : undefined,
    lines: !lines.length ? "Add at least one product" : parsed.some((l) => l.quantity < 1 || priceError(l)) ? "Fix the highlighted lines" : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);

  const pickSupplier = (id: string) => {
    setSupplierId(id);
    setLines([]);
    const s = data.suppliers.find((x) => x.id === id);
    if (s) setExpected(addDays(data.today, s.lead));
  };
  const add = (productId: string) => setLines((ls) => [...ls, { productId, quantity: 1, rupees: ((data.prices[`${supplierId}:${productId}`] ?? 0) / 100).toFixed(2) }]);
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid) return;
    run(() => raisePO({ supplierId, centreId, expectedAt: expected, lines: parsed.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })) }), "Purchase order not raised",
      (d) => close(d ? { po: d.id } : undefined));
  };
  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label="Raise purchase order" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supplier" error={err("supplier")} hint="Approved suppliers only">
          {(a) => (
            <Select {...a} value={supplierId} onChange={(e) => pickSupplier(e.target.value)}>
              <option value="" disabled>Choose a supplier…</option>
              {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Deliver to" error={err("centre")}>
          {(a) => (
            <Select {...a} value={centreId} onChange={(e) => setCentreId(e.target.value)}>
              <option value="" disabled>Choose a centre…</option>
              {data.centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Expected delivery" error={err("expected")} hint={supplier ? `Typical lead time ${supplier.lead} days` : undefined}>
          {(a) => <DateInput {...a} min={data.today} value={expected} onChange={(e) => setExpected(e.target.value)} />}
        </Field>
        <Field label="Add product" error={err("lines")} hint={supplier ? "Price prefilled from the supplier's contract quote" : "Choose a supplier first"}>
          {(a) => supplier ? <Combobox {...a} options={catalogue} value={undefined} onChange={add} placeholder="Search the catalogue…" /> : <Input {...a} disabled placeholder="Choose a supplier first" />}
        </Field>
      </div>

      {lines.length > 0 && (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[32rem] text-left text-label">
            <caption className="sr-only">Purchase order lines</caption>
            <thead className="text-[11px] text-ink-3">
              <tr>
                <th scope="col" className="py-1.5 pr-2 font-medium">Product</th>
                <th scope="col" className="py-1.5 pr-2 font-medium">Quantity</th>
                <th scope="col" className="py-1.5 pr-2 font-medium">Unit price (₹)</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Line total</th>
                <th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {parsed.map((l, i) => {
                const p = name(l.productId);
                const id = `${uid}-${l.productId}`;
                const pe = priceError(l);
                const contract = data.prices[`${supplierId}:${l.productId}`] ?? 0;
                return (
                  <tr key={l.productId} className="align-top">
                    <th scope="row" className="py-2 pr-2 font-normal">
                      <span className="block text-body text-ink">{p?.label}</span>
                      <span className="block text-[11.5px] text-ink-3">{p?.hint}</span>
                    </th>
                    <td className="py-2 pr-2">
                      <label htmlFor={`${id}-q`} className="sr-only">Quantity, {p?.label}</label>
                      <QuantityInput id={`${id}-q`} min={1} value={l.quantity} onChange={(n) => set(i, { quantity: n })} />
                    </td>
                    <td className="py-2 pr-2">
                      <label htmlFor={`${id}-p`} className="sr-only">Unit price in rupees, {p?.label}</label>
                      <Input id={`${id}-p`} inputMode="decimal" className="w-28 tabular" value={l.rupees} onChange={(e) => set(i, { rupees: e.target.value })} aria-invalid={pe ? true : undefined} aria-describedby={`${id}-ph`} />
                      <span id={`${id}-ph`} className={pe ? "block text-[11.5px] text-red" : "block text-[11.5px] text-ink-3"}>
                        {pe ?? (l.unitPrice !== contract ? `Contract ${money(contract)} · variance recorded` : "Contract price")}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right text-body tabular">{pe ? "—" : money(l.quantity * l.unitPrice)}</td>
                    <td className="py-2">
                      <Button size="sm" variant="ghost" aria-label={`Remove ${p?.label}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Lines" value={lines.length} />
        <StatTile label="Order total" value={money(total)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone="neutral">Goes to authorisation · demo data resets daily</StatusBadge>
        <Button type="submit" variant="primary" disabled={pending || (tried && invalid)}><FilePlus2 />{pending ? "Raising…" : "Raise PO"}</Button>
      </div>
    </form>
  );
}
