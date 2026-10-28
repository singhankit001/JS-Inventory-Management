"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import {
  Bell, Building2, CheckCheck, ChevronDown, CornerDownLeft, LayoutGrid, LogOut, Menu as MenuIcon, Moon, Plus, Search, Sparkles, Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { MobileNavList, type NavEntry } from "./nav-menu";
import { CountBadge, StatusBadge } from "@/components/ui/badge";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import { signOut, switchWorkspace } from "@/app/actions/session";
import { markRead } from "@/app/actions/notifications";
import { useToast } from "@/components/feedback/toast";

export type { NavEntry } from "./nav-menu";
export interface CommandEntry { label: string; href: string; group: string; planned?: boolean }
export interface QuickAction { label: string; href?: string; phase?: 2 | 3 }
export interface ShellNotification { id: string; title: string; body: string; when: string; read: boolean; severity: "info" | "warning" | "critical"; href?: string }

/* ───────────── Mobile navigation drawer ───────────── */
export function MobileNav({ entries }: { entries: NavEntry[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <D.Trigger className="grid size-10 place-items-center rounded-full bg-surface shadow-card ring-1 ring-line/70 transition-[background-color,transform,translate,scale] duration-200 hover:bg-surface-2 active:scale-95 lg:hidden" aria-label="Open navigation"><MenuIcon className="size-4.5" /></D.Trigger>
      <DrawerContent title="Navigate" description="Every section and page your role can open.">
        <MobileNavList entries={entries} />
      </DrawerContent>
    </Dialog>
  );
}

/* ───────────── Theme ───────────── */
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);
  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    try { localStorage.setItem("theme", next); } catch { /* private mode: theme still applies for this visit */ }
    // Cross-fade the whole UI where the View Transitions API exists.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
    else apply();
  }, []);
  return { theme, toggle };
}

