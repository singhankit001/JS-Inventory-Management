import type { Metadata } from "next";
import { Boxes, Lock, PackageSearch, Siren, Truck, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ActivityTimeline, DataList, StatusCard } from "@/components/dashboard/lists";
import { Card, CardHeader, Eyebrow, StatTile } from "@/components/ui/card";
import { CountBadge, StatusBadge, type Tone } from "@/components/ui/badge";
import { EmptyState, ErrorState, PermissionDenied, Skeleton } from "@/components/ui/states";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { CategoryDistribution, ComparisonBars, Gauge, ProgressRing, Sparkline, TrendIndicator } from "@/components/charts/svg";
import { ButtonDemo, DialogDemo, FormDemo, Replay, SegmentedDemo } from "@/components/design-system/demos";
import { WorkflowStepper } from "@/components/ui/stepper";
import { ModulePageHeader } from "@/components/shell/module-header";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Design system" };

// Literal class names so Tailwind generates them.
const swatches: [string, [string, string][]][] = [
  ["Surfaces", [["canvas", "bg-canvas"], ["surface", "bg-surface"], ["surface-2", "bg-surface-2"], ["surface-3", "bg-surface-3"], ["line", "bg-line"], ["line-strong", "bg-line-strong"]]],
  ["Ink & emphasis", [["ink", "bg-ink"], ["ink-2", "bg-ink-2"], ["ink-3", "bg-ink-3"], ["primary-card", "bg-primary-card"], ["secondary-card", "bg-secondary-card"], ["pill", "bg-pill"]]],
  ["Data tones", [
    ["blue", "bg-blue"], ["blue-soft", "bg-blue-soft"], ["orange", "bg-orange"], ["orange-soft", "bg-orange-soft"], ["green", "bg-green"], ["green-soft", "bg-green-soft"],
    ["amber", "bg-amber"], ["amber-soft", "bg-amber-soft"], ["violet", "bg-violet"], ["violet-soft", "bg-violet-soft"], ["slate", "bg-slate"], ["slate-soft", "bg-slate-soft"],
    ["red", "bg-red"], ["red-soft", "bg-red-soft"],
  ]],
];
const typeScale: [string, string][] = [
  ["text-display", "text-display font-normal tracking-[-0.025em]"], ["text-metric-lg", "text-metric-lg font-medium tracking-[-0.03em] tabular"], ["text-metric", "text-metric font-medium tracking-[-0.02em] tabular"],
  ["text-title", "text-title font-normal tracking-[-0.01em]"], ["text-body", "text-body"], ["text-label", "text-label"], ["text-eyebrow", "text-eyebrow font-medium tracking-[0.12em] uppercase"],
];
const radii: [string, string][] = [["rounded-card · 22px", "rounded-card"], ["rounded-tile · 14px", "rounded-tile"], ["rounded-control · 12px", "rounded-control"], ["rounded-full", "rounded-full"]];
const shadows = ["shadow-card", "shadow-float", "shadow-pop"];
const motion: [string, string][] = [
  ["--dur-fast / --dur-base", "Hover, focus, menus, toasts"], ["--dur-lead / --dur-trail", "Sliding pill leading and trailing edges"], ["--dur-page", "Page and card enter (blur-fade)"],
  ["--ease-out-3", "power3.out — default for everything"], ["--ease-in-out-3", "power3.inOut — pill trailing edge"], ["--ease-spring", "Overshoot for cells and the gauge needle"],
];
const tones: Tone[] = ["neutral", "blue", "green", "orange", "amber", "red", "violet", "slate"];

const sections = [["tokens", "Colour"], ["type", "Type"], ["shape", "Shape"], ["motion", "Motion"], ["actions", "Actions"], ["badges", "Badges"], ["workflow", "Workflow & headers"], ["kpis", "KPI cards"], ["charts", "Charts"], ["lists", "Lists"], ["states", "States"], ["forms", "Forms"], ["overlays", "Overlays"]] as const;

function Section({ id, title, subtitle, children, className }: { id: string; title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card id={id} aria-labelledby={`${id}-h`} className={cn("scroll-mt-28", className)}>
      <CardHeader id={`${id}-h`} title={title} subtitle={subtitle} />
      {children}
    </Card>
  );
}

