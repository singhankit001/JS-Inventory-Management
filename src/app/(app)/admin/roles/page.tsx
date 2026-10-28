import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Scale, ShieldCheck, Users } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadRoles } from "@/features/admin/roles";
import { ModulePageHeader } from "@/components/shell/module-header";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Roles & permissions" };

const SHOWN = 4;

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("admin.users");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadRoles(repo);

  return (
    <>
      <ModulePageHeader role={session.role} module="admin" active="roles" title="Roles & permissions"
        description="Seven roles, each a fixed set of permissions. Generated from the code the server checks on every request — edit roles in code, assign them to people in Centres & users."
        aside={<Link href="/admin/users" className={buttonClass("secondary", "sm")}><Users />Assign roles</Link>} />

      <section aria-label="Role summaries" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {d.roles.map((r) => (
          <Card key={r.role} as="article" aria-labelledby={`role-${r.role}`} className="flex flex-col">
            <header className="mb-2 flex items-start justify-between gap-3">
              <h2 id={`role-${r.role}`} className="text-title font-normal tracking-[-0.01em]">{r.label}</h2>
              <StatusBadge tone={r.scope === "centre" ? "orange" : "neutral"}>{r.scope === "centre" ? "Centre" : "Organisation"}</StatusBadge>
            </header>
            <p className="text-label text-ink-3">{r.description}</p>
            <p className="mt-3 flex items-baseline gap-1.5"><span className="text-metric font-medium tracking-[-0.02em] tabular">{r.users}</span><span className="text-label text-ink-3">active {r.users === 1 ? "user" : "users"} · {r.permissionCount} permissions</span></p>
            <ul className="mt-3 grid gap-1 text-label text-ink-2" aria-label={`${r.label} key capabilities`}>
              {r.capabilities.slice(0, SHOWN).map((c) => <li key={c} className="flex gap-2"><span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />{c}</li>)}
              {r.capabilities.length > SHOWN && <li className="pl-3 text-ink-3">+{r.capabilities.length - SHOWN} more in the matrix below</li>}
            </ul>
            <div className="mt-auto pt-4">
              <Link href={`/admin/users?f_roles=${encodeURIComponent(r.label)}`} className={buttonClass("ghost", "sm", "-ml-3")} aria-label={`Users with the ${r.label} role`}>Users with this role<ArrowUpRight /></Link>
            </div>
          </Card>
        ))}
      </section>

      <Card className="mt-4" aria-labelledby="sod-h">
        <CardHeader id="sod-h" icon={Scale} title="Separation of duties" subtitle="Checked on every write before the permission itself, so a later role change can't quietly undo them" />
        <ol className="stagger grid gap-3 md:grid-cols-3">
          {d.sod.map((s, i) => (
            <li key={s.id} className="flex flex-col rounded-tile bg-surface-2 p-4">
              <p className="text-eyebrow font-medium tracking-[0.12em] text-ink-3 uppercase">Rule {i + 1}</p>
              <h3 className="mt-1 text-body font-medium text-ink">{s.title}</h3>
              <p className="mt-1.5 text-label text-ink-2">{s.body}</p>
              <dl className="mt-auto grid gap-1 pt-3 text-[12px] text-ink-3">
                <div><dt className="inline">Guards </dt><dd className="inline"><code className="text-ink-2">{s.permission}</code>{s.holders.length > 0 && <> · held by {s.holders.join(", ")}</>}</dd></div>
                {s.blocked.length > 0 && <div><dt className="inline">Always blocked for </dt><dd className="inline">{s.blocked.join(", ")}</dd></div>}
                <div><dt className="inline">People see </dt><dd className="inline">“{s.enforced}”</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4" aria-label="Role permission matrix">
        <CardHeader icon={ShieldCheck} title="What each role can do" subtitle="Generated from src/lib/auth/permissions.ts — the same table the server checks on every request" />
        <PermissionMatrix />
      </Card>
    </>
  );
}
