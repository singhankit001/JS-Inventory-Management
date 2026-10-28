import { TablePageSkeleton } from "@/components/data/table-skeleton";

/** Mirrors the users view: header, view switch, then the users table (12 rows per page). */
export default function Loading() {
  return <TablePageSkeleton rows={12} />;
}
