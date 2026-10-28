import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { initials } from "@/lib/format";

const bubbleTone: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2", blue: "bg-blue-soft text-blue", green: "bg-green-soft text-green", orange: "bg-orange-soft text-orange",
  amber: "bg-amber-soft text-amber", red: "bg-red-soft text-red", violet: "bg-violet-soft text-violet", slate: "bg-slate-soft text-slate",
};

export interface ListRow {
  id: string;
  title: string;
  sub?: string;
  value?: React.ReactNode;
  badge?: { label: string; tone: Tone };
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
}

/** Icon · title/sub · value/badge rows ("Below reorder point", "Most value here" in the reference). */
export function DataList({ rows, empty, label }: { rows: ListRow[]; empty: string; label: string }) {
  if (!rows.length) return <EmptyState title={empty} className="py-8" />;
  return (
    <ul className="-mx-2 grid grid-cols-1" aria-label={label}>
      {rows.map((r) => {
        const Icon = r.icon;
        const inner = (
          <>
            {Icon && <span className={cn("grid size-8 shrink-0 place-items-center rounded-[10px]", bubbleTone[r.tone ?? "neutral"])} aria-hidden><Icon className="size-4" strokeWidth={1.75} /></span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium">{r.title}</p>
              {r.sub && <p className="truncate text-[12px] text-ink-3">{r.sub}</p>}
            </div>
            {r.value !== undefined && <span className="text-body font-medium tabular">{r.value}</span>}
            {r.badge && <StatusBadge tone={r.badge.tone}>{r.badge.label}</StatusBadge>}
          </>
        );
        const cls = "flex items-center gap-3 rounded-[14px] px-2 py-2.5 transition-colors duration-200";
        return (
          <li key={r.id} className="border-b border-line/60 last:border-0">
            {r.href ? <Link href={r.href} className={cn(cls, "hover:bg-surface-2")}>{inner}</Link> : <div className={cls}>{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export interface ActivityItem { id: string; actor: string; action: string; subject: string; at: string; tone?: Tone }

export function ActivityTimeline({ items, empty = "No recent activity" }: { items: ActivityItem[]; empty?: string }) {
  if (!items.length) return <EmptyState title={empty} className="py-8" />;
  return (
    <ol className="relative grid gap-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
      {items.map((a) => (
        <li key={a.id} className="relative flex gap-3">
          <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-4 ring-surface", bubbleTone[a.tone ?? "neutral"])} aria-hidden>{initials(a.actor)}</span>
          <div className="min-w-0 pt-0.5">
            <p className="text-label text-ink-2"><span className="font-medium text-ink">{a.actor}</span> {a.action} <span className="text-ink">{a.subject}</span></p>
            <p className="text-[11.5px] text-ink-3">{a.at}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Compact status summary used for health / integration / pipeline stages. */
export function StatusCard({ label, status, tone, detail }: { label: string; status: string; tone: Tone; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-tile bg-surface-2 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-body font-medium">{label}</p>
        {detail && <p className="truncate text-[12px] text-ink-3">{detail}</p>}
      </div>
      <StatusBadge tone={tone} dot>{status}</StatusBadge>
    </div>
  );
}
