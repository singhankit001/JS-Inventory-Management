import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  const card = "card p-5 sm:p-6";
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-64" /><Skeleton className="mt-4 h-10 w-96 max-w-full rounded-full" /></div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className={card}><Skeleton className="h-8 w-48 rounded-full" /><Skeleton className="mt-5 h-12 w-full" /><Skeleton className="mt-5 h-12 w-full" /><div className="mt-5 grid gap-4 lg:grid-cols-2"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div></div>
        <div className="grid content-start gap-4"><div className={card}><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="mt-4 h-20 w-full" /></div><div className={card}><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="mt-4 h-32 w-full" /></div></div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
