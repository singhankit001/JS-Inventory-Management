import { Skeleton } from "@/components/ui/states";

/** Mirrors the canonical dashboard (PageHeader → hero 2fr/1fr → 4 KPIs → 2fr/1fr) so the swap to real content doesn't shift. */
export default function Loading() {
  // min-heights match the real cards at 1280–1600px (hero 323, KPI 153, chart row 364) so nothing jumps on swap.
  const card = "card p-5 sm:p-6";
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <Skeleton className="h-4 w-44 rounded-full" />
          <Skeleton className="mt-3 h-9 w-56" />
        </div>
        <Skeleton className="h-14 w-72 max-w-full rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:min-h-[323px]">
        <div className={card}>
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="mt-3 h-9 w-72 max-w-full" />
          <Skeleton className="mt-3 h-4 w-full max-w-md rounded-full" />
          <Skeleton className="mt-14 h-10 w-full" />
        </div>
        <div className={card}>
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="mt-4 h-10 w-48" />
          <Skeleton className="mt-4 h-[120px] w-full" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card min-h-[153px] p-5">
            <Skeleton className="h-7 w-40 rounded-full" />
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-3 h-3 w-32 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:min-h-[364px]">
        <div className={card}>
          <Skeleton className="h-8 w-52 rounded-full" />
          <Skeleton className="mt-8 h-[240px] w-full" />
        </div>
        <div className={card}>
          <Skeleton className="h-8 w-40 rounded-full" />
          <div className="mt-6 grid gap-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
