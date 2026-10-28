import { Skeleton } from "@/components/ui/states";

/** Mirrors counts: stepper 2fr / variance 1fr → centre status tiles → variance table. */
export default function Loading() {
  const card = "card p-5 sm:p-6";
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-80 max-w-full" /></div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={card}><Skeleton className="h-8 w-52 rounded-full" /><Skeleton className="mt-6 h-16 w-full" /></div>
        <div className={card}><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="mt-4 h-8 w-28" /><Skeleton className="mt-4 h-12 w-full rounded-tile" /></div>
      </div>
      <Skeleton className="mt-6 mb-3 h-6 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[108px] rounded-card" />)}</div>
      <div className={`${card} mt-6`}><Skeleton className="h-8 w-44 rounded-full" /><div className="mt-4 grid gap-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
