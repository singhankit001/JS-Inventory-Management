import { PageHeader, type Crumb } from "@/components/dashboard/page-header";
import { PillGroup } from "@/components/ui/pill-group";
import { findModule, navPages } from "@/lib/modules";
import type { Role } from "@/domain/types";

/**
 * Header for every module page: Jumpstart › Module › [crumbs] › Title, plus the module's sub-nav pill
 * (only pages this role may open). Detail pages pass `active` as their parent list's slug.
 */
export function ModulePageHeader({ role, module: moduleId, active, title, description, crumbs = [], aside }: {
  role: Role; module: string; active: string; title: string; description?: React.ReactNode; crumbs?: Crumb[]; aside?: React.ReactNode;
}) {
  const group = findModule(moduleId);
  if (!group) throw new Error(`Unknown module ${moduleId}`);
  const pages = navPages(role, group);
  return (
    <PageHeader
      crumbs={[{ label: "Jumpstart", href: "/" }, { label: group.short, href: `/modules/${group.id}` }, ...crumbs, { label: title }]}
      title={title}
      description={description}
      aside={aside}
    >
      {pages.length > 1 && <PillGroup ariaLabel={`${group.label} pages`} activeKey={active} items={pages.map((p) => ({ key: p.slug, label: p.tab ?? p.title, href: p.href! }))} />}
    </PageHeader>
  );
}
