"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { PillGroup } from "@/components/ui/pill-group";

const RANGE_ITEMS = [{ key: "7d", label: "7 days" }, { key: "30d", label: "30 days" }, { key: "90d", label: "90 days" }];

/**
 * Date-range presets for the movement ledger, and the bridge that lets the server do the filtering: the table writes its
 * search/filters to the URL without a round trip, so once they settle we re-request the page and the loader re-filters
 * and re-totals all matching movements (not just the rows already in the browser).
 */
export function LedgerSync({ range }: { range: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const key = useSearchParams().toString();
  const [pending, start] = useTransition();
  const last = useRef(key);

  useEffect(() => {
    if (key === last.current) return;
    const t = setTimeout(() => { last.current = key; start(() => router.replace(`${pathname}?${key}`, { scroll: false })); }, 400);
    return () => clearTimeout(t);
  }, [key, pathname, router]);

  const pick = (r: string) => {
    const p = new URLSearchParams(window.location.search);
    p.set("range", r);
    last.current = p.toString();
    start(() => router.replace(`${pathname}?${p}`, { scroll: false }));
  };

  return (
    <div className="flex items-center gap-3">
      <span aria-live="polite" className="flex items-center gap-1.5 text-[12px] text-ink-3">
        {pending && <><LoaderCircle className="size-3.5 animate-spin" aria-hidden />Updating…</>}
      </span>
      <PillGroup ariaLabel="Date range" activeKey={range} onSelect={pick} items={RANGE_ITEMS} />
    </div>
  );
}
