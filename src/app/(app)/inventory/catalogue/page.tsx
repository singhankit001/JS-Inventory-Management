import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadCatalogue } from "@/features/inventory/catalogue";
import { ModulePageHeader } from "@/components/shell/module-header";
import { CatalogueBrowser } from "@/components/inventory/catalogue-browser";
import { Card, CardHeader } from "@/components/ui/card";
import { PlannedAction } from "@/components/ui/button";

export const metadata: Metadata = { title: "Product catalogue" };

export default async function Catalogue({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("inventory.read");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadCatalogue(repo);

  return (
    <>
      <ModulePageHeader role={session.role} module="inventory" active="catalogue" title="Product catalogue"
        description={`${d.active} active products in ${d.categories} categories · ${d.quoted} with a valid supplier quote`}
        aside={<PlannedAction label="Add product" />} />
      <Card aria-label="Products">
        <CardHeader icon={BookOpen} title="Products" subtitle="Open a product for stock by centre, quotations and consumption" />
        <CatalogueBrowser rows={d.rows} details={d.details} />
      </Card>
    </>
  );
}
