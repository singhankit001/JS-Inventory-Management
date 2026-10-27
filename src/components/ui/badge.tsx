import { cn } from "@/lib/cn";

export type Tone = "neutral" | "blue" | "green" | "orange" | "amber" | "red" | "violet" | "slate";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  blue: "bg-blue-soft text-blue",
  green: "bg-green-soft text-green",
  orange: "bg-orange-soft text-orange",
  amber: "bg-amber-soft text-amber",
  red: "bg-red-soft text-red",
  violet: "bg-violet-soft text-violet",
  slate: "bg-slate-soft text-slate",
};
export const toneDot: Record<Tone, string> = {
  neutral: "bg-ink-3", blue: "bg-blue", green: "bg-green", orange: "bg-orange", amber: "bg-amber", red: "bg-red", violet: "bg-violet", slate: "bg-slate",
};

export function StatusBadge({ tone = "neutral", children, dot = false, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", toneDot[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/** Small round count used on nav items (orange in the reference). */
export function CountBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-grid min-w-[18px] h-[18px] place-items-center rounded-full bg-orange px-1 text-[10.5px] font-semibold text-white tabular"
      aria-label={label ?? `${count} pending`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
