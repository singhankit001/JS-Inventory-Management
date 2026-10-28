import { Skeleton } from "@/components/ui/states";

/** Mirrors the roles page: header, role cards, separation-of-duties rules, then the matrix. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-64 max-w-full" /><Skeleton className="mt-2 h-4 w-full max-w-2xl rounded-full" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card p-5 sm:p-6"><Skeleton className="h-6 w-36" /><Skeleton className="mt-2 h-4 w-full rounded-full" /><Skeleton className="mt-4 h-7 w-16" /><div className="mt-3 grid gap-1.5">{Array.from({ length: 4 }, (_, j) => <Skeleton key={j} className="h-3.5 w-11/12 rounded-full" />)}</div></div>
        ))}
      </div>
      <div className="card mt-4 grid gap-3 p-5 sm:p-6 md:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36 rounded-tile" />)}</div>
      <div className="card mt-4 p-5 sm:p-6"><Skeleton className="h-64 w-full" /></div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
