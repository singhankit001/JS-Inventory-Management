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
export function PageHeader({ crumbs, title, aside, children }: { crumbs: Crumb[]; title: string; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-2 text-[1.875rem] leading-tight font-normal tracking-[-0.025em] sm:text-display">{title}</h1>
      </div>
      {children}
      {aside}
    </header>
  );
}
