import { Skeleton } from "@/components/ui/states";

/** Mirrors the centre grid: header → category pills → centre cards. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-60" /></div>
      <Skeleton className="mb-4 h-10 w-[520px] max-w-full rounded-full" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card p-5 sm:p-6">
            <div className="flex items-center gap-3"><Skeleton className="size-11 rounded-[12px]" /><div className="grid gap-1.5"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-20 rounded-full" /></div></div>
            <Skeleton className="mt-6 h-24 w-full" />
            <div className="mt-4 grid grid-cols-3 gap-2">{[0, 1, 2].map((j) => <Skeleton key={j} className="h-12 rounded-tile" />)}</div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
