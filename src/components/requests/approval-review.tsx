"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Check, ListChecks, Lock, RotateCcw, Scale, Wallet, X } from "lucide-react";
import { decideApproval } from "@/app/actions/approvals";
import type { ReviewLine } from "@/features/approvals/detail";
import type { DecisionKind } from "@/features/approvals/decide";
import { budgetImpact, type BudgetFigures } from "@/features/requests/logic";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { QuantityInput } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";
import { BudgetImpactBar } from "./budget-impact";
import { cn } from "@/lib/cn";
import { count, money } from "@/lib/format";

export const textareaClass =
  "min-h-24 w-full rounded-control border border-line-strong/80 bg-surface px-3.5 py-2.5 text-body text-ink placeholder:text-ink-3 outline-none transition-[border-color,box-shadow] duration-200 focus:border-focus focus:ring-4 focus:ring-focus/15 aria-[invalid=true]:border-red";

const ACTIONS: Record<DecisionKind, { label: string; icon: typeof Check; variant: "primary" | "secondary" | "danger" }> = {
  approved: { label: "Approve", icon: Check, variant: "primary" },
  revision_requested: { label: "Return for revision", icon: RotateCcw, variant: "secondary" },
  rejected: { label: "Reject", icon: X, variant: "danger" },
};

/**
 * Line-level review + decision for one approval. Quantities can only be trimmed; the budget bar follows the edits.
 * Every button state comes from the server's own workflow + policy check, and the action re-checks on submit.
 */