export default async function DesignSystemPage() {
  const session = await requirePermission("dashboard.admin");
  return (
    <>
      <PageHeader crumbs={[{ label: "Jumpstart", href: "/" }, { label: "Governance", href: "/modules/governance" }, { label: "Design system" }]} title="Design system"
        aside={<StatusBadge tone="amber">Sample values</StatusBadge>} />
      <nav aria-label="Design system sections" className="animate-enter -mt-2 mb-6 flex flex-wrap gap-1.5">
        {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full bg-surface-3/70 px-3 py-1 text-label text-ink-2 hover:bg-surface-3 hover:text-ink">{label}</a>)}
      </nav>

      <div className="stagger grid gap-4">
        <Section id="tokens" title="Colour tokens" subtitle="Tailwind theme names from globals.css — dark mode swaps the values, not the names">
          <div className="grid gap-5">
            {swatches.map(([group, list]) => (
              <div key={group}>
                <Eyebrow className="mb-2">{group}</Eyebrow>
                <ul className="grid grid-cols-2 gap-3 xs:grid-cols-3 md:grid-cols-6 xl:grid-cols-7">
                  {list.map(([name, cls]) => (
                    <li key={name}>
                      <div className={cn("h-14 rounded-tile ring-1 ring-line", cls)} aria-hidden />
                      <p className="mt-1.5 text-label font-medium">{name}</p>
                      <code className="text-[11px] text-ink-3">{cls}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Section id="type" title="Type scale" subtitle="Outfit Variable · titles light with negative tracking · numbers tabular">
            <ul className="grid gap-3">
              {typeScale.map(([name, cls]) => (
                <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line/60 pb-3 last:border-0">
                  <span className={cn("min-w-0", cls)}>{name.includes("metric") ? "₹4,82,150" : "Inventory valuation"}</span>
                  <code className="text-[11px] text-ink-3">{name}</code>
                </li>
              ))}
            </ul>
          </Section>
          <Section id="shape" title="Radii & elevation">
            <ul className="grid grid-cols-2 gap-3">
              {radii.map(([label, cls]) => <li key={cls} className="grid gap-1.5"><div className={cn("h-14 bg-surface-3", cls)} aria-hidden /><code className="text-[11px] text-ink-3">{label}</code></li>)}
            </ul>
            <ul className="mt-5 grid grid-cols-3 gap-3">
              {shadows.map((s) => <li key={s} className="grid gap-1.5"><div className={cn("h-16 rounded-tile bg-surface", s)} aria-hidden /><code className="text-[11px] text-ink-3">{s}</code></li>)}
            </ul>
          </Section>
        </div>

        <Section id="motion" title="Motion" subtitle="All motion is CSS and collapses under prefers-reduced-motion">
          <dl className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {motion.map(([token, use]) => <div key={token} className="rounded-tile bg-surface-2 px-3.5 py-2.5"><dt><code className="text-label font-medium">{token}</code></dt><dd className="text-[12px] text-ink-3">{use}</dd></div>)}
          </dl>
          <Replay label="motion">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2"><Eyebrow>animate-enter</Eyebrow><div className="animate-enter h-12 rounded-tile bg-blue-soft" /></div>
              <div className="grid gap-2"><Eyebrow>stagger</Eyebrow><div className="stagger grid grid-cols-4 gap-1.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-tile bg-surface-3" />)}</div></div>
              <div className="grid gap-2"><Eyebrow>bar-grow</Eyebrow><div className="h-2.5 rounded-full bg-surface-3"><div className="bar-grow h-full w-2/3 rounded-full bg-green" /></div></div>
              <div className="grid gap-2"><Eyebrow>cell-in</Eyebrow><div className="flex gap-1">{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="cell-in size-5 rounded-[5px] bg-violet" style={{ animationDelay: `${i * 50}ms` }} />)}</div></div>
              <div className="grid gap-2"><Eyebrow>ring-draw</Eyebrow><ProgressRing value={0.72} label="Sample ring" /></div>
              <div className="grid gap-2"><Eyebrow>animate-pop</Eyebrow><div className="animate-pop w-fit rounded-tile bg-surface px-3 py-2 text-label shadow-pop">Menu surface</div></div>
              <div className="grid gap-2"><Eyebrow>pulse-dot</Eyebrow><span className="flex items-center gap-2 text-label"><span className="pulse-dot size-2 rounded-full bg-green" aria-hidden />Live</span></div>
              <div className="grid gap-2"><Eyebrow>AnimatedNumber</Eyebrow><span className="text-metric font-medium tracking-[-0.02em]"><AnimatedNumber value={482150} format="money" /></span></div>
            </div>
          </Replay>
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section id="actions" title="Buttons" subtitle="Every variant and size · Phase-gated actions are visibly disabled">
            <ButtonDemo />
            <Eyebrow className="mt-5 mb-2">Segmented PillGroup</Eyebrow>
            <SegmentedDemo />
          </Section>
          <Section id="badges" title="Badges & tiles">
            <div className="flex flex-wrap gap-2">{tones.map((t) => <StatusBadge key={t} tone={t}>{t}</StatusBadge>)}</div>
            <div className="mt-3 flex flex-wrap gap-2">{tones.map((t) => <StatusBadge key={t} tone={t} dot>{t}</StatusBadge>)}</div>
            <div className="mt-4 flex items-center gap-3 text-label text-ink-2">CountBadge <CountBadge count={4} /> <CountBadge count={128} /></div>
            <div className="mt-4 grid grid-cols-3 gap-2"><StatTile label="Stock value" value="₹1.2L" /><StatTile label="Units" value="3,410" /><StatTile label="SKUs" value="64" /></div>
            <div className="mt-3"><StatusCard label="Email notifications" status="Not configured" tone="amber" detail="StatusCard" /></div>
          </Section>
        </div>

        <Section id="workflow" title="WorkflowStepper & ModulePageHeader" subtitle="Progress for requests, approvals, POs, invoices and AI jobs · sample values">
          <div className="grid gap-6">
            <div><Eyebrow className="mb-3">In progress</Eyebrow><WorkflowStepper label="Sample request progress" steps={[
              { label: "Submitted", state: "done", at: "22 Oct" }, { label: "Head Office review", state: "done", at: "23 Oct" },
              { label: "Purchase order", state: "current", detail: "Awaiting authorisation" }, { label: "Received", state: "upcoming" }, { label: "Invoice matched", state: "upcoming" },
            ]} /></div>
            <div><Eyebrow className="mb-3">Blocked</Eyebrow><WorkflowStepper label="Sample AI job progress" steps={[
              { label: "Queued", state: "done" }, { label: "Processing", state: "blocked", detail: "Failed — needs a retry" }, { label: "Needs review", state: "upcoming" }, { label: "Completed", state: "upcoming" },
            ]} /></div>
            <div>
              <Eyebrow className="mb-3">ModulePageHeader · breadcrumbs, title, description, module sub-nav, aside</Eyebrow>
              {/* inert: a specimen, so its h1 and links stay out of the page's outline and tab order */}
              <div inert className="rounded-tile border border-dashed border-line-strong p-4 sm:p-5 [&>header]:mb-0">
                <ModulePageHeader role={session.role} module="admin" active="users" title="Centres & users" description="Who can sign in, what they can do and which centres they see." aside={<StatusBadge tone="green" dot>Sample aside</StatusBadge>} />
              </div>
            </div>
          </div>
        </Section>

        <Section id="kpis" title="KPI cards" subtitle="One primary and one secondary per row, the rest plain · sample values">
          <Replay label="KPI">
            <div className="stagger grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-4">
              <KpiCard variant="primary" icon={Wallet} label="Procurement spend" value={<AnimatedNumber value={4820000} format="moneyCompact" />} spark={[3, 5, 4, 6, 7, 6, 8]} footnote={<TrendIndicator direction="up">12% vs last month</TrendIndicator>} />
              <KpiCard variant="secondary" icon={Siren} label="Critical approvals" value={<AnimatedNumber value={3} />} footnote={<span>9 pending in total</span>} />
              <KpiCard icon={Boxes} label="Budget utilisation" value={<AnimatedNumber value={0.78} format="percent" />} spark={[0.4, 0.5, 0.55, 0.62, 0.7, 0.78]} sparkTone="green" footnote={<TrendIndicator direction="flat" good>Month to date</TrendIndicator>} />
              <KpiCard icon={Truck} label="Open purchase orders" value={<AnimatedNumber value={14} />} spark={[9, 11, 10, 13, 12, 14]} sparkTone="orange" footnote={<TrendIndicator direction="down" good={false}>2 delayed</TrendIndicator>} />
            </div>
          </Replay>
        </Section>

        <Section id="charts" title="Charts" subtitle="Dependency-free SVG primitives · sample values">
          <Replay label="chart">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <div className="grid content-start gap-3">
                <Eyebrow>Sparkline · TrendIndicator</Eyebrow>
                <div className="flex items-center gap-4"><Sparkline data={[4, 6, 5, 8, 7, 9, 11]} tone="blue" label="Sample sparkline" /><TrendIndicator direction="up" good>18% up</TrendIndicator></div>
                <Eyebrow className="mt-3">ProgressRing</Eyebrow>
                <div className="flex gap-3">{(["green", "amber", "red"] as const).map((t, i) => <ProgressRing key={t} value={[0.94, 0.82, 0.61][i]!} tone={t} size={48} stroke={5} label={`Sample ${t} ring`} />)}</div>
              </div>
              <div><Eyebrow className="mb-2">Gauge</Eyebrow><Gauge value={0.88} target={0.92} label="Sample on-time delivery" caption="Target 92%" /></div>
              <div className="grid content-start gap-5">
                <div><Eyebrow className="mb-3">CategoryDistribution</Eyebrow><CategoryDistribution label="Sample stock value by category" segments={[{ label: "Art & craft", value: 42, tone: "blue" }, { label: "Hygiene", value: 28, tone: "green" }, { label: "Play", value: 18, tone: "violet" }, { label: "Safety", value: 12, tone: "slate" }]} /></div>
                <div><Eyebrow className="mb-3">ComparisonBars</Eyebrow><ComparisonBars label="Sample spend by centre" rows={[{ label: "Baner", value: 82, display: "₹82k", tone: "blue", marker: 90 }, { label: "Wakad", value: 64, display: "₹64k", tone: "blue", marker: 60 }, { label: "Koramangala", value: 41, display: "₹41k", tone: "blue", marker: 55 }]} /></div>
              </div>
            </div>
          </Replay>
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section id="lists" title="DataList & ActivityTimeline" subtitle="Sample values">
            <DataList label="Sample stock list" empty="Nothing here" rows={[
              { id: "1", title: "Hand wash 500 ml", sub: "2 on hand · reorder at 10", icon: PackageSearch, tone: "red", badge: { label: "Critical", tone: "red" } },
              { id: "2", title: "Crayons (12 pack)", sub: "8 on hand · reorder at 12", icon: PackageSearch, badge: { label: "Low", tone: "amber" } },
              { id: "3", title: "Building blocks (100)", sub: "Most value here", icon: Boxes, value: "₹18,400" },
            ]} />
            <div className="mt-5">
              <ActivityTimeline items={[
                { id: "a", actor: "Priya Shah", action: "approved", subject: "Monthly request · Viman Nagar", at: "2 hours ago", tone: "green" },
                { id: "b", actor: "Arjun Mehta", action: "issued", subject: "PO-2400 · Crayonworks", at: "yesterday", tone: "blue" },
                { id: "c", actor: "Neha Iyer", action: "raised query", subject: "INV-8801 · price mismatch", at: "2 days ago" },
              ]} />
            </div>
          </Section>
          <Section id="states" title="States" subtitle="Empty, error, loading and permission">
            <div className="grid gap-3 sm:grid-cols-2">
              <EmptyState title="No deliveries today" body="New purchase orders appear here." className="py-6" />
              <ErrorState title="Chart failed to load" body="Other widgets keep working." />
              <PermissionDenied body="Shown when a role lacks the permission." />
              <div aria-label="Skeleton sample" className="grid content-center gap-2 rounded-tile border border-dashed border-line-strong p-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-3/4" /><Skeleton className="h-16 w-full" /></div>
            </div>
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Section id="forms" title="Form fields" subtitle="Field wires label, hint, error and aria for its control">
            <FormDemo />
          </Section>
          <Section id="overlays" title="Dialogs & toasts" subtitle="Radix dialogs with focus trap · toasts announce politely">
            <DialogDemo />
            <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-3"><Lock className="size-3.5" aria-hidden />Demos change nothing — no data is written.</p>
          </Section>
        </div>
      </div>
    </>
  );
}
