import { Skeleton } from "@/components/ui/states";

/** Loading state for analytics pages: header → optional KPI row → 2fr/1fr chart row → card grid. */
export function AnalyticsSkeleton({ kpis = true, cards = 3 }: { kpis?: boolean; cards?: number }) {
  const card = "card p-5 sm:p-6";
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-64" /><Skeleton className="mt-4 h-10 w-96 max-w-full rounded-full" /></div>
      {kpis && (
        <div className="mb-4 grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="card min-h-[153px] p-5"><Skeleton className="h-7 w-40 rounded-full" /><Skeleton className="mt-4 h-8 w-24" /><Skeleton className="mt-3 h-3 w-32 rounded-full" /></div>)}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={card}><Skeleton className="h-8 w-52 rounded-full" /><Skeleton className="mt-8 h-[240px] w-full" /></div>
        <div className={card}><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="mx-auto mt-6 size-44 rounded-full" /></div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => <div key={i} className={card}><Skeleton className="h-8 w-40 rounded-full" /><div className="mt-5 grid gap-4">{Array.from({ length: 5 }, (_, j) => <Skeleton key={j} className="h-6 w-full" />)}</div></div>)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