export function ApprovalReview({ approvalId, pending, lines, budget, decisions, decided, poLink, children }: {
  approvalId: string; pending: boolean; lines: ReviewLine[]; budget?: BudgetFigures;
  decisions: { decision: DecisionKind; allowed: boolean; reason?: string }[];
  decided?: { label: string; tone: Tone; by: string; at: string; note?: string }; poLink?: string; children?: React.ReactNode;
}) {
  const toast = useToast();
  const commentId = useId();
  const [busy, start] = useTransition();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.id, l.approved])));
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const canEdit = pending && decisions.some((d) => d.decision === "approved" && d.allowed);
  const proposedTotal = lines.reduce((s, l) => s + l.proposed * l.unitCost, 0);
  const approvedTotal = lines.reduce((s, l) => s + (qty[l.id] ?? 0) * l.unitCost, 0);
  const trimmed = lines.filter((l) => (qty[l.id] ?? 0) < l.proposed).length;
  const reasons = [...new Set(decisions.filter((d) => !d.allowed && d.reason).map((d) => d.reason!))];

  const decide = (decision: DecisionKind) => {
    if (decision !== "approved" && !comment.trim()) return setError("Say why, so the centre can act on it.");
    if (decision === "approved" && lines.length && approvedTotal === 0) return setError("Approve at least one unit, or reject the request.");
    setError(undefined);
    start(async () => {
      try {
        const res = await decideApproval({
          approvalId, decision, comment: comment.trim() || undefined,
          lines: decision === "approved" && lines.length ? lines.map((l) => ({ requestItemId: l.id, approvedQty: qty[l.id] ?? 0 })) : undefined,
        });
        if (res.ok) toast({ tone: "success", title: "Decision recorded", body: res.message });
        else { setError(res.error); toast({ tone: "error", title: "Decision not saved", body: res.error }); }
      } catch {
        toast({ tone: "error", title: "Decision not saved", body: "The server could not be reached. Try again." });
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-4">
        {lines.length > 0 && (
          <Card aria-labelledby="review-lines-h" className="min-w-0">
            <CardHeader id="review-lines-h" icon={ListChecks} title="Line review" subtitle={canEdit ? "Trim any line before approving · history is the centre's 3-month average use" : "Proposed and approved quantities"} />
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[40rem] text-left text-label">
                <caption className="sr-only">Request lines with proposed, historical and approved quantities</caption>
                <thead className="text-[11px] text-ink-3">
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-2 font-medium">Product</th>
                    <th scope="col" className="py-2 pr-2 text-right font-medium">On hand</th>
                    <th scope="col" className="py-2 pr-2 text-right font-medium">3-mo avg</th>
                    <th scope="col" className="py-2 pr-2 text-right font-medium">Proposed</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Variance</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Approve</th>
                    <th scope="col" className="py-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const q = qty[l.id] ?? 0;
                    return (
                      <tr key={l.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 pr-2">
                          <Link href={`/inventory/catalogue?q=${l.sku}`} className="font-medium text-ink underline-offset-4 hover:underline">{l.product}</Link>
                          <span className="block text-[11.5px] text-ink-3">{l.sku} · {money(l.unitCost)}/{l.uom}</span>
                        </td>
                        <td className="py-2.5 pr-2 text-right tabular">{count(l.onHand)}</td>
                        <td className="py-2.5 pr-2 text-right tabular">{l.historical ? count(l.historical) : "—"}</td>
                        <td className="py-2.5 pr-2 text-right tabular">{count(l.proposed)}</td>
                        <td className="py-2.5 pr-2"><StatusBadge tone={l.variance.tone}>{l.variance.label}</StatusBadge></td>
                        <td className="py-2.5 pr-2">
                          {canEdit
                            ? <QuantityInput value={q} max={l.proposed} onChange={(n) => setQty((p) => ({ ...p, [l.id]: n }))} aria-describedby={`${commentId}-${l.id}`} />
                            : <span className="tabular">{count(q)}</span>}
                          <span id={`${commentId}-${l.id}`} className="sr-only">Approve quantity for {l.product}, at most {l.proposed}</span>
                        </td>
                        <td className={cn("py-2.5 text-right font-medium tabular", q < l.proposed && "text-orange")}>{money(q * l.unitCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex flex-wrap justify-between gap-2 text-label text-ink-3">
              <span>{trimmed ? `${trimmed} line${trimmed === 1 ? "" : "s"} trimmed` : "All lines at the proposed quantity"}</span>
              <span className="tabular">Approving <b className="font-medium text-ink">{money(approvedTotal)}</b> of {money(proposedTotal)}</span>
            </p>
          </Card>
        )}
        {children}
      </div>

      <div className="grid content-start gap-4">
        {budget && (
          <Card aria-labelledby="impact-h">
            <CardHeader id="impact-h" icon={Wallet} title="Budget impact" subtitle="This month's allocation · spent, committed and this approval" />
            <BudgetImpactBar impact={budgetImpact(budget, lines.length ? approvedTotal : 0)} requestLabel="This approval" />
          </Card>
        )}
        <Card aria-labelledby="decide-h">
          <CardHeader id="decide-h" icon={Scale} title={pending ? "Decision" : "Decided"} subtitle={pending ? "Saved to demo data (resets daily)" : `${decided?.by} · ${decided?.at}`} />
          {!pending ? (
            <div className="grid gap-3">
              {decided && <StatusBadge tone={decided.tone} dot className="justify-self-start text-label">{decided.label}</StatusBadge>}
              {decided?.note && <p className="rounded-tile bg-surface-2 px-4 py-3 text-label text-ink-2">“{decided.note}”</p>}
            </div>
          ) : (
            <div className="grid gap-4">
              {reasons.length > 0 && (
                <div role="note" className="flex gap-2.5 rounded-tile bg-surface-2 px-4 py-3 text-label text-ink-2">
                  <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                  <div className="grid gap-1">{reasons.map((r) => <p key={r}>{r}</p>)}</div>
                </div>
              )}
              {poLink && <Link href={poLink} className={buttonClass("primary", "md", "justify-self-start")}>Open purchase order</Link>}
              {decisions.some((d) => d.allowed) && (
                <>
                  <div className="grid gap-1.5">
                    <label htmlFor={commentId} className="text-label font-medium text-ink-2">Comment <span className="font-normal text-ink-3">· required to return or reject</span></label>
                    <textarea id={commentId} className={textareaClass} maxLength={1000} value={comment} onChange={(e) => { setComment(e.target.value); setError(undefined); }}
                      placeholder="e.g. Crayons are 40% above the usual — trim to 30 boxes and resubmit." aria-invalid={error ? true : undefined} aria-describedby={error ? `${commentId}-err` : undefined} />
                    {error && <p id={`${commentId}-err`} role="alert" className="text-[12px] text-red">{error}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {decisions.map((d) => {
                      const a = ACTIONS[d.decision];
                      return (
                        <Button key={d.decision} variant={a.variant} disabled={!d.allowed || busy} onClick={() => decide(d.decision)} title={d.reason}>
                          <a.icon />{a.label}
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
