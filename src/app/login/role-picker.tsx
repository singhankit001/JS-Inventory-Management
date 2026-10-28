"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, BadgeCheck, Building2, LineChart, PackageCheck, School, ShieldCheck, ShoppingCart, Wallet, type LucideIcon } from "lucide-react";
import type { Role } from "@/domain/types";

const ICONS: Record<Role, LucideIcon> = {
  ceo: LineChart, head_office: Building2, centre_leader: School, purchasing: ShoppingCart,
  finance: Wallet, receiving: PackageCheck, admin: ShieldCheck,
};

/** One demo account. Submits the surrounding sign-in form; shows progress while the session is written. */
export function RoleTile({ role, label, person, scope }: { role: Role; label: string; person: string; scope: string }) {
  const { pending } = useFormStatus();
  const Icon = ICONS[role] ?? BadgeCheck;
  return (
    <button
      aria-busy={pending}
      className="role-tile group relative flex h-full w-full flex-col gap-3 rounded-[18px] border border-line bg-surface p-3.5 text-left shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-[border-color,background-color,box-shadow,transform] duration-200 disabled:opacity-60"
      disabled={pending}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-[11px] bg-surface-2 text-ink-2 ring-1 ring-line/80 transition-colors duration-200 group-hover:bg-pill group-hover:text-pill-ink">
          <Icon className="size-[17px]" strokeWidth={1.7} />
        </span>
        <span className="max-w-[60%] truncate rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">{scope}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-body leading-tight font-medium tracking-[-0.01em]">{label}</span>
        <span className="mt-0.5 block truncate text-label text-ink-3">{person}</span>
      </span>
      <span className="absolute right-3.5 bottom-3.5 text-ink-3 transition-[opacity,transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden>
        {pending ? <span className="block size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" /> : <ArrowRight className="size-4" />}
      </span>
    </button>
  );
}
