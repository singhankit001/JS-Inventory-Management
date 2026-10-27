import { TablePageSkeleton } from "@/components/data/table-skeleton";

/** Table-page skeleton (permission matrix) instead of the dashboard one from (app)/loading.tsx. */
export default function Loading() {
  return <TablePageSkeleton rows={10} />;
}
