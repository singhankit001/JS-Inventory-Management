"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import {
  Bell, Building2, ChevronDown, CornerDownLeft, LayoutGrid, LogOut, Menu as MenuIcon, Moon, MoreHorizontal, Plus, Search, Sparkles, Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { PillGroup, type PillItem } from "@/components/ui/pill-group";
import { CountBadge, StatusBadge } from "@/components/ui/badge";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import { signOut, switchWorkspace } from "@/app/actions/session";

export interface NavEntry { key: string; label: string; href: string; badge?: number; match: string[] }
export interface CommandEntry { label: string; href: string; group: string; planned?: boolean }
export interface QuickAction { label: string; href?: string; phase?: 2 | 3 }
export interface ShellNotification { id: string; title: string; body: string; when: string; read: boolean; severity: "info" | "warning" | "critical"; href?: string }

const isActive = (pathname: string, e: NavEntry) => e.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

/* ───────────── Floating top navigation ───────────── */
export function TopNav({ entries, maxVisible = 6 }: { entries: NavEntry[]; maxVisible?: number }) {
  const pathname = usePathname();
  const active = entries.find((e) => isActive(pathname, e));
  // Keep the active entry visible even if it lives in the overflow.
  let visible = entries.slice(0, maxVisible);
  if (active && !visible.includes(active)) visible = [...visible.slice(0, maxVisible - 1), active];
  const overflow = entries.filter((e) => !visible.includes(e));
  const items: PillItem[] = visible.map((e) => ({ key: e.key, label: e.label, href: e.href, badge: e.badge ? <CountBadge count={e.badge} label={`${e.badge} pending in ${e.label}`} /> : undefined }));
  return (
    <div className="flex items-center gap-1">
      <PillGroup variant="nav" ariaLabel="Primary" items={items} activeKey={active?.key} />
      {overflow.length > 0 && (
        <Menu>
          <MenuTrigger className="grid size-10 place-items-center rounded-full bg-surface/80 text-ink-2 shadow-card ring-1 ring-line/70 backdrop-blur-xl transition-[color,transform] duration-200 hover:text-ink active:scale-95" aria-label="More sections"><MoreHorizontal className="size-4" /></MenuTrigger>
          <MenuContent>
            {overflow.map((e) => (
              <MenuItem key={e.key} asChild><Link href={e.href} className="justify-between">{e.label}{e.badge ? <CountBadge count={e.badge} /> : null}</Link></MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}
    </div>
  );
}

/* ───────────── Mobile navigation drawer ───────────── */
export function MobileNav({ entries }: { entries: NavEntry[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <D.Trigger className="grid size-10 place-items-center rounded-full bg-surface shadow-card ring-1 ring-line/70 transition-[background-color,transform] duration-200 hover:bg-surface-2 active:scale-95 lg:hidden" aria-label="Open navigation"><MenuIcon className="size-4.5" /></D.Trigger>
      <DrawerContent title="Navigate">
        <nav aria-label="Primary (mobile)">
          <ul className="grid gap-1">
            {entries.map((e) => {
              const active = isActive(pathname, e);
              return (
                <li key={e.key}>
                  <Link href={e.href} aria-current={active ? "page" : undefined} className={cn("flex h-12 items-center justify-between rounded-[14px] px-4 text-body font-medium transition-colors", active ? "bg-pill text-pill-ink" : "hover:bg-surface-2")}>
                    {e.label}
                    {e.badge ? <CountBadge count={e.badge} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
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

  const btn = "group relative grid size-10 place-items-center rounded-full text-toolbar-ink transition-[background-color,color,transform] duration-200 hover:bg-white/10 hover:text-white active:scale-95 dark:hover:bg-white/5 [&_svg]:size-[18px]";
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
              <li className="rounded-[12px] bg-surface-2 px-3 py-2">“Why is Powai over budget?”</li>
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

export function NotificationsMenu({ items }: { items: ShellNotification[] }) {
  const unread = items.filter((n) => !n.read).length;
  return (
    <Menu>
      <MenuTrigger className="relative grid size-10 place-items-center rounded-full bg-surface shadow-card ring-1 ring-line/70 transition-[background-color,transform] duration-200 hover:bg-surface-2 active:scale-95" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="size-4" strokeWidth={1.75} />
        {unread > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-orange ring-2 ring-surface" aria-hidden />}
      </MenuTrigger>
      <MenuContent className="w-[min(92vw,360px)]">
        <MenuLabel>Notifications</MenuLabel>
        {items.length === 0 && <p className="px-2.5 py-4 text-label text-ink-3">You&apos;re all caught up.</p>}
        {items.map((n) => {
          const body = (
            <div className="flex gap-3">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-line-strong" : { info: "bg-blue", warning: "bg-amber", critical: "bg-red" }[n.severity])} aria-hidden />
              <div className="min-w-0">
                <p className="text-body font-medium">{n.title}</p>
                <p className="text-label text-ink-3">{n.body}</p>
                <p className="mt-0.5 text-[11px] text-ink-3">{n.when} {n.severity !== "info" && <StatusBadge tone={sevTone[n.severity]} className="ml-1">{n.severity}</StatusBadge>}</p>
              </div>
            </div>
          );
          return n.href ? <MenuItem key={n.id} asChild><Link href={n.href} className="!items-start">{body}</Link></MenuItem> : <MenuItem key={n.id} className="!items-start">{body}</MenuItem>;
        })}
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
      <MenuTrigger className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-3.5 text-label font-medium shadow-card ring-1 ring-line/70 transition-[background-color,transform] duration-200 hover:bg-surface-2 active:scale-[0.97]">
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
