import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-44 rounded-full" />
      <Skeleton className="mt-3 mb-6 h-9 w-64" />
      <div className="card p-6"><Skeleton className="h-6 w-40" /><div className="mt-4 grid grid-cols-7 gap-1.5 lg:grid-cols-14">{Array.from({ length: 14 }, (_, i) => <Skeleton key={i} className="h-16 rounded-tile" />)}</div></div>
      <div className="card mt-4 grid gap-3 p-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
