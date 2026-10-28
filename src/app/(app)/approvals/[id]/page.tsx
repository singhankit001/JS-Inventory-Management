import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, FileText, History, Layers, Workflow } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { actorFromSession } from "@/lib/auth/policy";
import { loadApprovalDetail } from "@/features/approvals/detail";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { WorkflowStepper } from "@/components/ui/stepper";
import { ActivityTimeline, DataList } from "@/components/dashboard/lists";
import { ApprovalReview } from "@/components/requests/approval-review";

export const metadata: Metadata = { title: "Approval detail" };

export default async function ApprovalDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("requests.approve");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadApprovalDetail(repo, (await params).id, actorFromSession(session));
  if (!d) notFound();
  const a = d.approval;
  const pending = a.status === "pending";

  return (
    <>
      <ModulePageHeader role={session.role} module="approvals" active="queue" title={d.title} crumbs={[{ label: "Approval queue", href: "/approvals" }]}
        description={<>{d.type} · {a.stage === "final" ? "final authorisation" : "Head Office review"}{d.centre && <> · <Link href={`/inventory/centres/${d.centre.id}`} className="underline-offset-4 hover:text-ink hover:underline">{d.centre.name}</Link></>}{pending && ` · waiting ${d.waiting}`}</>}
        aside={<>
          {a.critical && <StatusBadge tone="red" dot className="text-label">Critical</StatusBadge>}
          <StatusBadge tone={d.status.tone} dot className="text-label">{d.status.label}</StatusBadge>
          <Link href={d.subject.href} className={buttonClass("secondary", "md")}><FileText />Open {d.type.toLowerCase()}</Link>
        </>} />

      <div className="stagger grid gap-4">
        <Card aria-labelledby="ap-progress-h">
          <CardHeader id="ap-progress-h" icon={Workflow} title="Progress" subtitle={d.period ? `${d.period} request · revision rounds show on Submitted` : "Raised, reviewed, decided"} />
          <WorkflowStepper steps={d.steps} label={`${d.type} progress`} />
          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">
            {d.facts.map((f) => <StatTile key={f.label} label={f.label} value={f.value} />)}
          </div>
        </Card>

        <ApprovalReview approvalId={a.id} pending={pending} lines={d.lines} budget={d.budget} decisions={d.decisions} poLink={d.poLink}
          decided={d.decided && { ...d.status, ...d.decided }}>
          {d.otherRounds.length > 0 && (
            <Card aria-labelledby="rounds-h">
              <CardHeader id="rounds-h" icon={Layers} title="Other rounds" subtitle="Earlier and later submissions of this request" />
              <DataList rows={d.otherRounds} empty="No other rounds" label="Other approval rounds" />
            </Card>
          )}
          {!d.lines.length && (
            <Card aria-labelledby="subject-h">
              <CardHeader id="subject-h" icon={ClipboardCheck} title="What is being approved" subtitle={d.type} />
              <p className="text-body text-ink-2">
                {a.subjectType === "supplier_price"
                  ? "A supplier has quoted a new unit price. Approving records Head Office sign-off on the price; Purchasing then accepts the quotation on Supplier comparison. Returning asks Purchasing to renegotiate."
                  : a.subjectType === "purchase_order" ? "A purchase order above the authorisation threshold. It is authorised against its lines on the purchase order itself." : "Review the subject before deciding."}
              </p>
            </Card>
          )}
        </ApprovalReview>

        <Card aria-labelledby="ap-history-h">
          <CardHeader id="ap-history-h" icon={History} title="History" subtitle="From the audit trail" />
          <ActivityTimeline items={d.history} empty="No recorded activity yet" />
        </Card>
      </div>
    </>
  );
}
