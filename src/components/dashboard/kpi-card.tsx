import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Sparkline } from "@/components/charts/svg";
import type { Tone } from "@/components/ui/badge";

export type KpiVariant = "primary" | "secondary" | "plain";

const variants: Record<KpiVariant, { card: string; ink2: string; bubble: string }> = {
  primary: { card: "bg-primary-card text-primary-card-ink border-transparent", ink2: "text-primary-card-ink-2", bubble: "bg-white/10 text-primary-card-ink ring-white/10 dark:bg-black/5 dark:ring-black/10" },
  secondary: { card: "bg-secondary-card text-secondary-card-ink border-transparent", ink2: "text-secondary-card-ink-2", bubble: "bg-white/40 text-secondary-card-ink ring-white/30 dark:bg-white/10 dark:ring-white/10" },
  plain: { card: "bg-surface text-ink", ink2: "text-ink-3", bubble: "bg-surface-2 text-ink-2 ring-line" },
};

/**
 * The reference KPI card: icon + label, large tabular value, sparkline on the right, footnote.
 * Use one "primary" (black) and one "secondary" (pale blue) per row, the rest "plain".
 */
export function KpiCard({ variant = "plain", icon: Icon, label, value, spark, sparkTone, footnote, href, className }: {
  variant?: KpiVariant; icon: LucideIcon; label: string; value: React.ReactNode; spark?: number[]; sparkTone?: Tone; footnote?: React.ReactNode; href?: string; className?: string;
}) {
  const v = variants[variant];
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-7 place-items-center rounded-full ring-1", v.bubble)} aria-hidden><Icon className="size-3.5" strokeWidth={1.75} /></span>
        <span className={cn("truncate text-label", v.ink2)}>{label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-metric font-medium tracking-[-0.02em] tabular">{value}</span>
        {spark && spark.length > 1 && <Sparkline data={spark} tone={variant === "plain" ? sparkTone : undefined} label={`${label} trend`} className="-mb-1" />}
      </div>
      {footnote && <div className={cn("mt-2.5 text-[12px]", v.ink2)}>{footnote}</div>}
    </>
  );
  const cls = cn(
    "group block rounded-card border border-line/70 p-5 shadow-card transition-[transform,translate,scale,box-shadow] duration-300 ease-[var(--ease-out-3)]",
    href && "hover:-translate-y-0.5 hover:shadow-float",
    v.card,
    className,
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <article className={cls}>{body}</article>;
}

export function MetricGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("stagger grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}
