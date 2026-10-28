import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { loadCentreCards } from "@/features/inventory/centres";
import { ModulePageHeader } from "@/components/shell/module-header";
import { CentreGrid } from "@/components/inventory/centre-grid";
import { EmptyState } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Centre inventory" };

export default async function CentreInventory({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("inventory.read");
  // A centre leader (or receiver) with one centre has nothing to choose between: go straight to it.
  if (ROLE_DEFINITIONS[session.role].scope === "centre" && session.centres.length === 1) redirect(`/inventory/centres/${session.centres[0]!.id}`);
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const { cards, categories } = await loadCentreCards(repo);

  return (
    <>
      <ModulePageHeader role={session.role} module="inventory" active="centres" title="Centre inventory"
        description={`${cards.length} centre${cards.length === 1 ? "" : "s"} · open a centre for its stock table, cover and movements`}
        aside={<Link href="/inventory/alerts" className={buttonClass("secondary", "sm")}><BellRing />Low stock alerts</Link>} />
      {cards.length ? <CentreGrid cards={cards} categories={categories} /> : <EmptyState title="No centres in your scope" body="Ask an administrator to assign you to a centre." />}
    </>
  );
}
