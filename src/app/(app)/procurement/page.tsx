import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Columns3, FileText, Timer, Truck } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadPipeline } from "@/features/procurement/pipeline";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ColumnChart } from "@/components/charts/lazy";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { TrendIndicator } from "@/components/charts/svg";
import { moneyCompact, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Procurement pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("procurement.read");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadPipeline(repo);
  const h = d.headline;

  return (
    <>
      <ModulePageHeader role={session.role} module="procurement" active="pipeline" title="Procurement pipeline"
        description="Every order from approved request to goods receipt — what sits in each stage and what is stuck."
        aside={<>
          <Link href="/procurement/orders" className={buttonClass("secondary", "sm")}><FileText />Orders</Link>
          {can(session.role, "procurement.manage") && <Link href="/procurement/orders?new=1" className={buttonClass("primary", "sm")}>Raise PO</Link>}
        </>} />

      <ol className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Pipeline stages, in order">
        {d.stages.map((s, i) => {
          // The authorisation stage is the one a person can unblock today, so it gets the primary card.
          const dark = s.key === "authorisation" && s.count > 0;
          const ink2 = dark ? "text-primary-card-ink-2" : "text-ink-3";
          return (
            <li key={s.key} className={cn("flex flex-col p-4", dark ? "rounded-card bg-primary-card text-primary-card-ink shadow-card" : "card")}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-label", ink2)}><span className="tabular">{i + 1}</span> · {s.label}</span>
                <Link href={s.href} className={cn("grid size-7 place-items-center rounded-full hover:bg-surface-3/40", ink2)} aria-label={`Open ${s.label}`}><ArrowRight className="size-3.5" /></Link>
              </div>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-metric font-medium tracking-[-0.02em] tabular"><AnimatedNumber value={s.count} /></span>
                <span className={cn("text-label tabular", ink2)}>{s.value === null ? "open" : moneyCompact(s.value)}</span>
              </p>
              <p className={cn("text-[12px]", ink2)}>{s.hint}</p>
              <ul className={cn("mt-3 grid gap-1 border-t pt-2", dark ? "border-white/15" : "border-line")} aria-label={`Oldest in ${s.label}`}>
                {s.items.length ? s.items.map((it) => (
                  <li key={it.id}>
                    <Link href={it.href} className={cn("block rounded-[10px] px-1.5 py-1 transition-colors", dark ? "hover:bg-white/10" : "hover:bg-surface-2")}>
                      <span className="block truncate text-label font-medium">{it.title}</span>
                      <span className={cn("block truncate text-[11.5px]", ink2)}>{it.sub}</span>
                    </Link>
                  </li>
                )) : <li className={cn("px-1.5 py-1 text-[12px]", ink2)}>Nothing here</li>}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-label="Cycle time">
          <CardHeader icon={Timer} title="Cycle time" subtitle="Average days from PO raised to final receipt, by month closed" />
          <ColumnChart data={d.cycle} name="Average days" format="count" highlight={d.cycle.at(-1)?.label} />
          <p className="mt-2 text-[12px] text-ink-3">{d.cycle.reduce((s, c) => s + c.orders, 0)} orders closed in six months · current month in black</p>
        </Card>
        <Card aria-label="Flow health">
          <CardHeader icon={Columns3} title="Flow health" subtitle="Orders between authorisation and receipt" />
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="In flight" value={<AnimatedNumber value={h.inFlight} />} />
            <StatTile label="Value in flight" value={h.inFlightValue} />
            <StatTile label="Cycle time, this month" value={`${h.cycleDays} days`} />
            <StatTile label="Issued, on schedule" value={percent(h.onSchedule)} />
          </div>
          <p className="mt-3">
            <TrendIndicator direction={h.cycleDelta > 0 ? "up" : h.cycleDelta < 0 ? "down" : "flat"} good={h.cycleDelta <= 0}>
              {h.cycleDelta === 0 ? "Same as last month" : `${Math.abs(h.cycleDelta)} days ${h.cycleDelta > 0 ? "slower" : "faster"} than last month`}
            </TrendIndicator>
          </p>
          <div className="mt-4 grid gap-2">
            <Link href="/receiving/deliveries" className={buttonClass("secondary", "sm", "justify-between")}><span className="inline-flex items-center gap-2"><Truck />Expected deliveries</span>{h.late > 0 && <span className="text-red tabular">{h.late} late</span>}</Link>
            <Link href="/procurement/compare" className={buttonClass("secondary", "sm", "justify-start")}><Columns3 />Compare suppliers</Link>
          </div>
        </Card>
      </div>
    </>
  );
}
