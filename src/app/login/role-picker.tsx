"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Building2, LineChart, PackageCheck, School, ShieldCheck, ShoppingCart, Wallet, type LucideIcon } from "lucide-react";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/cn";
import { signIn } from "@/app/actions/session";

const ICONS: Record<Role, LucideIcon> = {
  ceo: LineChart, head_office: Building2, centre_leader: School, purchasing: ShoppingCart,
  finance: Wallet, receiving: PackageCheck, admin: ShieldCheck,
};

export interface DemoAccount { id: string; role: Role; label: string; person: string; scope: string }
export interface AccountGroup { label: string; accounts: DemoAccount[] }

function Continue({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="login-continue group relative mt-6 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-pill text-[14.5px] font-medium text-pill-ink shadow-float disabled:opacity-80">
      {pending
        ? <><span className="size-4 animate-spin rounded-full border-2 border-pill-ink/30 border-t-pill-ink" aria-hidden />Opening workspace…</>
        : <>Continue as {name}<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" /></>}
    </button>
  );
}

/** Demo account chooser: a radio group (arrow keys move, Enter or double-click signs in) plus one Continue button. */
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
      <div role="radiogroup" aria-label="Demo account" onKeyDown={onKeyDown} className="grid gap-5">
        {groups.map((g, gi) => (
          <div key={g.label} className="login-rise" style={{ animationDelay: `${180 + gi * 70}ms` }}>
            <p className="mb-2 px-1 text-[11px] font-medium tracking-[0.14em] text-ink-3 uppercase">{g.label}</p>
            <div className="grid gap-1 rounded-[20px] bg-surface-2/70 p-1 ring-1 ring-line/70">
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
                    className={cn("login-account flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left", on ? "bg-surface shadow-card ring-1 ring-line" : "text-ink-2")}
                  >
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px] transition-colors duration-200", on ? "bg-pill text-pill-ink" : "bg-surface text-ink-3 ring-1 ring-line/80")}>
                      <Icon className="size-[17px]" strokeWidth={1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-body leading-tight font-medium tracking-[-0.01em]", on && "text-ink")}>{a.label}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-3">{a.person} · {a.scope}</span>
                    </span>
                    <span aria-hidden className={cn("grid size-[18px] shrink-0 place-items-center rounded-full ring-1 transition-[background-color,box-shadow] duration-200", on ? "bg-pill ring-pill" : "ring-line-strong")}>
                      <span className={cn("size-1.5 rounded-full bg-pill-ink transition-transform duration-200", on ? "scale-100" : "scale-0")} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {current && <Continue name={current.person.split(" ")[0]!} />}
    </form>
  );
}
