"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/forms/fields";

/** Narrows the page to one centre via `?centre=` (the session scope is still enforced server-side by scopedRepository). */
export function CentrePicker({ centres, value }: { centres: { id: string; name: string }[]; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  if (centres.length < 2) return null;
  return (
    <div className="w-56 max-w-full" aria-busy={pending}>
      <Select aria-label="Centre" value={value ?? ""} disabled={pending} className="h-9 rounded-full"
        onChange={(e) => start(() => router.push(e.target.value ? `${pathname}?centre=${e.target.value}` : pathname, { scroll: false }))}>
        <option value="">All centres</option>
        {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
    </div>
  );
}
