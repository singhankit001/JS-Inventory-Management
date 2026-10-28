import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, PackageCheck, Truck } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadDeliveries } from "@/features/receiving/deliveries";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ParamSelect } from "@/components/procurement/param-select";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Expected deliveries" };

const link = "font-medium text-ink underline-offset-4 hover:underline";

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ centre?: string; supplier?: string }> }) {
  const session = await requirePermission("receiving.read");
  const sp = await searchParams;
  const { repo, centre } = scopedRepository(session, sp.centre);
  const d = await loadDeliveries(repo, sp.supplier);
  const canRecord = can(session.role, "receiving.record");
  const supplier = d.suppliers.find((s) => s.id === sp.supplier);

  return (
    <>
      <ModulePageHeader role={session.role} module="receiving" active="deliveries" title="Expected deliveries"
        description="Issued orders by the day they are due at each centre, with overdue ones first."
        aside={canRecord ? <Link href="/receiving/receipts?record=1" className={buttonClass("primary", "sm")}><PackageCheck />Record receipt</Link> : undefined} />

      <div className="stagger grid gap-4">
        <Card aria-label="Next 14 days">
          <CardHeader icon={CalendarDays} title="Next 14 days" subtitle={`${centre?.name ?? (session.centres.length === 1 ? session.centres[0]!.name : "All your centres")}${supplier ? ` · ${supplier.label}` : ""}`}
            action={<div className="flex flex-wrap items-end gap-2">
              {session.centres.length > 1 && <ParamSelect param="centre" label="Centre" options={session.centres.map((c) => ({ id: c.id, label: c.name }))} allLabel="All centres" />}
              <ParamSelect param="supplier" label="Supplier" options={d.suppliers} allLabel="All suppliers" />
            </div>} />
          <ol className="grid grid-cols-7 gap-1.5 lg:grid-cols-14" aria-label="Deliveries per day">
            {d.strip.map((day, i) => (
              <li key={day.key} aria-label={`${day.weekday} ${day.day}: ${day.count} deliveries`}
                className={cn("rounded-tile px-1 py-2.5 text-center", i === 0 ? "bg-primary-card text-primary-card-ink" : day.weekend ? "bg-surface-3/60" : "bg-surface-2")}>
                <p className={cn("text-[11px]", i === 0 ? "text-primary-card-ink-2" : "text-ink-3")}>{i === 0 ? "Today" : day.weekday}</p>
                <p className="text-body font-medium tabular">{day.day}</p>
                <p className="mt-1 flex justify-center gap-0.5" aria-hidden>
                  {day.count ? Array.from({ length: Math.min(day.count, 3) }, (_, k) => <i key={k} className="size-1.5 rounded-full bg-blue" />) : <i className="size-1.5 rounded-full bg-line-strong" />}
                </p>
              </li>
            ))}
          </ol>
          {d.overdue > 0 && <p className="mt-3 text-label text-red"><b className="tabular">{d.overdue}</b> overdue order{d.overdue === 1 ? "" : "s"} are listed first below.</p>}
        </Card>

        <Card aria-label="Delivery agenda">
          <CardHeader icon={Truck} title="Agenda" subtitle={`${d.total} open order${d.total === 1 ? "" : "s"} awaiting delivery`} />
          {d.total === 0 ? <EmptyState icon={Truck} title="Nothing on its way" body={supplier ? `No open orders from ${supplier.label}. Clear the supplier filter to see all.` : "Issued purchase orders for your centres appear here."} className="py-8" /> : (
            <div className="grid gap-6">
              {d.groups.map((g) => (
                <section key={g.key} aria-labelledby={`g-${g.key}`}>
                  <div className="mb-1 flex items-baseline gap-2">
                    <h3 id={`g-${g.key}`} className={cn("text-body font-medium", g.key === "overdue" && "text-red")}>{g.label}</h3>
                    <span className="text-label text-ink-3 tabular">{g.items.length}</span>
                    <span className="hidden text-[12px] text-ink-3 sm:inline">· {g.hint}</span>
                  </div>
                  {g.items.length === 0 ? <p className="py-2 text-label text-ink-3">Nothing due today.</p> : (
                    <ul className="divide-y divide-line/60" aria-label={g.label}>
                      {g.items.map((it) => (
                        <li key={it.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                          <div className="min-w-0 flex-1 basis-64">
                            <p className="text-body"><Link href={it.href} className={link}>{it.number}</Link> <span className="text-ink-3">·</span> <Link href={it.supplier.href} className="underline-offset-4 hover:underline">{it.supplier.name}</Link></p>
                            <p className="text-[12px] text-ink-3"><Link href={it.centre.href} className="underline-offset-4 hover:underline">{it.centre.name}</Link> · {it.when} · {it.detail}</p>
                          </div>
                          <StatusBadge tone={it.badge.tone} dot>{it.badge.label}</StatusBadge>
                          {canRecord && <Link href={it.recordHref} className={buttonClass("secondary", "sm")} aria-label={`Record receipt for ${it.number}`}><PackageCheck />Record</Link>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
