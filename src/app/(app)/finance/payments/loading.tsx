import { TablePageSkeleton } from "@/components/data/table-skeleton";

export default function Loading() {
  return <TablePageSkeleton kpis={4} rows={10} />;
}
