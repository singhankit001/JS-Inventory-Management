import { TablePageSkeleton } from "@/components/data/table-skeleton";

export default function Loading() {
  return <TablePageSkeleton kpis={3} rows={10} />;
}
