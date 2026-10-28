import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { ArrowRight, FlaskConical, Mic, PackageCheck, Quote, TriangleAlert } from "lucide-react";
import { requireSession, scopedRepository } from "@/lib/auth/session";
import { JOURNEY_CENTRE, JOURNEY_ROLES, loadJourney, type Journey } from "@/features/pipeline/journey";
import { PageHeader } from "@/components/dashboard/page-header";
import { JourneyView, type JourneyStage } from "@/components/pipeline/journey-view";
import { StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { money, percent, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Request journey" };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => `${shortDate(iso)} · ${time(iso)}`;
const th = "pb-2 text-left text-[11.5px] font-medium tracking-[0.04em] text-ink-3 uppercase";
const td = "border-t border-line/70 py-2.5 align-top";

// Deterministic waveform for the recording placeholder.
const WAVE = Array.from({ length: 64 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.61) * Math.cos(i * 0.23)));

function Note({ tone = "neutral", icon: Icon = FlaskConical, children }: { tone?: "neutral" | "amber"; icon?: typeof FlaskConical; children: React.ReactNode }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-tile px-3.5 py-2.5 text-label", tone === "amber" ? "bg-amber-soft text-amber" : "bg-surface-2 text-ink-2")}>
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function VoicePanel({ j }: { j: Journey }) {
  let rest = j.transcript;
  const parts: React.ReactNode[] = [];
  for (const l of j.lines) {
    const i = rest.indexOf(l.heard);
    if (i < 0) continue;
    parts.push(rest.slice(0, i), <mark key={l.id} className="rounded-[5px] bg-blue-soft px-1 text-ink">{l.heard}</mark>);
    rest = rest.slice(i + l.heard.length);
  }
  parts.push(rest);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-[18px] bg-primary-card p-5 text-primary-card-ink">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-label"><Mic className="size-4" />Voice note · {j.centre.name}</span>
          <span className="text-label text-primary-card-ink-2 tabular">0:{String(j.durationSec).padStart(2, "0")}</span>
        </div>
        <div className="mt-6 flex h-16 items-center gap-[3px]" aria-hidden>
          {WAVE.map((h, i) => <span key={i} className="flex-1 rounded-full bg-primary-card-ink/70" style={{ height: `${Math.round(h * 100)}%`, opacity: i < 40 ? 1 : 0.35 }} />)}
        </div>
        <p className="mt-6 text-[12px] text-primary-card-ink-2">Recorded on the centre phone for {j.forPeriod}. Audio playback is a placeholder in this demo.</p>
      </div>
      <div>
        <p className="mb-2 text-[11.5px] font-medium tracking-[0.04em] text-ink-3 uppercase">Transcript</p>
        <blockquote className="text-[15px] leading-relaxed text-ink-2 text-pretty">“{parts}”</blockquote>
        <p className="mt-4 text-label text-ink-3">{j.lines.length} items detected · highlighted phrases become request lines in the next step.</p>
      </div>
    </div>
  );
}

function IntakePanel({ j }: { j: Journey }) {
  return (
    <div className="grid gap-4">
      <Note tone="amber">AI intake is under development. This draft is a demo placeholder showing how a voice note becomes structured lines; no audio is processed.</Note>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-body">
          <thead><tr><th className={th}>Heard</th><th className={th}>Matched product</th><th className={cn(th, "text-right")}>Qty</th><th className={th}>Confidence</th><th className={cn(th, "text-right")}>Value</th></tr></thead>
          <tbody>
            {j.lines.map((l) => (
              <tr key={l.id}>
                <td className={cn(td, "pr-4 text-ink-3 italic")}>“{l.heard}”</td>
                <td className={cn(td, "pr-4")}><span className="font-medium">{l.product}</span><span className="block text-[11.5px] text-ink-3">{l.sku} · {l.category}</span></td>
                <td className={cn(td, "pr-4 text-right tabular")}>{l.qty} <span className="text-ink-3">{l.uom}</span></td>
                <td className={cn(td, "pr-4")}>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3"><span className={cn("block h-full rounded-full", l.confidence >= 0.9 ? "bg-green" : "bg-amber")} style={{ width: `${l.confidence * 100}%` }} /></span>
                    <span className="text-label tabular">{percent(l.confidence)}</span>
                  </span>
                  {l.confidence < 0.9 && <span className="mt-1 block text-[11.5px] text-amber">Kavya confirmed the match</span>}
                </td>
                <td className={cn(td, "text-right tabular")}>{money(l.qty * l.unitCost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4} className={cn(td, "font-medium")}>Draft total</td><td className={cn(td, "text-right font-medium tabular")}>{money(j.totals.requested)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

function ApprovalPanel({ j }: { j: Journey }) {
  const share = j.totals.approved / j.totals.allocation;
  const edited = j.lines.filter((l) => l.approved !== l.qty);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-2 sm:grid-cols-2">
        <StatTile label="Requested" value={money(j.totals.requested)} />
        <StatTile label="Approved" value={money(j.totals.approved)} />
        <StatTile label="Baner monthly budget" value={money(j.totals.allocation)} />
        <StatTile label="Share of budget" value={percent(share)} />
      </div>
      <div className="grid content-start gap-3">
        <p className="text-[11.5px] font-medium tracking-[0.04em] text-ink-3 uppercase">Head Office checked</p>
        <ul className="grid gap-2 text-body text-ink-2">
          <li>Each line against Baner&apos;s 3-month average use</li>
          <li>The request against this month&apos;s allocation and open commitments</li>
          <li>Prices against the approved supplier catalogue</li>
        </ul>
        {edited.map((l) => (
          <div key={l.id} className="rounded-tile border border-line p-3.5">
            <p className="text-body"><span className="font-medium">{l.product}</span>: <s className="text-ink-3">{l.qty}</s> → <b className="tabular">{l.approved}</b> {l.uom}</p>
            <p className="mt-1 flex gap-2 text-label text-ink-3"><Quote className="mt-0.5 size-3.5 shrink-0" aria-hidden />{l.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PurchasingPanel({ j }: { j: Journey }) {
  return (
    <div className="grid gap-4">
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {j.orders.map((o) => (
          <li key={o.id} className="rounded-tile border border-line p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-label">{o.po}</span>
              <StatusBadge tone="green" dot>Received</StatusBadge>
            </div>
            <p className="mt-2 truncate text-body font-medium">{o.supplier}</p>
            <p className="text-label text-ink-3">{o.lines} line{o.lines === 1 ? "" : "s"} · {o.lead}-day lead time</p>
            <p className="mt-3 text-metric font-light tracking-[-0.02em] tabular">{money(o.total)}</p>
          </li>
        ))}
      </ul>
      <Note icon={PackageCheck}>Approved lines were split by category into {j.orders.length} purchase orders with the approved suppliers. Deliveries reached Baner by {when(j.timeline.delivered)}, where Receiving checked them against each PO.</Note>
    </div>
  );
}

function FinancePanel({ j }: { j: Journey }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Invoiced" value={money(j.totals.invoiced)} />
        <StatTile label="Payable now" value={money(j.totals.payable)} />
        <StatTile label="Held for query" value={money(j.totals.held)} />
        <StatTile label="Payment due" value={shortDate(j.timeline.due)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-body">
          <thead><tr><th className={th}>Invoice</th><th className={th}>Supplier · PO</th><th className={cn(th, "text-right")}>Billed</th><th className={cn(th, "text-right")}>Received</th><th className={th}>Three-way match</th></tr></thead>
          <tbody>
            {j.orders.map((o) => (
              <tr key={o.id}>
                <td className={cn(td, "pr-4 font-mono text-label")}>{o.invoice}</td>
                <td className={cn(td, "pr-4")}>{o.supplier}<span className="block text-[11.5px] text-ink-3">{o.po}</span></td>
                <td className={cn(td, "pr-4 text-right tabular")}>{money(o.invoiced)}</td>
                <td className={cn(td, "pr-4 text-right tabular")}>{money(o.received)}</td>
                <td className={td}><StatusBadge tone={o.match.tone} dot>{o.match.label}</StatusBadge><span className="mt-1 block text-[11.5px] text-ink-3">{o.match.detail}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note tone="amber" icon={TriangleAlert}>Finance pays matched invoices on terms and holds the difference on any line billed above what Baner received until the supplier issues a credit note.</Note>
    </div>
  );
}

function ExecutivePanel({ j }: { j: Journey }) {
  const trimmed = 1 - j.totals.approved / j.totals.requested;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-2 sm:grid-cols-2">
        <StatTile label="Voice note → invoice match" value={`${j.cycleDays} days`} />
        <StatTile label="Trimmed at approval" value={percent(trimmed)} />
        <StatTile label="Of Baner's monthly budget" value={percent(j.totals.approved / j.totals.allocation)} />
        <StatTile label="Held pending credit" value={money(j.totals.held)} />
      </div>
      <div className="grid content-start gap-3">
        <p className="text-body text-ink-2 text-pretty">The CEO doesn&apos;t see line items. This request appears as part of Baner&apos;s spend, the network&apos;s approval and procurement cycle times, and supplier on-time performance on the executive dashboard.</p>
        <Link href="/dashboards/executive" className={cn(buttonClass("secondary", "sm"), "w-fit")}>Open the executive dashboard<ArrowRight /></Link>
      </div>
    </div>
  );
}

export default async function JourneyPage() {
  const session = await requireSession();
  if (!JOURNEY_ROLES.includes(session.role)) forbidden();
  const { repo } = scopedRepository(session);
  // Centre isolation: the walkthrough follows Baner, so only sessions that may read Baner see it.
  if (!session.centres.some((c) => c.id === JOURNEY_CENTRE)) forbidden();
  const j = await loadJourney(repo);
  const panels: Record<JourneyStage["key"], React.ReactNode> = {
    voice: <VoicePanel j={j} />, intake: <IntakePanel j={j} />, approval: <ApprovalPanel j={j} />,
    purchasing: <PurchasingPanel j={j} />, finance: <FinancePanel j={j} />, executive: <ExecutivePanel j={j} />,
  };
  const stages: JourneyStage[] = j.stages.map((s) => ({ key: s.key, title: s.title, owner: s.owner, status: s.status, when: when(s.at), panel: panels[s.key] }));

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: "Requests", href: "/requests" }, { label: "Journey" }]}
        title="Request journey"
        description={<>One monthly request from <b className="font-medium text-ink">{j.centre.name}</b> for {j.forPeriod}, followed from Kavya Nair&apos;s voice note to the CEO&apos;s dashboard. Pick a step to see what each person reviews.</>}
        aside={<StatusBadge tone="amber" dot>Demo scenario · simulated data</StatusBadge>}
      />
      <JourneyView stages={stages} current={j.current} />
    </>
  );
}
