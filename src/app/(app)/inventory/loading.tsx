import { Skeleton } from "@/components/ui/states";

/** Mirrors the overview: header → 4 KPIs → trend 2fr/1fr → two list cards. */
export default function Loading() {
  const card = "card p-5 sm:p-6";
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-64" /></div>
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="card min-h-[153px] p-5"><Skeleton className="h-7 w-40 rounded-full" /><Skeleton className="mt-4 h-8 w-24" /></div>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={card}><Skeleton className="h-8 w-52 rounded-full" /><Skeleton className="mt-8 h-[240px] w-full" /></div>
        <div className={card}><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="mt-6 h-3 w-full rounded-full" /><Skeleton className="mt-6 h-32 w-full" /></div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => <div key={i} className={card}><Skeleton className="h-8 w-44 rounded-full" /><div className="mt-5 grid gap-3">{Array.from({ length: 6 }, (_, j) => <Skeleton key={j} className="h-10 w-full" />)}</div></div>)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
