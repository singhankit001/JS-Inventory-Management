import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-44 rounded-full" />
      <Skeleton className="mt-3 mb-6 h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="card p-6"><Skeleton className="h-6 w-48" /><Skeleton className="mt-2 h-5 w-32 rounded-full" /><div className="mt-4 grid grid-cols-2 gap-2">{Array.from({ length: 4 }, (_, k) => <Skeleton key={k} className="h-12 rounded-tile" />)}</div></div>)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
