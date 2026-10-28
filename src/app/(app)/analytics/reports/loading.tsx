import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-56" /><Skeleton className="mt-4 h-10 w-96 max-w-full rounded-full" /></div>
      <div className="card p-5 sm:p-6">
        <Skeleton className="h-8 w-48 rounded-full" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <div className="grid content-start gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          <div><Skeleton className="h-10 w-full" /><div className="mt-4 grid gap-2">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></div>
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
