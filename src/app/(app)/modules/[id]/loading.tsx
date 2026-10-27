import { Skeleton } from "@/components/ui/states";

/** Mirrors the module page: header with status chip, intro line, then a 3-column grid of page cards. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <Skeleton className="h-4 w-44 rounded-full" />
          <Skeleton className="mt-3 h-9 w-64 max-w-full" />
        </div>
        <Skeleton className="h-6 w-36 rounded-full" />
      </div>
      <Skeleton className="-mt-3 mb-6 h-4 w-full max-w-2xl rounded-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card p-5 sm:p-6">
            <div className="mb-3 flex items-start justify-between gap-3"><Skeleton className="h-6 w-40" /><Skeleton className="h-5 w-16 rounded-full" /></div>
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="mt-2 h-4 w-3/4 rounded-full" />
            <div className="mt-4 grid gap-2.5"><Skeleton className="h-5 w-48 rounded-full" /><Skeleton className="h-5 w-56 max-w-full rounded-full" /></div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
