import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  const card = "card p-5 sm:p-6";
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-52 rounded-full" /><Skeleton className="mt-3 h-9 w-40" /><Skeleton className="mt-3 h-4 w-80 max-w-full rounded-full" /></div>
      <div className={card}><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="mt-6 h-12 w-full" /><Skeleton className="mt-6 h-10 w-64 rounded-full" /></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={card}><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="mt-4 h-[360px] w-full" /></div>
        <div className={card}><Skeleton className="h-8 w-48 rounded-full" /><div className="mt-4 grid gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
