import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX2, Hourglass, PackageMinus, ShoppingCart, Siren } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadAlerts } from "@/features/inventory/alerts";
import { ModulePageHeader } from "@/components/shell/module-header";
import { CentrePicker } from "@/components/inventory/centre-picker";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { TipGroup } from "@/components/ui/float-tip";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { count, money } from "@/lib/format";

export const metadata: Metadata = { title: "Low stock & expiry alerts" };

export default async function Alerts({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("inventory.read");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadAlerts(repo);
  const canRequest = can(session.role, "requests.create");

  return (
    <>
      <ModulePageHeader role={session.role} module="inventory" active="alerts" title="Low stock & expiry alerts"
        description={`${centre?.name ?? `${d.centresAffected} of ${d.centreCount} centres affected`} · suggested quantities restore stock to twice the reorder point`}
        aside={<CentrePicker centres={session.centres.map((c) => ({ id: c.id, name: c.name }))} value={centre?.id} />} />

      <MetricGrid>
        <KpiCard variant="primary" icon={Siren} label="Critical lines" value={<AnimatedNumber value={d.critical} />} footnote={<span>At or below half the reorder point</span>} />
        <KpiCard variant="secondary" icon={PackageMinus} label="Low lines" value={<AnimatedNumber value={d.low} />} footnote={<span>At or below the reorder point</span>} />
        <KpiCard icon={ShoppingCart} label="Suggested reorder value" value={<AnimatedNumber value={d.reorderValue} format="moneyCompact" />} footnote={<span>{count(d.reorderUnits)} units at current unit cost</span>} />
        <KpiCard icon={Hourglass} label="Shortest cover" value={d.shortestCover === null ? "—" : <><AnimatedNumber value={d.shortestCover} /> days</>} footnote={<span>At the last 90 days&apos; usage rate</span>} />
      </MetricGrid>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="stagger grid gap-4">
          {d.groups.length === 0 && <Card><EmptyState title="No low stock" body="Every SKU is above its reorder point in the centres you can see." /></Card>}
          {d.groups.map((g) => (
            <Card key={g.id} aria-labelledby={`al-${g.id}`}>
              <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 id={`al-${g.id}`} className="text-title font-normal tracking-[-0.01em]"><Link href={`/inventory/centres/${g.id}`} className="underline-offset-4 hover:underline">{g.name}</Link></h2>
                <span className="text-label text-ink-3">{g.city}</span>
                <span className="ml-auto flex gap-1.5">
                  {g.items.some((i) => i.state === "critical") && <StatusBadge tone="red">{g.items.filter((i) => i.state === "critical").length} critical</StatusBadge>}
                  {g.items.some((i) => i.state === "low") && <StatusBadge tone="amber">{g.items.filter((i) => i.state === "low").length} low</StatusBadge>}
                </span>
              </header>
              <div className="-mx-1 overflow-x-auto">
                <TipGroup className="contents"><table className="w-full border-separate border-spacing-0 text-left text-body">
                  <caption className="sr-only">{g.name} low stock</caption>
                  <thead>
                    <tr className="text-[11.5px] text-ink-3">
                      <th scope="col" className="border-b border-line px-2 py-2 font-medium">Product</th>
                      <th scope="col" className="border-b border-line px-2 py-2 text-right font-medium">On hand</th>
                      <th scope="col" className="hidden border-b border-line px-2 py-2 text-right font-medium sm:table-cell">Reorder at</th>
                      <th scope="col" className="border-b border-line px-2 py-2 text-right font-medium">Cover</th>
                      <th scope="col" className="border-b border-line px-2 py-2 text-right font-medium">Suggest</th>
                      <th scope="col" className="hidden border-b border-line px-2 py-2 font-medium md:table-cell">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((i) => (
                      <tr key={i.id} className="hover:bg-surface-2">
                        <td className="border-b border-line/60 px-2 py-2.5"><Link href={`/inventory/catalogue?q=${i.sku}`} className="font-medium underline-offset-4 hover:underline">{i.name}</Link><span className="block text-[11.5px] text-ink-3 md:hidden">{i.badge.label}</span></td>
                        <td className="border-b border-line/60 px-2 py-2.5 text-right tabular">{count(i.onHand)} <span className="text-ink-3">{i.uom}</span></td>
                        <td className="hidden border-b border-line/60 px-2 py-2.5 text-right tabular sm:table-cell">{i.reorderPoint}</td>
                        <td className={`border-b border-line/60 px-2 py-2.5 text-right tabular ${i.cover !== null && i.cover < 7 ? "font-medium text-red" : ""}`}>{i.coverLabel}</td>
                        <td className="border-b border-line/60 px-2 py-2.5 text-right font-medium tabular" data-tip={`${money(i.reorderValue)} at unit cost`}>+{count(i.reorder)}</td>
                        <td className="hidden border-b border-line/60 px-2 py-2.5 md:table-cell"><StatusBadge tone={i.badge.tone} dot>{i.badge.label}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table></TipGroup>
              </div>
            </Card>
          ))}
        </div>

        <div className="stagger grid gap-4 xl:sticky xl:top-4">
          <Card aria-label="Expiry tracking">
            <CardHeader icon={CalendarX2} title="Expiry alerts" subtitle="Not available yet" action={<StatusBadge tone="neutral">Phase 2</StatusBadge>} />
            <p className="text-body text-ink-2">Expiry tracking needs batch data (Phase 2). Products are tracked as one balance per centre today, without batch or lot numbers, so there are no expiry dates to warn about — we don&apos;t show estimated ones.</p>
            <Eyebrow className="mt-4 mb-1.5">What Phase 2 adds</Eyebrow>
            <ul className="grid gap-1 text-label text-ink-3">
              <li>Batch and expiry date captured at goods receipt</li>
              <li>First-expiry-first-out consumption per batch</li>
              <li>Warnings 30 and 7 days before expiry (pantry, first aid, hygiene)</li>
            </ul>
          </Card>
          <Card aria-label="How suggestions are calculated">
            <CardHeader icon={Hourglass} title="How this is worked out" />
            <ul className="grid gap-2 text-label text-ink-2">
              <li><b className="font-medium text-ink">Critical</b> — on hand at or below half the reorder point; <b className="font-medium text-ink">low</b> — at or below it.</li>
              <li><b className="font-medium text-ink">Cover</b> — on hand ÷ average daily use over the last 90 days.</li>
              <li><b className="font-medium text-ink">Suggest</b> — units to bring stock to twice the reorder point. Excludes stock already on order.</li>
            </ul>
            {canRequest && <Link href="/requests/new" className={buttonClass("primary", "sm", "mt-4")}><ShoppingCart />Build a request</Link>}
          </Card>
        </div>
      </div>
    </>
  );
}
