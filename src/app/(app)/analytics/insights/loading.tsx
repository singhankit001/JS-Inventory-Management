import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-64" /><Skeleton className="mt-4 h-10 w-96 max-w-full rounded-full" /></div>
      <Skeleton className="mb-4 h-12 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card p-5 sm:p-6"><Skeleton className="h-8 w-52 rounded-full" /><Skeleton className="mt-6 h-40 w-full" /></div>
        <div className="card p-5 sm:p-6"><Skeleton className="h-8 w-40 rounded-full" /><div className="mt-5 grid gap-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div></div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
