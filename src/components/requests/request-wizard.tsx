"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ListPlus, Save, Send, Sparkles, TriangleAlert, Wallet } from "lucide-react";
import { saveDraftRequest, submitRequest } from "@/app/actions/requests";
import type { NewRequestState } from "@/features/requests/new";
import { budgetImpact, variance } from "@/features/requests/logic";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PillGroup } from "@/components/ui/pill-group";
import { WorkflowStepper, type StepState } from "@/components/ui/stepper";
import { QuantityInput, SearchInput, Select } from "@/components/forms/fields";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/feedback/toast";
import { BudgetImpactBar } from "./budget-impact";
import { textareaClass } from "./approval-review";
import { count, money, moneyCompact } from "@/lib/format";
import { cn } from "@/lib/cn";

type Data = Extract<NewRequestState, { kind: "form" }>;
const STEPS = ["Items", "Review", "Submit"];

/**
 * Three-step request builder: pick quantities (suggested from 3-month use, stock and open orders), review against budget
 * headroom, then save as a draft or submit to Head Office. Server actions re-validate everything.
 */
export function RequestWizard({ data }: { data: Data }) {
  const router = useRouter();
  const toast = useToast();
  const noteId = useId();
  const [busy, start] = useTransition();
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>(data.initial);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState(data.edit?.id);

  const chosen = data.products.filter((p) => (qty[p.id] ?? 0) > 0);
  const total = chosen.reduce((s, p) => s + qty[p.id]! * p.unitCost, 0);
  const impact = budgetImpact(data.budget, total);
  const flagged = chosen.filter((p) => variance(qty[p.id]!, Math.round(p.avgUse)).flagged).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [data.products, query]);
  const set = (id: string, n: number) => { setQty((prev) => ({ ...prev, [id]: n })); setError(undefined); };
  const payload = () => ({ requestId, centreId: data.centre.id, period: data.period, items: chosen.map((p) => ({ productId: p.id, proposedQty: qty[p.id]! })) });
  const href = (centre: string, period: string) => `/requests/new?centre=${centre}&period=${period}`;

  const next = () => {
    if (step === 0 && !chosen.length) return setError("Add at least one item — use the suggestions or enter quantities.");
    setError(undefined);
    setStep((s) => Math.min(2, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = () => start(async () => {
    try {
      const res = await saveDraftRequest(payload());
      if (!res.ok) { setError(res.error); toast({ tone: "error", title: "Draft not saved", body: res.error }); return; }
      toast({ tone: "success", title: "Draft saved", body: res.message });
      if (!requestId && res.data) { setRequestId(res.data.id); router.replace(`/requests/new?edit=${res.data.id}`, { scroll: false }); }
    } catch { toast({ tone: "error", title: "Draft not saved", body: "The server could not be reached. Try again." }); }
  });
  const submit = () => start(async () => {
    if (!chosen.length) return setError("Add at least one item before submitting.");
    try {
      const res = await submitRequest(payload(), note);
      if (!res.ok) { setError(res.error); toast({ tone: "error", title: "Request not submitted", body: res.error }); return; }
      toast({ tone: "success", title: "Request submitted", body: res.message });
      router.push(`/requests/${res.data!.id}`);
    } catch { toast({ tone: "error", title: "Request not submitted", body: "The server could not be reached. Try again." }); }
  });

  const steps = STEPS.map((label, i) => ({ label, state: (i < step ? "done" : i === step ? "current" : "upcoming") as StepState }));

  return (
    <div className="grid gap-4">
      <Card aria-labelledby="wizard-h">
        <CardHeader id="wizard-h" icon={ListPlus} title={`${data.centre.name} · ${data.periodLabel}`}
          subtitle={`${data.edit ? (data.edit.status === "revision_requested" ? "Returned for revision — edit and resubmit" : "Continuing a draft") : "New routine request"} · due ${data.deadline}`}
          action={!data.edit && (
            <div className="flex max-w-full flex-wrap items-center gap-2">
              {data.centres.length > 1 && (
                <Select aria-label="Centre" value={data.centre.id} onChange={(e) => router.push(href(e.target.value, data.period))} className="h-9 w-48">
                  {data.centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
              <PillGroup ariaLabel="Request period" activeKey={data.period}
                items={data.periods.map((p) => ({ key: p.key, label: p.taken ? `${p.label} · ${p.taken.toLowerCase()}` : p.label, href: href(data.centre.id, p.key) }))} />
            </div>
          )} />
        <WorkflowStepper steps={steps} label="Request steps" />
      </Card>

      {step === 0 && (
        <Card aria-labelledby="items-h">
          <CardHeader id="items-h" icon={Sparkles} title="Choose items" subtitle="Suggested = next month's average use + reorder point − on hand − on order"
            action={<div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setQty(Object.fromEntries(data.products.map((p) => [p.id, p.suggested])))}><Sparkles />Use all suggestions</Button>
              {chosen.length > 0 && <Button size="sm" variant="ghost" onClick={() => setQty({})}>Clear</Button>}
            </div>} />
          <SearchInput aria-label="Search products" placeholder="Search products or SKU…" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2 w-full sm:w-72" />
          {!visible.length && <EmptyState title="No products match" body="Clear the search to see the full catalogue." className="py-8" />}
          {data.categories.map((c) => {
            const rows = visible.filter((p) => p.categoryId === c.id);
            if (!rows.length) return null;
            const picked = rows.filter((p) => (qty[p.id] ?? 0) > 0);
            return (
              <section key={c.id} aria-labelledby={`cat-${c.id}`} className="mt-4">
                <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                  <h3 id={`cat-${c.id}`} className="text-body font-medium">{c.name}</h3>
                  <span className="text-[12px] text-ink-3 tabular">{picked.length} of {rows.length} · {money(picked.reduce((s, p) => s + qty[p.id]! * p.unitCost, 0))}</span>
                </div>
                <ul>
                  {rows.map((p) => {
                    const q = qty[p.id] ?? 0;
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line/60 py-3 last:border-0">
                        <div className="min-w-0 flex-1 basis-52">
                          <p className="truncate text-body font-medium">{p.name}</p>
                          <p className="text-[12px] text-ink-3">{p.sku} · {money(p.unitCost)}/{p.uom}</p>
                        </div>
                        <dl className="flex gap-4 text-[12px]">
                          {[["On hand", p.onHand, p.onHand <= p.reorderPoint], ["On order", p.onOrder, false], ["3-mo avg", p.avgUse, false]].map(([label, value, low]) => (
                            <div key={String(label)} className="w-16">
                              <dt className="text-ink-3">{label}</dt>
                              <dd className={cn("font-medium tabular", low === true && "text-orange")}>{count(Number(value))}{low === true ? <span className="sr-only"> (at or below reorder point)</span> : null}</dd>
                            </div>
                          ))}
                        </dl>
                        <Button size="sm" variant={q === p.suggested ? "ghost" : "secondary"} className="w-32" disabled={!p.suggested || q === p.suggested} onClick={() => set(p.id, p.suggested)}
                          aria-label={`Use suggested quantity ${p.suggested} for ${p.name}`}>
                          {p.suggested ? `Suggest ${count(p.suggested)}` : "Stocked"}
                        </Button>
                        <div className="w-40"><QuantityInput value={q} onChange={(n) => set(p.id, n)} aria-describedby={`${p.id}-name`} /></div>
                        <span id={`${p.id}-name`} className="sr-only">Quantity of {p.name} in {p.uom}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </Card>
      )}

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card aria-labelledby="review-h" className="min-w-0">
            <CardHeader id="review-h" icon={ListPlus} title="Review lines" subtitle={`${chosen.length} lines · ${flagged} more than ±25% from 3-month use`} action={<Button size="sm" variant="ghost" onClick={() => setStep(0)}>Edit items</Button>} />
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[28rem] text-left text-label">
                <caption className="sr-only">Items in this request</caption>
                <thead className="text-[11px] text-ink-3"><tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-2 font-medium">Product</th><th scope="col" className="py-2 pr-2 text-right font-medium">Qty</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">3-mo avg</th><th scope="col" className="py-2 pr-2 font-medium">Variance</th><th scope="col" className="py-2 text-right font-medium">Value</th>
                </tr></thead>
                <tbody>
                  {chosen.map((p) => {
                    const v = variance(qty[p.id]!, Math.round(p.avgUse));
                    return (
                      <tr key={p.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 pr-2 font-medium">{p.name}</td>
                        <td className="py-2.5 pr-2 text-right tabular">{count(qty[p.id]!)} {p.uom}</td>
                        <td className="py-2.5 pr-2 text-right tabular">{p.avgUse ? count(p.avgUse) : "—"}</td>
                        <td className="py-2.5 pr-2"><StatusBadge tone={v.tone}>{v.label}</StatusBadge></td>
                        <td className="py-2.5 text-right tabular">{money(qty[p.id]! * p.unitCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid content-start gap-4">
            <Card aria-labelledby="impact-h">
              <CardHeader id="impact-h" icon={Wallet} title="Budget impact" subtitle={`${data.periodLabel} allocation`} />
              <BudgetImpactBar impact={impact} />
              {impact.over && (
                <p role="note" className="mt-4 flex gap-2 rounded-tile bg-red-soft px-3.5 py-2.5 text-label text-ink">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />Over the remaining budget by {moneyCompact(-impact.after)}. You can still submit; Head Office may trim lines.
                </p>
              )}
            </Card>
            <Card aria-labelledby="note-h">
              <CardHeader id="note-h" title="Note to Head Office" subtitle="Optional · saved with the submission in the audit trail" />
              <textarea id={noteId} aria-labelledby="note-h" className={textareaClass} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Extra paint for the Diwali art week." />
            </Card>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card aria-labelledby="confirm-h">
          <CardHeader id="confirm-h" icon={Send} title="Submit to Head Office" subtitle="Submitting opens a Head Office approval round. Writes go to demo data, which resets daily." />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Lines" value={`${chosen.length} · ${flagged} flagged`} />
            <StatTile label="Total" value={money(total)} />
            <StatTile label="Budget after" value={impact.over ? `${moneyCompact(-impact.after)} over` : `${moneyCompact(impact.after)} left`} />
            <StatTile label="Due" value={data.deadline} />
          </div>
          {note.trim() && <p className="mt-4 rounded-tile bg-surface-2 px-4 py-3 text-label text-ink-2">“{note.trim()}”</p>}
        </Card>
      )}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-float backdrop-blur" aria-label="Request totals and actions" role="group">
        <p className="mr-auto text-label text-ink-3 tabular">
          <b className="font-medium text-ink">{chosen.length}</b> lines · <b className="font-medium text-ink">{money(total)}</b>
          <span className={cn("ml-2", impact.over ? "text-red" : "text-ink-3")}>{impact.over ? `${moneyCompact(-impact.after)} over budget` : `${moneyCompact(impact.after)} headroom after`}</span>
        </p>
        {error && <p role="alert" className="basis-full text-[12px] text-red sm:order-first">{error}</p>}
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft />Back</Button>}
        <Button onClick={save} disabled={busy}><Save />Save draft</Button>
        {step < 2 ? <Button variant="primary" onClick={next} disabled={busy}>Next<ArrowRight /></Button>
          : <Button variant="primary" onClick={submit} disabled={busy || !chosen.length}><Send />{data.edit?.status === "revision_requested" ? "Resubmit" : "Submit"}</Button>}
      </div>
      {requestId && <p className="text-[12px] text-ink-3">Saved as <Link href={`/requests/${requestId}`} className="underline underline-offset-4 hover:text-ink">{requestId}</Link>.</p>}
    </div>
  );
}
