import { Skeleton } from "@/components/ui/states";

const card = "card p-5 sm:p-6";
const Header = () => (
  <div className="mb-4 flex items-center gap-3">
    <Skeleton className="size-8 rounded-full" />
    <div className="grid gap-1.5"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-56 max-w-full rounded-full" /></div>
  </div>
);

/**
 * Loading state for the request/approval pages: page header, then an optional top block
 * ("bar" = pipeline card with stat tiles, "kpis" = 4 KPI cards, "split" = 2fr/1fr detail cards), then a table or form card.
 */
export function ModuleSkeleton({ top, rows = 8, side = false }: { top?: "bar" | "kpis" | "split"; rows?: number; side?: boolean }) {
  const table = (
    <div className={card}>
      <Header />
      <Skeleton className="mb-3 h-9 w-full rounded-full sm:w-80" />
      <div className="grid gap-2">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
    </div>
  );
  return (
    <div aria-busy="true" aria-label="Loading" role="status">
      <div className="mb-6">
        <Skeleton className="h-4 w-44 rounded-full" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-9 w-80 max-w-full rounded-full" />
      </div>
      {top === "bar" && (
        <div className={`${card} mb-4`}>
          <Header />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        </div>
      )}
      {top === "kpis" && (
        <div className="mb-4 grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="card min-h-[153px] p-5"><Skeleton className="h-7 w-40 rounded-full" /><Skeleton className="mt-4 h-8 w-24" /></div>)}
        </div>
      )}
      {top === "split" && (
        <div className={`${card} mb-4`}><Header /><div className="grid gap-4 md:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div></div>
      )}
      {side ? <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">{table}<div className={card}><Header /><Skeleton className="h-48 w-full" /></div></div> : table}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
