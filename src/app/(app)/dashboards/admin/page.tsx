import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Bot, Building2, Clock, KeyRound, Library, Plug, ScrollText, ShieldCheck, Truck, UserCheck, UserPlus, Users } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadAdmin } from "@/features/dashboards/admin";
import { dateEyebrow, firstName, greeting } from "@/features/dashboards/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveStatus } from "@/components/dashboard/live-status";
import { WelcomeCard, DayTimeline } from "@/components/dashboard/welcome";
import { KpiCard, MetricGrid } from "@/components/dashboard/kpi-card";
import { ActivityTimeline, DataList, StatusCard } from "@/components/dashboard/lists";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { CategoryDistribution, ComparisonBars, ProgressRing, TrendIndicator } from "@/components/charts/svg";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { DataTable } from "@/components/data/data-table";
import { TipGroup } from "@/components/ui/float-tip";

export const metadata: Metadata = { title: "Administrator dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("dashboard.admin");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadAdmin(repo);
  const canUsers = can(session.role, "admin.users");
  const canAudit = can(session.role, "audit.read");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: centre?.name ?? "All centres" }, { label: "Administration" }]}
        title="Administration"
        aside={<LiveStatus title={`${d.kpis.activeToday} of ${d.kpis.active} users active today`} detail={`${d.connected} of ${d.integrations.length} integrations connected · ${d.kpis.openJobs} AI jobs open`} progress={d.kpis.todayRatio} />}
      />

      <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WelcomeCard
          dateLabel={dateEyebrow(repo.today())}
          greeting={`${greeting()}, ${firstName(session.user.name)}.`}
          actions={<>
            {canUsers && <Link href="/admin/roles" className={buttonClass("primary", "sm")}><KeyRound />Role matrix</Link>}
            {canAudit && <Link href="/governance/audit" className={buttonClass("secondary", "sm")}><ScrollText />Audit log</Link>}
          </>}
          footer={<DayTimeline events={d.welcome.events} nowHour={d.welcome.nowHour} label="Today's sign-ins and audited changes" />}
        >
          <p>
            <b>{d.welcome.users} active users</b> across <b>{d.welcome.centres} centres</b>. <b>{d.welcome.unconfigured} integrations</b> are not configured yet, so the workspace runs on demo data.{" "}
            {d.welcome.review > 0 && <em>{d.welcome.review} AI job{d.welcome.review > 1 ? "s need" : " needs"} a human review.</em>}
          </p>
        </WelcomeCard>

        <Card aria-label="Users by role">
          <CardHeader icon={Users} title="Users by role" subtitle="Active users · one person can hold several roles" />
          <div className="mb-4 flex flex-wrap items-baseline gap-2.5">
            <span className="text-metric-lg font-medium tracking-[-0.03em]"><AnimatedNumber value={d.kpis.active + d.kpis.suspended} /></span>
            <span className="text-label text-ink-3">accounts</span>
            <StatusBadge tone={d.kpis.suspended ? "red" : "neutral"}>{d.kpis.suspended} suspended</StatusBadge>
          </div>
          <ComparisonBars rows={d.roles} label="Active users per role" />
        </Card>
      </div>

      <MetricGrid className="mt-4">
        <KpiCard variant="primary" icon={UserCheck} label="Active users" value={<AnimatedNumber value={d.kpis.active} />}
          footnote={<span>{d.kpis.suspended} suspended account{d.kpis.suspended === 1 ? "" : "s"}</span>} />
        <KpiCard variant="secondary" icon={Clock} label="Active today" value={<AnimatedNumber value={d.kpis.activeToday} />}
          footnote={<span>{d.kpis.dormant ? `${d.kpis.dormant} dormant for over a week` : "No dormant accounts"}</span>} />
        <KpiCard icon={Library} label="Active products" value={<AnimatedNumber value={d.kpis.products} />}
          footnote={<span>{d.kpis.categories} categories · {d.kpis.discontinued} discontinued</span>} />
        <KpiCard icon={Bot} label="Open AI jobs" value={<AnimatedNumber value={d.kpis.openJobs} />}
          footnote={<TrendIndicator direction="flat" good={d.welcome.review === 0}>{d.welcome.review} awaiting review</TrendIndicator>} />
      </MetricGrid>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-label="Catalogue health">
          <CardHeader icon={Library} title="Catalogue health" subtitle="Active products per category" action={<Link className={buttonClass("ghost", "sm")} href="/inventory/catalogue">Catalogue ›</Link>} />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ProgressRing value={d.catalogue.ratio} size={96} stroke={8} tone="green" label="Products active">
              <span className="grid text-center leading-tight"><span className="text-title font-medium">{Math.round(d.catalogue.ratio * 100)}%</span><span className="text-[10.5px] font-normal text-ink-3">active</span></span>
            </ProgressRing>
            <div className="min-w-0 flex-1"><CategoryDistribution segments={d.catalogue.segments} label="Active products by category" /></div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium"><AnimatedNumber value={d.catalogue.active} /></p><p className="text-[11px] text-ink-3">Active</p></div>
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium"><AnimatedNumber value={d.catalogue.discontinued} /></p><p className="text-[11px] text-ink-3">Discontinued</p></div>
            <div className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium"><AnimatedNumber value={d.catalogue.uoms} /></p><p className="text-[11px] text-ink-3">Units of measure</p></div>
          </div>
        </Card>
        <Card aria-label="Integrations health">
          <CardHeader icon={Plug} title="Integrations" subtitle={`${d.connected} of ${d.integrations.length} connected`} />
          <div className="grid gap-2">
            {d.integrations.map((i) => <StatusCard key={i.id} label={i.label} status={i.status} tone={i.tone} detail={i.detail} />)}
          </div>
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card aria-label="Centres overview">
          <CardHeader icon={Building2} title="Centres" subtitle="Assigned staff and stocked SKUs" />
          <DataList rows={d.centres} empty="No centres in scope" label="Centres" />
        </Card>
        <Card aria-label="Supplier master status">
          <CardHeader icon={Truck} title="Supplier master" subtitle="Pending and blocked first" />
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            {d.suppliers.counts.map((s) => (
              <div key={s.status} className="rounded-tile bg-surface-2 py-2.5"><p className="text-body font-medium"><AnimatedNumber value={s.n} /></p><p className="text-[11px] text-ink-3 capitalize">{s.status}</p></div>
            ))}
          </div>
          <DataList rows={d.suppliers.rows} empty="No suppliers yet" label="Suppliers by status" />
        </Card>
        <Card aria-label="AI job queue" className="md:col-span-2 xl:col-span-1">
          <CardHeader icon={Bot} title="AI job queue" subtitle="Audio, video and OCR processing" />
          <TipGroup className="mb-3 grid grid-cols-5 gap-1.5 text-center">
            {d.jobs.byStatus.map((s) => (
              <div key={s.status} className="rounded-tile bg-surface-2 px-1 py-2"><p className="text-body font-medium"><AnimatedNumber value={s.n} /></p><p className="truncate text-[10.5px] text-ink-3" data-tip={s.label}>{s.label}</p></div>
            ))}
          </TipGroup>
          <DataList rows={d.jobs.rows} empty="Queue is empty" label="Recent AI jobs" />
        </Card>
      </div>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card aria-label="Last active recency">
          <CardHeader icon={Clock} title="Last active" subtitle="Active accounts by most recent sign-in" />
          <ComparisonBars rows={d.recency} label="Active users by last sign-in" />
          <p className="mt-4 text-label text-ink-3">Suspend or reassign idle accounts in <Link href="/admin/users" className="text-ink underline-offset-2 hover:underline">Centres &amp; users</Link>.</p>
        </Card>
        <Card aria-label="Recent audit events">
          <CardHeader icon={BadgeCheck} title="Recent audit events" action={canAudit && <Link className={buttonClass("ghost", "sm")} href="/governance/audit">Audit log ›</Link>} />
          <ActivityTimeline items={d.activity} />
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="users-h">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="users-h" className="text-title">Users</h2>
            <p className="text-label text-ink-3">Roles, centre access and last sign-in</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canUsers && <Link className={buttonClass("secondary", "md")} href="/admin/roles"><ShieldCheck />Role matrix</Link>}
            {canUsers && <Link className={buttonClass("primary", "md")} href="/admin/users?invite=1"><UserPlus />Invite user</Link>}
          </div>
        </div>
        <Card>
          <DataTable
            label="Users" exportName="users" filters={[{ key: "roles", label: "role", split: "," }, { key: "status", label: "status" }]}
            emptyTitle="No users in scope"
            columns={[
              { key: "name", header: "Name" },
              { key: "email", header: "Email", hideBelow: "md" },
              { key: "roles", header: "Roles", hideBelow: "sm" },
              { key: "centres", header: "Centres", hideBelow: "lg" },
              { key: "status", header: "Status", kind: "badge" },
              { key: "lastActive", header: "Last active", kind: "date", align: "right" },
            ]}
            rows={d.users}
          />
        </Card>
      </section>
    </>
  );
}
