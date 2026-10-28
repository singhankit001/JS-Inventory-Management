import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadApprovalQueue } from "@/features/approvals/queue";
import { STALE_APPROVAL_HOURS } from "@/features/requests/logic";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PillGroup } from "@/components/ui/pill-group";
import { DataTable, type Column } from "@/components/data/data-table";
import { moneyCompact } from "@/lib/format";

export const metadata: Metadata = { title: "Approval queue" };

const base: Column[] = [
  { key: "subject", header: "Subject", kind: "link" },
  { key: "type", header: "Type", hideBelow: "md" },
  { key: "centre", header: "Centre", hideBelow: "sm" },
  { key: "amount", header: "Value", kind: "money", align: "right" },
  { key: "priority", header: "Priority", kind: "badge", hideBelow: "lg" },
];
const pendingColumns: Column[] = [...base, { key: "hours", header: "Hours waiting", kind: "count", align: "right" }, { key: "stage", header: "Stage", hideBelow: "lg" }];
const decidedColumns: Column[] = [...base, { key: "status", header: "Decision", kind: "badge" }, { key: "decided", header: "Decided", kind: "date", hideBelow: "md" }];

export default async function ApprovalQueuePage({ searchParams }: { searchParams: Promise<{ centre?: string; view?: string }> }) {
  const session = await requirePermission("requests.approve");
  const sp = await searchParams;
  const { repo, centre } = scopedRepository(session, sp.centre);
  const view = sp.view === "decided" ? "decided" : "pending";
  const d = await loadApprovalQueue(repo, view);
  const href = (v: string) => `/approvals${v === "decided" ? "?view=decided" : ""}${centre ? `${v === "decided" ? "&" : "?"}centre=${centre.id}` : ""}`;

  return (
    <>
      <ModulePageHeader role={session.role} module="approvals" active="queue" title="Approval queue"
        description="Requests, purchase orders and supplier prices waiting for a decision. Critical items first, then oldest."
        aside={d.totals.critical > 0 && <StatusBadge tone="red" dot className="text-label">{d.totals.critical} critical waiting</StatusBadge>} />

      <Card aria-labelledby="queue-h">
        <CardHeader id="queue-h" icon={ClipboardCheck} title={view === "pending" ? "Waiting for a decision" : "Decided in the last 30 days"}
          subtitle={view === "pending" ? `Open any row to review lines, budget impact and decide · over ${STALE_APPROVAL_HOURS} h counts as overdue` : "Read-only history; open a row for the full record"}
          action={<PillGroup ariaLabel="Queue view" activeKey={view} items={[{ key: "pending", label: `Pending · ${d.totals.pending}`, href: href("pending") }, { key: "decided", label: "Decided", href: href("decided") }]} />} />
        {view === "pending" && (
          <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Value waiting (excl. prices)" value={moneyCompact(d.totals.value)} />
            <StatTile label="Critical" value={d.totals.critical} />
            <StatTile label={`Over ${STALE_APPROVAL_HOURS} h`} value={d.totals.stale} />
            <StatTile label="By type" value={d.totals.byType.map((t) => `${t.count} ${t.type.toLowerCase()}`).join(" · ") || "—"} />
          </div>
        )}
        <DataTable key={view} columns={view === "pending" ? pendingColumns : decidedColumns} rows={d.rows} label="Approval queue" pageSize={12} exportName={`approvals-${view}`}
          filters={[{ key: "type", label: "type" }, { key: "centre", label: "centre" }, { key: "priority", label: "priority" }, ...(view === "pending" ? [{ key: "age", label: "age" }] : [])]}
          emptyTitle={view === "pending" ? "Nothing waiting for you" : "No decisions in the last 30 days"}
          emptyBody={view === "pending" ? "New requests, purchase orders and supplier prices appear here as soon as they are submitted." : undefined} />
      </Card>
    </>
  );
}
