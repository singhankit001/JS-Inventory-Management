"use client";

import { useMemo, useState, useTransition } from "react";
import { ClipboardCheck } from "lucide-react";
import { submitStockCount } from "@/app/actions/inventory";
import { Dialog, DialogTrigger, DrawerContent } from "@/components/ui/dialog";
import { Field, QuantityInput, SearchInput, Select } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useToast } from "@/components/feedback/toast";
import { count, money } from "@/lib/format";
import type { CountFormCentre } from "@/features/inventory/counts";

const signed = (n: number, f: (n: number) => string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${f(Math.abs(n))}`;

/** Count drawer: one counted quantity per SKU with the live variance against system stock, submitted via submitStockCount. */
export function CountForm({ centres }: { centres: CountFormCentre[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [centreId, setCentreId] = useState(centres[0]?.centreId);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const form = centres.find((c) => c.centreId === centreId) ?? centres[0];

  const rows = useMemo(() => (form?.lines ?? []).map((l) => {
    const counted = counts[l.productId] ?? l.system;
    return { ...l, counted, diff: counted - l.system };
  }), [form, counts]);
  const changed = rows.filter((r) => r.diff !== 0);
  const units = changed.reduce((s, r) => s + r.diff, 0);
  const value = changed.reduce((s, r) => s + r.diff * r.unitCost, 0);
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => `${r.name} ${r.sku} ${r.category}`.toLowerCase().includes(q)) : rows;

  if (!form) return null;
  const label = `Submit ${form.kind} count`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      try {
        const res = await submitStockCount({ centreId: form.centreId, period: form.period, kind: form.kind, lines: rows.map((r) => ({ productId: r.productId, onHand: r.counted })) });
        if (res.ok) {
          toast({ tone: "success", title: `${form.centre} ${form.kind} count submitted`, body: res.message });
          setOpen(false);
          setCounts({});
        } else toast({ tone: "error", title: "Count not submitted", body: res.error });
      } catch {
        toast({ tone: "error", title: "Count not submitted", body: "The server could not be reached. Try again." });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="primary" size="sm"><ClipboardCheck />{label}</Button></DialogTrigger>
      <DrawerContent title={label} description={`${form.centre} · ${form.period}. Lines start at system stock — change only what differs. Saved to demo data (resets daily).`}>
        <form onSubmit={submit} className="grid gap-4">
          {centres.length > 1 && (
            <Field label="Centre">
              {(a) => <Select {...a} value={form.centreId} onChange={(e) => { setCentreId(e.target.value); setCounts({}); }}>{centres.map((c) => <option key={c.centreId} value={c.centreId}>{c.centre} · {c.kind}</option>)}</Select>}
            </Field>
          )}
          <div className="grid grid-cols-3 gap-2" aria-live="polite">
            <StatTile label="Lines with variance" value={`${changed.length} of ${rows.length}`} />
            <StatTile label="Net units" value={signed(units, count)} />
            <StatTile label="Net value" value={signed(value, money)} />
          </div>
          <SearchInput aria-label="Find a product" placeholder="Find a product…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="grid gap-1" aria-label="Count lines">
            {shown.map((r) => (
              <li key={r.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-line/60 py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-body font-medium">{r.name}</p>
                  <p className="text-[12px] text-ink-3">{r.sku} · system <span className="tabular">{count(r.system)}</span> {r.uom}</p>
                </div>
                <StatusBadge tone={r.diff === 0 ? "neutral" : r.diff < 0 ? "red" : "blue"} className="justify-self-end tabular">{r.diff === 0 ? "Matches" : `${signed(r.diff, count)} ${r.uom}`}</StatusBadge>
                <div className="col-span-2">
                  <label htmlFor={`cq-${r.productId}`} className="sr-only">Counted quantity of {r.name}</label>
                  <QuantityInput id={`cq-${r.productId}`} value={r.counted} onChange={(n) => setCounts((c) => ({ ...c, [r.productId]: n }))} />
                </div>
              </li>
            ))}
            {shown.length === 0 && <li className="py-6 text-center text-label text-ink-3">No products match “{query}”.</li>}
          </ul>
          <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
            <p className="text-[12px] text-ink-3">{changed.length ? `${changed.length} adjustment${changed.length === 1 ? "" : "s"} will be posted` : "No variances — stock matches the system"}</p>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Submitting…" : "Submit count"}</Button>
          </div>
        </form>
      </DrawerContent>
    </Dialog>
  );
}
