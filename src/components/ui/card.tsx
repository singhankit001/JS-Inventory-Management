import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, children, as: Tag = "section", ...rest }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "article" | "div" }) {
  return (
    <Tag className={cn("card p-5 sm:p-6", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function IconBubble({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 ring-1 ring-line", className)} aria-hidden>
      <Icon className="size-4" strokeWidth={1.75} />
    </span>
  );
}

/** Card title row: icon bubble, title, optional subtitle and trailing action (e.g. "Payments ›"). */
export function CardHeader({ icon, title, subtitle, action, className, id }: { icon?: LucideIcon; title: string; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <header className={cn("mb-4 flex items-start gap-3", className)}>
      {icon && <IconBubble icon={icon} />}
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-title font-normal tracking-[-0.01em] text-ink">{title}</h2>
        {subtitle && <p className="text-label text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/** Inset stat tile, as in the warehouse cards ("Stock value / Units / SKUs"). */
export function StatTile({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-tile bg-surface-2 px-3.5 py-2.5", className)}>
      <div className="text-[11.5px] text-ink-3">{label}</div>
      <div className="text-body font-medium text-ink tabular">{value}</div>
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-eyebrow font-medium tracking-[0.12em] text-ink-3 uppercase", className)}>{children}</p>;
}
