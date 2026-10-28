import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, KeyRound, Users } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadUsers } from "@/features/admin/users";
import { money } from "@/lib/format";
import { ModulePageHeader } from "@/components/shell/module-header";
import { CentreDialog, InviteUserDialog, UserDrawer } from "@/components/admin/user-forms";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { PillGroup } from "@/components/ui/pill-group";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column, type FilterDef } from "@/components/data/data-table";

export const metadata: Metadata = { title: "Centres & users" };

const columns: Column[] = [
  { key: "name", header: "Name", kind: "link" },
  { key: "email", header: "Email", hideBelow: "md" },
  { key: "roles", header: "Roles", hideBelow: "sm" },
  { key: "centres", header: "Centres", hideBelow: "lg" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "lastActive", header: "Last active", kind: "date", align: "right", hideBelow: "sm" },
];
const filters: FilterDef[] = [{ key: "roles", label: "role", split: "," }, { key: "status", label: "status" }, { key: "centres", label: "centre", split: "," }];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ centre?: string; view?: string }> }) {
  const session = await requirePermission("admin.users");
  const sp = await searchParams;
  const { repo } = scopedRepository(session, sp.centre);
  const d = await loadUsers(repo);
  const view = sp.view === "centres" ? "centres" : "users";
  const canConfig = can(session.role, "admin.config");

  return (
    <>
      <ModulePageHeader role={session.role} module="admin" active="users" title="Centres & users"
        description="Who can sign in, what they can do and which centres they see. Changes are saved to demo data, which resets daily."
        aside={<>
          <Link href="/admin/roles" className={buttonClass("ghost", "sm")}><KeyRound />Role definitions</Link>
          {canConfig && <CentreDialog />}
          <InviteUserDialog centres={d.centreOptions} />
        </>} />

      <div className="animate-enter mb-4 flex flex-wrap items-center justify-between gap-3">
        <PillGroup ariaLabel="Centres and users views" activeKey={view} items={[
          { key: "users", label: `Users · ${d.counts.users}`, href: "/admin/users" },
          { key: "centres", label: `Centres · ${d.counts.centres}`, href: "/admin/users?view=centres" },
        ]} />
        <p className="text-label text-ink-3 tabular">{d.counts.active} active · {d.counts.suspended} suspended · {d.counts.activeCentres} of {d.counts.centres} centres open</p>
      </div>

      {view === "users" ? (
        <Card aria-label="Users">
          <CardHeader icon={Users} title="Users" subtitle="Open a name for role chips, centre assignments and editing" />
          <DataTable columns={columns} rows={d.rows} label="Users" filters={filters} pageSize={12} exportName="users"
            emptyTitle="No users in scope" emptyBody="Invite someone to give them access." />
        </Card>
      ) : d.centres.length === 0 ? (
        <Card><EmptyState icon={Building2} title="No centres yet" body="Add a centre to start assigning staff to it." /></Card>
      ) : (
        <section aria-label="Centres" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {d.centres.map((c) => (
            <Card key={c.id} as="article" aria-labelledby={`centre-${c.id}`} className="flex flex-col">
              <header className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={`centre-${c.id}`} className="text-title font-normal tracking-[-0.01em]">
                    <Link href={`/inventory/centres/${c.id}`} className="underline-offset-4 hover:underline">{c.name}</Link>
                  </h2>
                  <p className="text-label text-ink-3">{c.code} · {c.city}</p>
                </div>
                {c.status === "active" ? <StatusBadge tone="green" dot>Active</StatusBadge> : <StatusBadge dot>Inactive</StatusBadge>}
              </header>
              <p className="text-label text-ink-3">Centre leader</p>
              <p className="text-body">
                {c.leader ? <Link href={`/admin/users?view=centres&user=${c.leader.id}`} className="font-medium text-ink underline-offset-4 hover:underline">{c.leader.name}</Link> : <span className="text-ink-3">Not assigned</span>}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <StatTile label="Staff assigned" value={c.staff} />
                <StatTile label="Monthly budget" value={money(c.monthlyBudget)} />
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <Link href={`/inventory/centres/${c.id}`} className={buttonClass("ghost", "sm", "-ml-3")} aria-label={`${c.name} inventory`}>Inventory<ArrowUpRight /></Link>
                {canConfig && <CentreDialog centre={c} />}
              </div>
            </Card>
          ))}
        </section>
      )}

      <UserDrawer users={d.details} centres={d.centreOptions} selfId={session.user.id} canEdit />
    </>
  );
}
