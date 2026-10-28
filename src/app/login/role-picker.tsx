"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Building2, Check, LineChart, PackageCheck, School, ShieldCheck, ShoppingCart, Wallet, type LucideIcon } from "lucide-react";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/cn";
import { TipGroup } from "@/components/ui/float-tip";
import { signIn } from "@/app/actions/session";

const ICONS: Record<Role, LucideIcon> = {
  ceo: LineChart, head_office: Building2, centre_leader: School, purchasing: ShoppingCart,
  finance: Wallet, receiving: PackageCheck, admin: ShieldCheck,
};

export type GroupTone = "blue" | "orange" | "green";
export interface DemoAccount { id: string; role: Role; label: string; also: string[]; person: string; scope: string }
export interface AccountGroup { label: string; tone: GroupTone; accounts: DemoAccount[] }

// Static class maps so Tailwind sees every token class.
const TONE: Record<GroupTone, { dot: string; icon: string; iconOn: string; on: string }> = {
  blue: { dot: "bg-blue", icon: "bg-blue-soft text-blue", iconOn: "bg-blue text-primary-card-ink", on: "border-blue/60 bg-blue-soft/55 ring-blue/25" },
  orange: { dot: "bg-orange", icon: "bg-orange-soft text-orange", iconOn: "bg-orange text-primary-card-ink", on: "border-orange/60 bg-orange-soft/55 ring-orange/25" },
  green: { dot: "bg-green", icon: "bg-green-soft text-green", iconOn: "bg-green text-primary-card-ink", on: "border-green/60 bg-green-soft/55 ring-green/25" },
};

function Continue({ name, role }: { name: string; role: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="login-continue group mt-5 flex h-[52px] w-full items-center justify-between gap-3 rounded-full bg-blue pr-2 pl-6 text-left text-primary-card-ink disabled:opacity-85">
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[14.5px] font-medium">{pending ? "Opening workspace…" : `Continue as ${name}`}</span>
        <span className="block truncate text-[11.5px] opacity-75">{role}</span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-card-ink/15 transition-transform duration-200 group-hover:translate-x-0.5">
        {pending ? <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden /> : <ArrowRight className="size-4" />}
      </span>
    </button>
  );
}

/** Demo account chooser: a radio group (arrow keys move, Enter or double-click signs in) and one Continue action. */
export function RolePicker({ groups, next }: { groups: AccountGroup[]; next?: string }) {
  const all = groups.flatMap((g) => g.accounts);
  const [selected, setSelected] = useState(all[0]?.id ?? "");
  const form = useRef<HTMLFormElement>(null);
  const radios = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = all.find((a) => a.id === selected) ?? all[0];

  const onKeyDown = (e: KeyboardEvent) => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (d) {
      e.preventDefault();
      const i = all.findIndex((a) => a.id === selected);
      const n = all[(i + d + all.length) % all.length]!;
      setSelected(n.id);
      radios.current[n.id]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      form.current?.requestSubmit();
    }
  };

  return (
    <form ref={form} action={signIn}>
      <input type="hidden" name="userId" value={selected} />
      {next && <input type="hidden" name="next" value={next} />}
      <div role="radiogroup" aria-label="Demo account" onKeyDown={onKeyDown} className="grid gap-4">
        {groups.map((g, gi) => {
          const t = TONE[g.tone];
          return (
            <div key={g.label} className="login-rise" style={{ animationDelay: `${200 + gi * 80}ms` }}>
              <p className="mb-1.5 flex items-center gap-2 px-0.5 text-[10.5px] font-medium tracking-[0.16em] text-ink-3 uppercase">
                <i className={cn("size-1.5 rounded-full", t.dot)} aria-hidden />{g.label}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {g.accounts.map((a) => {
                  const Icon = ICONS[a.role];
                  const on = a.id === selected;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      ref={(el) => { radios.current[a.id] = el; }}
                      onClick={() => setSelected(a.id)}
                      onDoubleClick={() => form.current?.requestSubmit()}
                      className={cn("login-account relative flex min-h-[54px] w-full items-center gap-2.5 rounded-[15px] border py-2 pr-8 pl-2 text-left", on ? cn("ring-4", t.on) : "border-line bg-surface/80")}
                    >
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px] transition-colors duration-200", on ? t.iconOn : t.icon)}>
                        <Icon className="size-[17px]" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[13.5px] leading-tight font-medium tracking-[-0.01em] text-ink">
                          <span className="truncate">{a.label}</span>
                          {a.also.length > 0 && <TipGroup className="contents"><span data-tip={`Also ${a.also.join(", ")}`} className="shrink-0 rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-medium text-ink-2">+{a.also.length}<span className="sr-only"> more role: {a.also.join(", ")}</span></span></TipGroup>}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{a.person} · {a.scope}</span>
                      </span>
                      <span aria-hidden className={cn("absolute top-2 right-2 grid size-4 place-items-center rounded-full transition-[opacity,transform] duration-200", t.iconOn, on ? "scale-100 opacity-100" : "scale-50 opacity-0")}>
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {current && <Continue name={current.person.split(" ")[0]!} role={`${[current.label, ...current.also].join(" + ")} · ${current.scope}`} />}
    </form>
  );
}
