"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";
import { Select } from "@/components/forms/fields";

/** A labelled select bound to one URL param, for server-side filters (centre, supplier, product…). */
export function ParamSelect({ param, label, options, allLabel = "All" }: { param: string; label: string; options: { id: string; label: string }[]; allLabel?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = useId();
  const [pending, start] = useTransition();
  const set = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(param, v); else next.delete(param);
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="text-[11.5px] text-ink-3">{label}</label>
      <Select id={id} value={params.get(param) ?? ""} onChange={(e) => set(e.target.value)} aria-busy={pending} className="h-9 min-w-44">
        {allLabel !== null && <option value="">{allLabel}</option>}
        {allLabel === null && !params.get(param) && <option value="" disabled>Choose…</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
    </div>
  );
}
