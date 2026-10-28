"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { PillGroup, type PillItem } from "@/components/ui/pill-group";
import { CountBadge } from "@/components/ui/badge";

export interface NavLink { label: string; href: string; summary: string }
export interface NavSection { label?: string; links: NavLink[] }
export interface NavEntry { key: string; label: string; href: string; description: string; badge?: number; match: string[]; sections: NavSection[] }

export const isActive = (pathname: string, e: NavEntry) => e.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

/** The link whose href is the longest prefix of the path, so /inventory doesn't light up on /inventory/counts. */
export function activeHref(pathname: string, links: NavLink[]) {
  return links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function useMinWidth(px: number) {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(`(min-width: ${px}px)`); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => matchMedia(`(min-width: ${px}px)`).matches,
    () => false,
  );
}

const CLOSE_DELAY = 140; // ms of grace while the cursor crosses from a pill to its panel
const GUTTER = 12;

/* ───────────── Floating pill navigation with hover mega-menus ───────────── */
export function TopNav({ entries }: { entries: NavEntry[] }) {
  const pathname = usePathname();
  const wide = useMinWidth(1440);
  const maxVisible = wide ? entries.length : 6;
  const active = entries.find((e) => isActive(pathname, e));
  let visible = entries.slice(0, maxVisible);
  if (active && !visible.includes(active)) visible = [...visible.slice(0, maxVisible - 1), active];
  const overflow = entries.filter((e) => !visible.includes(e));
  const more: NavEntry | undefined = overflow.length
    ? { key: "more", label: "More", href: overflow[0]!.href, description: "Other sections you can open.", match: [], sections: overflow.map((e) => ({ label: e.label, links: e.sections.flatMap((s) => s.links) })) }
    : undefined;
  const all = more ? [...visible, more] : visible;

  const [openKey, setOpenKey] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const pointer = useRef<string>("mouse");
  const wasOpen = useRef(false);
  const current = all.find((e) => e.key === openKey);

  const open = (key: string) => { window.clearTimeout(timer.current); setOpenKey(key); };
  const scheduleClose = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpenKey(null), CLOSE_DELAY); };
  const trigger = (key: string) => wrapRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  const keyOf = (t: EventTarget) => (t instanceof Element ? t.closest("[data-key]")?.getAttribute("data-key") : null) ?? null;

  useEffect(() => setOpenKey(null), [pathname]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // A tap or click anywhere else closes the panel.
  useEffect(() => {
    if (!openKey) return;
    const onDown = (e: globalThis.PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpenKey(null); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openKey]);

  // Mark the pill whose menu is open so it keeps its hover tint.
  useEffect(() => {
    const t = openKey ? trigger(openKey) : null;
    if (t) t.dataset.open = "true";
    return () => { if (t) delete t.dataset.open; };
  }, [openKey]);

  // Centre the panel under its pill, clamped to the viewport. Slides between pills once open.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const wrap = wrapRef.current;
    const t = openKey ? trigger(openKey) : null;
    if (!panel || !wrap || !t) { wasOpen.current = false; return; }
    const tr = t.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const w = panel.offsetWidth;
    const centre = tr.left + tr.width / 2;
    const left = Math.min(Math.max(centre - w / 2, GUTTER), window.innerWidth - GUTTER - w);
    panel.dataset.moving = wasOpen.current ? "true" : "false";
    panel.style.transform = `translateX(${Math.round(left - wr.left)}px)`;
    panel.style.setProperty("--origin-x", `${Math.round(centre - left)}px`);
    wasOpen.current = true;
  }, [openKey]);

  const focusables = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? []);
  const onKeyDown = (e: KeyboardEvent) => {
    const key = keyOf(e.target);
    if (e.key === "Escape" && openKey) {
      e.preventDefault();
      const k = openKey;
      setOpenKey(null);
      trigger(k)?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = focusables();
    const inPanel = panelRef.current?.contains(e.target as Node);
    if (!inPanel && key && e.key === "ArrowDown") {
      e.preventDefault();
      open(key);
      requestAnimationFrame(() => focusables()[0]?.focus());
    } else if (inPanel) {
      e.preventDefault();
      const i = items.indexOf(e.target as HTMLElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  };

  const items: PillItem[] = visible.map((e) => ({
    key: e.key, label: e.label, href: e.href,
    badge: e.badge ? <CountBadge count={e.badge} label={`${e.badge} pending in ${e.label}`} /> : undefined,
  }));

  const onPointerOver = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (panelRef.current?.contains(e.target as Node)) return window.clearTimeout(timer.current);
    const key = keyOf(e.target);
    if (key) open(key);
  };

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center gap-1"
      onPointerDown={(e) => { pointer.current = e.pointerType; }}
      onPointerOver={onPointerOver}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") scheduleClose(); }}
      onFocus={(e) => { const k = keyOf(e.target); if (k && e.target.matches(":focus-visible")) open(k); }}
      onBlur={(e) => { if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpenKey(null); }}
      onKeyDown={onKeyDown}
      onClickCapture={(e) => {
        // Touch and pen: the first tap on a pill opens its menu, the second follows the link.
        const key = keyOf(e.target);
        if (!key || panelRef.current?.contains(e.target as Node)) return;
        if (key === "more" || (pointer.current !== "mouse" && openKey !== key)) { e.preventDefault(); setOpenKey(openKey === key ? null : key); }
      }}
    >
      <PillGroup variant="nav" ariaLabel="Primary" items={items} activeKey={active?.key} />
      {more && (
        <button
          type="button"
          data-key="more"
          aria-expanded={openKey === "more"}
          aria-controls="nav-panel"
          className="grid size-11 place-items-center rounded-full bg-surface/80 text-ink-2 shadow-card ring-1 ring-line/70 backdrop-blur-xl transition-[background-color,color,transform,translate,scale] duration-200 hover:bg-surface-3 hover:text-ink active:scale-95 aria-expanded:bg-surface-3 aria-expanded:text-ink"
          aria-label="More sections"
        >
          <MoreHorizontal className="size-4" />
        </button>
      )}
      {current && (
        <div ref={panelRef} id="nav-panel" className="nav-panel absolute top-full left-0 z-50 pt-2.5">
          <div className="nav-panel-card w-[min(calc(100vw-24px),520px)] overflow-hidden rounded-[22px] border border-line/80 bg-surface/95 p-2 shadow-pop backdrop-blur-2xl">
            <NavPanelBody entry={current} pathname={pathname} />
          </div>
        </div>
      )}
    </div>
  );
}

