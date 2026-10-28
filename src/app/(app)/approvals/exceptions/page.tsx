import type { Metadata } from "next";
import { AlertOctagon, AlertTriangle, ClipboardCheck, FileWarning, Info, PackageX, Siren, Wallet } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadExceptions, type ExceptionItem } from "@/features/approvals/exceptions";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DataList } from "@/components/dashboard/lists";

export const metadata: Metadata = { title: "Exceptions & escalations" };

const KIND_ICON = { Budget: Wallet, Emergency: Siren, Approval: ClipboardCheck, Receipt: PackageX, Invoice: FileWarning } as const;
const SEVERITY = { critical: { icon: AlertOctagon, tone: "red" }, high: { icon: AlertTriangle, tone: "orange" }, medium: { icon: Info, tone: "amber" } } as const;

export default async function ExceptionsPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("budgets.read");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadExceptions(repo);
  // Rows link only where this role can open the target page.
  const row = (x: ExceptionItem) => ({ id: x.id, title: x.title, sub: x.sub, badge: x.badge, icon: KIND_ICON[x.kind], href: can(session.role, x.permission) ? x.href : undefined });

  return (
    <>
      <ModulePageHeader role={session.role} module="approvals" active="exceptions" title="Exceptions & escalations"
        description="Everything that has slipped past a limit: budgets, decision times, delivery counts and invoice matching."
        aside={<StatusBadge tone={d.groups[0]!.items.length ? "red" : "green"} dot className="text-label">{d.groups[0]!.items.length} critical · {d.total} open</StatusBadge>} />

      <div className="stagger grid gap-4">
        <Card aria-label="Exceptions by kind">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {d.byKind.map((k) => <StatTile key={k.kind} label={k.kind === "Approval" ? "Overdue approvals" : k.kind === "Emergency" ? "Emergency SLA" : `${k.kind} exceptions`} value={k.count} />)}
          </div>
        </Card>
        <div className="grid gap-4 xl:grid-cols-3">
          {d.groups.map((g) => (
            <Card key={g.severity} aria-labelledby={`sev-${g.severity}`} className="min-w-0">
              <CardHeader id={`sev-${g.severity}`} icon={SEVERITY[g.severity].icon} title={g.label} subtitle={g.note}
                action={<StatusBadge tone={g.items.length ? SEVERITY[g.severity].tone : "green"}>{g.items.length}</StatusBadge>} />
              <div className="max-h-[34rem] overflow-y-auto" tabIndex={g.items.length > 8 ? 0 : undefined} aria-label={g.items.length > 8 ? `${g.label} exceptions, scrollable` : undefined}>
                <DataList rows={g.items.map(row)} empty={`No ${g.label.toLowerCase()} exceptions`} label={`${g.label} exceptions`} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
