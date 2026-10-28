"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { upsertSupplier } from "@/app/actions/procurement";
import { Field, Input, QuantityInput, Select } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import type { SupplierFormData } from "@/features/procurement/suppliers";
import { cn } from "@/lib/cn";
import { useDemoAction } from "./use-demo-action";
import { useCloseParam } from "./url-drawer";

/** Add or edit a supplier (suppliers.manage). Performance scores are not editable: they come from deliveries. */
export function SupplierForm({ data }: { data: SupplierFormData }) {
  const close = useCloseParam("edit");
  const { pending, run } = useDemoAction();
  const [v, setV] = useState(data.supplier);
  const [tried, setTried] = useState(false);
  const errors = {
    name: !v.name.trim() ? "Enter the supplier's name" : v.name.trim().length > 120 ? "Keep the name under 120 characters" : undefined,
    categories: v.categoryIds.length ? undefined : "Pick at least one category",
    lead: v.avgLeadDays < 1 || v.avgLeadDays > 90 ? "Lead time must be 1–90 days" : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);
  const toggle = (id: string) => setV((s) => ({ ...s, categoryIds: s.categoryIds.includes(id) ? s.categoryIds.filter((c) => c !== id) : [...s.categoryIds, id] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid) return;
    run(() => upsertSupplier({ ...v, name: v.name.trim() }), "Supplier not saved", () => close(v.id ? { supplier: v.id } : undefined));
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate aria-label={v.id ? "Edit supplier" : "Add supplier"}>
      <Field label="Name" error={tried ? errors.name : undefined}>
        {(a) => <Input {...a} value={v.name} maxLength={120} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="organization" />}
      </Field>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-label font-medium text-ink-2">Categories supplied</legend>
        <div className="flex flex-wrap gap-2">
          {data.categories.map((c) => {
            const on = v.categoryIds.includes(c.id);
            return (
              <label key={c.id} className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-label transition-colors focus-within:ring-4 focus-within:ring-focus/15", on ? "border-ink bg-surface-2 text-ink" : "border-line-strong/80 text-ink-2 hover:bg-surface-2")}>
                <input type="checkbox" className="accent-[var(--ink)]" checked={on} onChange={() => toggle(c.id)} />{c.name}
              </label>
            );
          })}
        </div>
        {tried && errors.categories && <p role="alert" className="text-[12px] text-red">{errors.categories}</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status" hint="Only approved suppliers can receive purchase orders">
          {(a) => (
            <Select {...a} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as typeof v.status })}>
              <option value="approved">Approved</option><option value="pending">Pending</option><option value="blocked">Blocked</option>
            </Select>
          )}
        </Field>
        <Field label="Typical lead time (days)" error={tried ? errors.lead : undefined}>
          {(a) => <QuantityInput {...a} min={1} max={90} value={v.avgLeadDays} onChange={(n) => setV({ ...v, avgLeadDays: n })} />}
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone="neutral">Saves to demo data · resets daily</StatusBadge>
        <Button type="submit" variant="primary" disabled={pending}><Save />{pending ? "Saving…" : v.id ? "Save changes" : "Add supplier"}</Button>
      </div>
    </form>
  );
}
