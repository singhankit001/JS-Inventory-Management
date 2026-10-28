import { Skeleton } from "@/components/ui/states";

/** Loading state for table pages: PageHeader → optional KPI row → card with toolbar, header row and rows. */
export function TablePageSkeleton({ kpis = 0, rows = 8 }: { kpis?: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6">
        <Skeleton className="h-4 w-44 rounded-full" />
        <Skeleton className="mt-3 h-9 w-56" />
      </div>
      {kpis > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="card min-h-[153px] p-5">
              <Skeleton className="h-7 w-40 rounded-full" />
              <Skeleton className="mt-4 h-8 w-24" />
              <Skeleton className="mt-3 h-3 w-32 rounded-full" />
            </div>
          ))}
        </div>
      )}
      <div className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="grid gap-1.5"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-56 max-w-full rounded-full" /></div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-full rounded-full sm:w-60" />
          <Skeleton className="h-9 w-64 max-w-full rounded-full" />
        </div>
        <Skeleton className="h-8 w-full" />
        <div className="mt-2 grid gap-2">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
