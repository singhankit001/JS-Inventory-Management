import { TablePageSkeleton } from "@/components/data/table-skeleton";

/** Mirrors the audit page: three KPI cards above the events table (12 rows per page). */
export default function Loading() {
  return <TablePageSkeleton kpis={3} rows={12} />;
}
