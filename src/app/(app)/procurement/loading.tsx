import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-44 rounded-full" />
      <Skeleton className="mt-3 mb-6 h-9 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="card p-4"><Skeleton className="h-4 w-28 rounded-full" /><Skeleton className="mt-3 h-8 w-16" /><Skeleton className="mt-4 h-20 w-full" /></div>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]"><Skeleton className="h-72 w-full rounded-card" /><Skeleton className="h-72 w-full rounded-card" /></div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
