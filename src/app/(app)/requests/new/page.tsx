import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadNewRequest } from "@/features/requests/new";
import { ModulePageHeader } from "@/components/shell/module-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { RequestWizard } from "@/components/requests/request-wizard";

export const metadata: Metadata = { title: "Create request" };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ centre?: string; period?: string; edit?: string }> }) {
  const session = await requirePermission("requests.create");
  const sp = await searchParams;
  const { repo } = scopedRepository(session);
  const d = await loadNewRequest(repo, sp);

  return (
    <>
      <ModulePageHeader role={session.role} module="requests" active="new" title={d.kind === "form" && d.edit ? "Edit request" : "Create request"}
        description="Build next month's order from what the centre actually used, what's on the shelf and what's already on order." />
      {d.kind === "blocked" ? (
        <Card aria-label={d.title}>
          <EmptyState icon={CalendarX2} title={d.title} body={d.body}
            action={<div className="mt-2 flex flex-wrap justify-center gap-2">{d.actions.map((a, i) => <Link key={a.href} href={a.href} className={buttonClass(i === 0 ? "primary" : "secondary", "sm")}>{a.label}</Link>)}</div>} />
        </Card>
      ) : (
        // Keyed by centre + period (not draft id) so the first "Save draft" keeps the step and note.
        <RequestWizard key={`${d.centre.id}-${d.period}`} data={d} />
      )}
    </>
  );
}
