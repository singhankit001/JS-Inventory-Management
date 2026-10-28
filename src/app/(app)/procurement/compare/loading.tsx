import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-44 rounded-full" />
      <Skeleton className="mt-3 mb-6 h-9 w-64" />
      <Skeleton className="h-24 w-full rounded-card" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]"><Skeleton className="h-96 w-full rounded-card" /><Skeleton className="h-64 w-full rounded-card" /></div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
