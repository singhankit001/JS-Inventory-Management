import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Mail, Pencil, Plus } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadSuppliers } from "@/features/procurement/suppliers";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, Eyebrow, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { DataList } from "@/components/dashboard/lists";
import { ProgressRing } from "@/components/charts/svg";
import { TrendChart } from "@/components/charts/lazy";
import { UrlDrawer } from "@/components/procurement/url-drawer";
import { SupplierForm } from "@/components/procurement/supplier-form";
import { moneyCompact, percent, relative } from "@/lib/format";

export const metadata: Metadata = { title: "Supplier directory" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ centre?: string; supplier?: string; edit?: string }> }) {
  const session = await requirePermission("suppliers.read");
  const sp = await searchParams;
  const { repo } = scopedRepository(session, sp.centre);
  const canManage = can(session.role, "suppliers.manage");
  const d = await loadSuppliers(repo, { supplier: sp.supplier, edit: canManage ? sp.edit : undefined });
  const today = repo.today();

  return (
    <>
      <ModulePageHeader role={session.role} module="procurement" active="suppliers" title="Supplier directory"
        description={`${d.totals.approved} approved and ${d.totals.pending} pending suppliers · ${d.totals.spend} ordered in the last 12 months.`}
        aside={canManage ? <Link href="?edit=new" scroll={false} className={buttonClass("primary", "sm")}><Plus />Add supplier</Link> : undefined} />

      <ul className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Suppliers">
        {d.cards.map((s) => (
          <li key={s.id}>
            <Card as="article" aria-labelledby={`s-${s.id}`} className="h-full">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 id={`s-${s.id}`} className="text-title font-normal tracking-[-0.01em]"><Link href={`?supplier=${s.id}`} scroll={false} className="underline-offset-4 hover:underline">{s.name}</Link></h2>
                  <p className="mt-1 flex flex-wrap gap-1.5"><StatusBadge tone={s.status.tone} dot>{s.status.label}</StatusBadge>{s.categories.map((c) => <StatusBadge key={c}>{c}</StatusBadge>)}</p>
                </div>
                <ProgressRing value={s.onTime} label={`${s.name} on-time delivery`} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <StatTile label="On time" value={percent(s.onTime)} />
                <StatTile label="Quality (clean receipts)" value={percent(s.quality)} />
                <StatTile label="Lead time" value={`${s.lead} days`} />
                <StatTile label="Spend · 12 months" value={s.spend ? moneyCompact(s.spend) : "—"} />
              </div>
              <p className="mt-3 text-[12px] text-ink-3">{s.history ? `${s.open} open order${s.open === 1 ? "" : "s"} · scores from our deliveries` : "No deliveries yet · scores from onboarding references"}</p>
            </Card>
          </li>
        ))}
      </ul>

      {sp.supplier && !sp.edit && (
        <UrlDrawer param="supplier" title={d.detail?.name ?? "Supplier not found"} description={d.detail ? d.detail.card.categories.join(" · ") : undefined}>
          {d.detail ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={d.detail.card.status.tone} dot>{d.detail.card.status.label}</StatusBadge>
                <span className="text-label text-ink-3">{d.detail.lastDelivered ? `Last delivery ${relative(d.detail.lastDelivered, today)}` : "No deliveries yet"}</span>
                {canManage && <Link href={`?edit=${d.detail.id}`} scroll={false} className={buttonClass("secondary", "sm", "ml-auto")}><Pencil />Edit</Link>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="On time" value={percent(d.detail.card.onTime)} />
                <StatTile label="Quality" value={percent(d.detail.card.quality)} />
                <StatTile label="Lead time" value={`${d.detail.card.lead} days`} />
                <StatTile label="Spend · 12 months" value={d.detail.card.spend ? moneyCompact(d.detail.card.spend) : "—"} />
              </div>
              <section aria-label="Performance trend">
                <Eyebrow className="mb-2">Performance · last 6 months (%)</Eyebrow>
                {d.detail.trend.some((t) => t.n) ? <TrendChart data={d.detail.trend} aName="On time %" bName="Clean receipts %" format="count" height={180} /> : <EmptyState title="No deliveries in six months" className="py-6" />}
              </section>
              <section aria-label="Open purchase orders"><Eyebrow className="mb-1">Open purchase orders</Eyebrow><DataList rows={d.detail.open} empty="No open orders" label="Open purchase orders" /></section>
              <section aria-label="Quotations"><Eyebrow className="mb-1">Quotations</Eyebrow><DataList rows={d.detail.quotes} empty="No quotations" label="Quotations" /></section>
              <section aria-label="Contact" className="rounded-tile bg-surface-2 p-3.5">
                <div className="flex items-center gap-2"><Eyebrow>Contact</Eyebrow><StatusBadge tone="neutral">Demo</StatusBadge></div>
                <p className="mt-1.5 flex items-center gap-2 text-body"><Mail className="size-4 text-ink-3" aria-hidden />{d.detail.contact}</p>
                <p className="text-[12px] text-ink-3">Placeholder address — contact details are not in the supplier master yet.</p>
              </section>
            </div>
          ) : <EmptyState icon={Building2} title="That supplier does not exist" />}
        </UrlDrawer>
      )}
      {d.form && (
        <UrlDrawer param="edit" dialog title={d.form.supplier.id ? `Edit ${d.form.supplier.name}` : "Add supplier"} description="Delivery scores are calculated from receipts and cannot be edited.">
          <SupplierForm data={d.form} />
        </UrlDrawer>
      )}
    </>
  );
}