function NavPanelBody({ entry, pathname }: { entry: NavEntry; pathname: string }) {
  const here = activeHref(pathname, entry.sections.flatMap((s) => s.links));
  return (
    <>
      <div className="flex items-baseline justify-between gap-4 px-3 pt-2 pb-2.5">
        <p className="text-eyebrow font-medium tracking-[0.12em] text-ink-3 uppercase">{entry.label}</p>
        <p className="truncate text-[12px] text-ink-3">{entry.description}</p>
      </div>
      <div className="grid gap-2">
        {entry.sections.map((s) => (
          <div key={s.label ?? "main"} className={cn(s.label && "border-t border-line/70 pt-2")}>
            {s.label && <p className="px-3 pb-1 text-[11.5px] font-medium text-ink-2">{s.label}</p>}
            <ul className="grid gap-0.5 sm:grid-cols-2">
              {s.links.map((l) => {
                const on = l.href === here;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "group/link flex h-full flex-col gap-0.5 rounded-[14px] px-3 py-2.5 outline-offset-[-2px] transition-colors duration-150",
                        on ? "bg-pill text-pill-ink" : "hover:bg-surface-2",
                      )}
                    >
                      <span className="text-body font-medium tracking-[-0.005em]">{l.label}</span>
                      <span className={cn("line-clamp-2 text-[12px] leading-[1.35]", on ? "text-pill-ink/70" : "text-ink-3")}>{l.summary}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

/* ───────────── Mobile / tablet navigation: every module with its pages ───────────── */
export function MobileNavList({ entries }: { entries: NavEntry[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary (mobile)">
      <ul className="grid gap-1.5">
        {entries.map((e) => {
          const on = isActive(pathname, e);
          const links = e.sections.flatMap((s) => s.links);
          const here = activeHref(pathname, links);
          return (
            <li key={e.key}>
              <details open={on} className="group/d rounded-[16px] open:bg-surface-2/70">
                <summary className={cn("flex h-12 cursor-pointer list-none items-center justify-between rounded-[16px] px-4 text-body font-medium transition-colors [&::-webkit-details-marker]:hidden", on ? "text-ink" : "hover:bg-surface-2")}>
                  <span className="flex items-center gap-2">{e.label}{e.badge ? <CountBadge count={e.badge} /> : null}</span>
                  <ChevronDown className="size-4 text-ink-3 transition-transform duration-200 group-open/d:rotate-180" />
                </summary>
                <ul className="grid gap-0.5 px-2 pb-2">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} aria-current={l.href === here ? "page" : undefined} className={cn("flex min-h-11 items-center rounded-[12px] px-3 text-label transition-colors", l.href === here ? "bg-pill font-medium text-pill-ink" : "text-ink-2 hover:bg-surface hover:text-ink")}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
