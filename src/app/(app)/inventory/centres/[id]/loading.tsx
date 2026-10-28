import { Skeleton } from "@/components/ui/states";

/** Mirrors the centre detail: heatmap 2fr / summary 1fr → stock table 2fr / movements 1fr. */
export default function Loading() {
  const card = "card p-5 sm:p-6";
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-64 rounded-full" /><Skeleton className="mt-3 h-9 w-56" /></div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={card}><Skeleton className="h-8 w-52 rounded-full" /><div className="mt-5 grid gap-5 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div></div>
        <div className={card}><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="mt-4 h-10 w-44" /><div className="mt-4 grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-tile" />)}</div></div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={card}><Skeleton className="h-8 w-32 rounded-full" /><Skeleton className="mt-4 h-9 w-full rounded-full" /><div className="mt-3 grid gap-2">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></div>
        <div className={card}><Skeleton className="h-8 w-40 rounded-full" /><div className="mt-4 grid gap-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
