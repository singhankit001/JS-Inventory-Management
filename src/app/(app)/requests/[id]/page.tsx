import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, History, ListChecks, MessageSquareWarning, PencilLine, Truck, Wallet, Workflow } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadRequestDetail } from "@/features/requests/detail";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { WorkflowStepper } from "@/components/ui/stepper";
import { ActivityTimeline, DataList } from "@/components/dashboard/lists";
import { DataTable, type Column } from "@/components/data/data-table";
import { BudgetImpactBar } from "@/components/requests/budget-impact";
import { count, money, moneyCompact } from "@/lib/format";

export const metadata: Metadata = { title: "Request details" };

const columns: Column[] = [
  { key: "product", header: "Product", kind: "link" },
  { key: "uom", header: "Unit", hideBelow: "lg" },
  { key: "proposed", header: "Proposed", kind: "count", align: "right" },
  { key: "historical", header: "3-mo avg", kind: "count", align: "right", hideBelow: "sm" },
  { key: "variance", header: "Variance", kind: "badge", hideBelow: "sm" },
  { key: "approved", header: "Approved", kind: "count", align: "right", hideBelow: "md" },
  { key: "unitCost", header: "Unit cost", kind: "money", align: "right", hideBelow: "lg" },
  { key: "value", header: "Value", kind: "money", align: "right" },
];

export default async function RequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("requests.read");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  // Out-of-scope requests are invisible to the scoped repository, so they 404 rather than leak.
  const d = await loadRequestDetail(repo, (await params).id);
  if (!d) notFound();
  const r = d.request;
  const editable = can(session.role, "requests.create") && (r.status === "draft" || r.status === "revision_requested");
  const canReview = can(session.role, "requests.approve");
  const pending = d.rounds.find((x) => x.badge.label === "Pending");

  return (
    <>
      <ModulePageHeader role={session.role} module="requests" active={r.priority === "emergency" ? "emergency" : "monthly"} title={d.title}
        crumbs={r.priority === "emergency" ? [{ label: "Emergency requests", href: "/requests/emergency" }] : [{ label: "Monthly requests", href: "/requests" }]}
        description={<>{d.kind} · <Link href={`/inventory/centres?centre=${r.centreId}`} className="underline-offset-4 hover:text-ink hover:underline">{d.centreName}</Link> · {r.id}</>}
        aside={<>
          <StatusBadge tone={d.status.tone} dot className="text-label">{d.status.label}</StatusBadge>
          {editable && <Link href={`/requests/new?edit=${r.id}`} className={buttonClass("primary", "md")}><PencilLine />{r.status === "draft" ? "Continue draft" : "Edit & resubmit"}</Link>}
          {canReview && pending && <Link href={pending.href} className={buttonClass(editable ? "secondary" : "primary", "md")}><ClipboardCheck />Review</Link>}
        </>} />

      <div className="stagger grid gap-4">
        <Card aria-labelledby="progress-h">
          <CardHeader id="progress-h" icon={Workflow} title="Progress" subtitle={`Submitted by ${d.summary.submittedBy} · ${d.summary.submittedAt}`} />
          <WorkflowStepper steps={d.steps} label="Request progress" />
          {d.returnNote && (
            <p className="mt-5 flex gap-2.5 rounded-tile bg-orange-soft px-4 py-3 text-label text-ink">
              <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
              <span><b className="font-medium">Head Office:</b> {d.returnNote}</span>
            </p>
          )}
          {d.summary.reason && <p className="mt-5 rounded-tile bg-surface-2 px-4 py-3 text-label text-ink-2"><b className="font-medium text-ink">Reason for emergency:</b> {d.summary.reason}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">
            <StatTile label="Proposed value" value={money(d.summary.total)} />
            <StatTile label="At historical use" value={d.summary.historical ? money(d.summary.historical) : "—"} />
            <StatTile label="vs history" value={d.summary.vsHistory} />
            <StatTile label="Lines · flagged" value={`${count(d.summary.lines)} · ${d.summary.flagged}`} />
            <StatTile label="Approved value" value={d.summary.approvedValue === null ? "Not yet" : money(d.summary.approvedValue)} />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card aria-labelledby="lines-h" className="min-w-0">
            <CardHeader id="lines-h" icon={ListChecks} title="Line items" subtitle="Proposed vs the centre's 3-month average use · flagged beyond ±25%" />
            <DataTable columns={columns} rows={d.rows} label="Request line items" pageSize={12} exportName={`${r.id}-lines`} filters={[{ key: "flag", label: "variance" }]}
              emptyTitle="No lines yet" emptyBody={editable ? "Continue the draft to add products." : "This request has no line items."} />
          </Card>
          <div className="stagger grid content-start gap-4">
            <Card aria-labelledby="budget-h">
              <CardHeader id="budget-h" icon={Wallet} title="Budget impact" subtitle={d.impactPending ? `${d.centreName} · this request is not yet committed` : "Already inside committed and spent"} />
              <BudgetImpactBar impact={d.impact} />
              {!d.impactPending && <p className="mt-3 text-[12px] text-ink-3">Headroom {moneyCompact(d.impact.headroom)} this period.</p>}
            </Card>
            <Card aria-labelledby="rounds-h">
              <CardHeader id="rounds-h" icon={ClipboardCheck} title="Approval rounds" subtitle="One round per submission" />
              <DataList rows={d.rounds.map((x) => ({ ...x, href: canReview ? x.href : undefined }))} empty="Not submitted yet" label="Approval rounds" />
            </Card>
            <Card aria-labelledby="pos-h">
              <CardHeader id="pos-h" icon={Truck} title="Purchase orders" subtitle="Raised from this request's lines" />
              <DataList rows={d.pos.map((p) => ({ ...p, href: can(session.role, "procurement.read") ? p.href : undefined }))} empty={r.status === "approved" ? "Approved — waiting for Purchasing" : "No purchase orders yet"} label="Purchase orders from this request" />
            </Card>
          </div>
        </div>

        <Card aria-labelledby="history-h">
          <CardHeader id="history-h" icon={History} title="Revision history" subtitle="Saves, submissions and Head Office decisions from the audit trail" />
          <ActivityTimeline items={d.history} empty="No recorded activity for this request yet" />
        </Card>
      </div>
    </>
  );
}
