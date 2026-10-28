import { Skeleton } from "@/components/ui/states";

/** Mirrors the page: header, four integration cards, four KPIs, chart row, then the job table. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-72 max-w-full" /></div>
      {[0, 1].map((row) => (
        <div key={row} className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="card min-h-[140px] p-5 sm:p-6"><Skeleton className="h-6 w-36" /><Skeleton className="mt-4 h-4 w-full rounded-full" /><Skeleton className="mt-2 h-4 w-3/4 rounded-full" /></div>)}
        </div>
      ))}
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><div className="card p-5 sm:p-6"><Skeleton className="h-[260px] w-full" /></div><div className="card p-5 sm:p-6"><Skeleton className="h-[260px] w-full" /></div></div>
      <div className="card grid gap-2 p-5 sm:p-6"><Skeleton className="h-9 w-64 max-w-full rounded-full" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
