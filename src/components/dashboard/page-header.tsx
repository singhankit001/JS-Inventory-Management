import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb { label: string; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-label text-ink-3">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.href && !last ? <Link href={c.href} className="transition-colors hover:text-ink">{c.label}</Link> : <span aria-current={last ? "page" : undefined} className={last ? "text-blue" : undefined}>{c.label}</span>}
              {!last && <ChevronRight className="size-3.5" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Breadcrumbs, light display title, optional centre nav (middle) and status chip (right). */
/**
 * Breadcrumbs + light display title, optional sub-nav beside the title (reference: "Warehouses · Inventory | Purchasing")
 * and a right-aligned aside (status chip / actions). The sub-nav stays with the title when space runs out instead of
 * dropping under the aside.
 */
export function PageHeader({ crumbs, title, description, aside, children }: { crumbs: Crumb[]; title: string; description?: React.ReactNode; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Breadcrumbs items={crumbs} />
          <h1 className="mt-2 text-[1.875rem] leading-tight font-normal tracking-[-0.025em] sm:text-display">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-body text-ink-3">{description}</p>}
        </div>
        {children && <div className="max-w-full min-w-0 overflow-x-auto pb-0.5">{children}</div>}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </header>
  );
}
