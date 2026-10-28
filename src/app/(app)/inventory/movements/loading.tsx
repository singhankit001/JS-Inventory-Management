import { Skeleton } from "@/components/ui/states";

/** Mirrors the ledger: header with range pills → five total tiles → table card. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-56" /></div>
        <Skeleton className="h-10 w-64 rounded-full" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 rounded-tile" />)}</div>
      <div className="card p-5 sm:p-6">
        <Skeleton className="h-8 w-40 rounded-full" />
        <div className="mt-4 mb-3 flex flex-wrap gap-2"><Skeleton className="h-9 w-full rounded-full sm:w-60" /><Skeleton className="h-9 w-72 max-w-full rounded-full" /></div>
        <div className="grid gap-2">{Array.from({ length: 15 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
