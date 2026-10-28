import { Skeleton } from "@/components/ui/states";

/** Mirrors the configuration page: note banner, form sections on the left, reference cards on the right. */
export default function Loading() {
  const card = (h: string, i: number) => <div key={i} className="card p-5 sm:p-6"><Skeleton className="h-6 w-40" /><Skeleton className={`mt-4 w-full ${h}`} /></div>;
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6"><Skeleton className="h-4 w-44 rounded-full" /><Skeleton className="mt-3 h-9 w-64 max-w-full" /></div>
      <Skeleton className="mb-4 h-20 w-full rounded-card" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">{["h-16", "h-16", "h-14", "h-28"].map(card)}</div>
        <div className="grid content-start gap-4">{["h-8", "h-64"].map(card)}</div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