/* ───────────── Command menu (⌘K / Ctrl-K / "/") ───────────── */
export function CommandMenu({ commands, open, onOpenChange }: { commands: CommandEntry[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return commands.filter((c) => !s || c.label.toLowerCase().includes(s) || c.group.toLowerCase().includes(s)).slice(0, 12);
  }, [commands, q]);
  useEffect(() => { if (open) { setQ(""); setActive(0); } }, [open]);
  const go = (c: CommandEntry | undefined) => {
    if (!c) return;
    onOpenChange(false);
    router.push(c.href);
  };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgb(10_12_12/0.32)] backdrop-blur-[3px]" />
        <D.Content className="animate-pop fixed top-[14vh] left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-card border border-line bg-surface shadow-pop">
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Jump to a page or module</D.Description>
          <div className="flex items-center gap-3 border-b border-line px-5">
            <Search className="size-4.5 text-ink-3" />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="cmd-list"
              aria-activedescendant={results[active] ? `cmd-${active}` : undefined}
              placeholder="Search pages and modules…"
              className="h-14 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
              }}
            />
            <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-3">Esc</kbd>
          </div>
          <ul id="cmd-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-6 text-center text-label text-ink-3">No pages match “{q}”.</li>}
            {results.map((c, i) => (
              <li
                key={c.href + c.label}
                id={`cmd-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5", i === active && "bg-surface-2")}
              >
                <span className="flex-1 text-body">{c.label}</span>
                {c.planned && <StatusBadge>Planned</StatusBadge>}
                <span className="text-[11.5px] text-ink-3">{c.group}</span>
                {i === active && <CornerDownLeft className="size-3.5 text-ink-3" />}
              </li>
            ))}
          </ul>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* ───────────── Vertical utility toolbar (bottom dock on mobile) ───────────── */
export function Toolbar({ commands, quickActions }: { commands: CommandEntry[]; quickActions: QuickAction[] }) {
  const { theme, toggle } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const btn = "group relative grid size-10 place-items-center rounded-full text-toolbar-ink transition-[background-color,color,transform,translate,scale] duration-200 hover:bg-white/10 hover:text-white active:scale-95 dark:hover:bg-white/5 [&_svg]:size-[18px]";
  const tip = (label: string) => <span className="pointer-events-none absolute left-full ml-3 hidden rounded-[8px] bg-pill px-2 py-1 text-[11.5px] whitespace-nowrap text-pill-ink opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 lg:block">{label}</span>;

  return (
    <>
      <aside
        aria-label="Utilities"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full bg-toolbar p-1.5 shadow-pop ring-1 ring-white/5 lg:top-1/2 lg:bottom-auto lg:left-6 lg:translate-x-0 lg:-translate-y-1/2 lg:flex-col"
      >
        <button className={btn} onClick={() => setCmdOpen(true)} aria-label="Search (Ctrl K)"><Search />{tip("Search  ⌘K")}</button>
        <Menu>
          <MenuTrigger className={btn} aria-label="Quick actions"><Plus />{tip("Quick actions")}</MenuTrigger>
          <MenuContent side="right" align="start" className="w-64">
            <MenuLabel>Quick actions</MenuLabel>
            {quickActions.length === 0 && <MenuItem disabled>No actions for this workspace</MenuItem>}
            {quickActions.map((a) =>
              a.href ? (
                <MenuItem key={a.label} asChild><Link href={a.href}>{a.label}</Link></MenuItem>
              ) : (
                <MenuItem key={a.label} disabled className="justify-between">{a.label}<StatusBadge>Phase {a.phase ?? 2}</StatusBadge></MenuItem>
              ),
            )}
          </MenuContent>
        </Menu>
        <button className={btn} onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>{theme === "dark" ? <Sun /> : <Moon />}{tip(theme === "dark" ? "Light mode" : "Dark mode")}</button>
        <span className="mx-1 h-6 w-px bg-white/10 lg:mx-0 lg:my-1 lg:h-px lg:w-6" aria-hidden />
        <button className={btn} onClick={() => setAiOpen(true)} aria-label="AI assistant"><Sparkles />{tip("AI assistant")}</button>
        <Link className={btn} href="/design-system" aria-label="Design system"><LayoutGrid />{tip("Design system")}</Link>
      </aside>
      <CommandMenu commands={commands} open={cmdOpen} onOpenChange={setCmdOpen} />
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DrawerContent title="AI assistant" description="Ask about stock, requests and spend in plain language.">
          <div className="rounded-tile border border-dashed border-line-strong p-5">
            <StatusBadge tone="amber" dot>Not connected</StatusBadge>
            <p className="mt-3 text-body text-ink-2">The assistant needs the AI integration, which is scheduled for Phase 3. Nothing you type here would be answered yet, so the input is disabled rather than pretending.</p>
            <p className="mt-4 text-eyebrow font-medium tracking-[0.1em] text-ink-3 uppercase">It will answer questions like</p>
            <ul className="mt-2 grid gap-2 text-label text-ink-2">
              <li className="rounded-[12px] bg-surface-2 px-3 py-2">“Which centres will run out of hand wash this month?”</li>
              <li className="rounded-[12px] bg-surface-2 px-3 py-2">“Why is Wakad over budget?”</li>
              <li className="rounded-[12px] bg-surface-2 px-3 py-2">“Draft next month’s request from last term’s usage.”</li>
            </ul>
          </div>
          <input disabled placeholder="Ask anything… (Phase 3)" className="mt-4 h-11 w-full rounded-full border border-line bg-surface-2 px-4 text-body opacity-60" />
        </DrawerContent>
      </Dialog>
    </>
  );
}

/* ───────────── Notifications ───────────── */
const sevTone = { info: "blue", warning: "amber", critical: "red" } as const;

export function NotificationsMenu({ items, demo = false }: { items: ShellNotification[]; demo?: boolean }) {
  const toast = useToast();
  const [, start] = useTransition();
  // Read ids flip instantly; the server action's revalidation then delivers the persisted state as new props.
  const [readIds, addRead] = useOptimistic<string[], string[]>([], (s, ids) => [...s, ...ids]);
  const list = items.map((n) => (n.read || readIds.includes(n.id) ? { ...n, read: true } : n));
  const unread = list.filter((n) => !n.read).length;
  const mark = (ids?: string[]) => start(async () => {
    addRead(ids ?? list.map((n) => n.id));
    const res = await markRead(ids).catch(() => ({ ok: false }));
    if (!res.ok) toast({ tone: "error", title: "Couldn't update notifications", body: "Your read state wasn't saved. Try again." });
  });
  return (
    <Menu>
      <MenuTrigger className="relative grid size-10 place-items-center rounded-full bg-surface shadow-card ring-1 ring-line/70 transition-[background-color,transform,translate,scale] duration-200 hover:bg-surface-2 active:scale-95" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="size-4" strokeWidth={1.75} />
        {unread > 0 && <span className="absolute -top-1 -right-1 flex rounded-full ring-2 ring-canvas" aria-hidden><CountBadge count={unread} /></span>}
      </MenuTrigger>
      <MenuContent className="w-[min(92vw,360px)]">
        <div className="flex items-baseline justify-between gap-3 pr-2.5">
          <MenuLabel>Notifications</MenuLabel>
          {unread > 0 && <span className="text-[11.5px] text-ink-3 tabular">{unread} unread</span>}
        </div>
        {list.length === 0 && <p className="px-2.5 py-4 text-label text-ink-3">You&apos;re all caught up.</p>}
        {list.map((n) => {
          const body = (
            <div className="flex gap-3">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-line-strong" : { info: "bg-blue", warning: "bg-amber", critical: "bg-red" }[n.severity])} aria-hidden />
              <div className="min-w-0">
                <p className={cn("text-body", n.read ? "text-ink-2" : "font-medium text-ink")}>{!n.read && <span className="sr-only">Unread: </span>}{n.title}</p>
                <p className="text-label text-ink-3">{n.body}</p>
                <p className="mt-0.5 text-[11px] text-ink-3">{n.when} {n.severity !== "info" && <StatusBadge tone={sevTone[n.severity]} className="ml-1">{n.severity}</StatusBadge>}</p>
              </div>
            </div>
          );
          const onRead = () => { if (!n.read) mark([n.id]); };
          return n.href
            ? <MenuItem key={n.id} asChild onSelect={onRead}><Link href={n.href} className="!items-start">{body}</Link></MenuItem>
            // No destination: stay open so the item visibly turns read.
            : <MenuItem key={n.id} className="!items-start" onSelect={(e) => { e.preventDefault(); onRead(); }}>{body}</MenuItem>;
        })}
        {list.length > 0 && (
          <>
            <MenuSeparator />
            <MenuItem disabled={unread === 0} onSelect={() => mark()}><CheckCheck />Mark all as read</MenuItem>
            {demo && <p className="px-2.5 pt-0.5 pb-1 text-[11px] text-ink-3">Demo: read state resets daily</p>}
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

/* ───────────── Profile + workspace switcher ───────────── */
export function ProfileMenu({ name, email, initials, role, roles }: { name: string; email: string; initials: string; role: string; roles: { role: string; label: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <Menu>
      <MenuTrigger className="grid size-10 place-items-center rounded-full bg-[#cfe6e4] text-[12px] font-semibold text-[#1f4b48] ring-2 ring-surface transition-transform duration-200 active:scale-95 dark:bg-[#1f3b39] dark:text-[#bfe3df]" aria-label={`Account: ${name}`}>
        {initials}
      </MenuTrigger>
      <MenuContent className="w-72">
        <div className="px-2.5 py-2">
          <p className="text-body font-medium">{name}</p>
          <p className="text-label text-ink-3">{email}</p>
        </div>
        <MenuSeparator />
        <MenuLabel>Workspace</MenuLabel>
        <MenuRadioGroup value={role} onValueChange={(r) => start(() => switchWorkspace(r))}>
          {roles.map((r) => <MenuRadioItem key={r.role} value={r.role} disabled={pending}>{r.label}</MenuRadioItem>)}
        </MenuRadioGroup>
        {roles.length === 1 && <p className="px-2.5 pb-1 text-[11.5px] text-ink-3">You hold one role.</p>}
        <MenuSeparator />
        <MenuItem onSelect={() => start(() => signOut())}><LogOut />Sign out</MenuItem>
      </MenuContent>
    </Menu>
  );
}

/* ───────────── Centre selector (multi-centre sessions only) ───────────── */
export function CentreSelect({ centres }: { centres: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("centre") ?? "all";
  const label = centres.find((c) => c.id === current)?.name ?? "All centres";
  const choose = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === "all") next.delete("centre");
    else next.set("centre", id);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`);
  };
  return (
    <Menu>
      <MenuTrigger className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-3.5 text-label font-medium shadow-card ring-1 ring-line/70 transition-[background-color,transform,translate,scale] duration-200 hover:bg-surface-2 active:scale-[0.97]">
        <Building2 className="size-4 text-ink-3" />
        <span className="max-w-32 truncate">{label}</span>
        <ChevronDown className="size-3.5 text-ink-3" />
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Centre</MenuLabel>
        <MenuRadioGroup value={current} onValueChange={choose}>
          <MenuRadioItem value="all">All authorised centres</MenuRadioItem>
          {centres.map((c) => <MenuRadioItem key={c.id} value={c.id}>{c.name}</MenuRadioItem>)}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
