"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { requestQuotation } from "@/app/actions/procurement";
import { Combobox, Field } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import type { CompareData } from "@/features/procurement/compare";
import { cn } from "@/lib/cn";
import { useDemoAction } from "./use-demo-action";
import { useCloseParam } from "./url-drawer";

/** Ask suppliers that carry a product's category for a price. Suppliers with an open request are left out. */
export function RequestQuoteForm({ products, eligible, initial }: { products: CompareData["products"]; eligible: CompareData["eligible"]; initial?: string }) {
  const close = useCloseParam("request");
  const { pending, run } = useDemoAction();
  const [productId, setProductId] = useState(initial ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const options = eligible[productId] ?? [];
  const error = !productId ? "Choose a product" : !picked.length ? "Pick at least one supplier" : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (error) return;
    run(() => requestQuotation({ productId, supplierIds: picked }), "Quotation not requested", () => close());
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate aria-label="Request quotation">
      <Field label="Product" error={tried && !productId ? error : undefined}>
        {(a) => <Combobox {...a} options={products} value={productId} onChange={(id) => { setProductId(id); setPicked([]); }} placeholder="Search products…" />}
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-label font-medium text-ink-2">Suppliers</legend>
        {!productId ? <p className="text-label text-ink-3">Choose a product first.</p> : !options.length ? <p className="text-label text-ink-3">Every supplier for this category already has an open request.</p> : (
          <div className="flex flex-wrap gap-2">
            {options.map((s) => {
              const on = picked.includes(s.id);
              return (
                <label key={s.id} className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-label transition-colors focus-within:ring-4 focus-within:ring-focus/15", on ? "border-ink bg-surface-2 text-ink" : "border-line-strong/80 text-ink-2 hover:bg-surface-2")}>
                  <input type="checkbox" className="accent-[var(--ink)]" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))} />{s.name}
                </label>
              );
            })}
          </div>
        )}
        {tried && productId && error && <p role="alert" className="mt-1.5 text-[12px] text-red">{error}</p>}
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone="neutral">Demo — no email is sent</StatusBadge>
        <Button type="submit" variant="primary" disabled={pending}><Send />{pending ? "Requesting…" : "Request quotation"}</Button>
      </div>
    </form>
  );
}
