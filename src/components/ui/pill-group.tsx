"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PillItem {
  key: string;
  label: ReactNode;
  href?: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

const styles = {
  nav: {
    track: "rounded-full bg-surface/80 p-1 shadow-card ring-1 ring-line/70 backdrop-blur-xl",
    item: "h-10 px-4 text-[13.5px]",
    pill: "bg-pill text-pill-ink",
    // Light tint of the pill colour (black in light theme, off-white in dark) under the hovered item. data-open keeps it
    // while that item's menu is open, so the pill stays lit as the cursor moves into the panel or focus moves by keyboard.
    idle: "text-ink-2 hover:bg-pill/10 hover:text-ink data-[open=true]:bg-pill/10 data-[open=true]:text-ink",
  },
  segmented: {
    track: "rounded-full bg-surface-3/80 p-1",
    item: "h-8 px-3.5 text-label",
    pill: "bg-surface text-ink shadow-card",
    idle: "text-ink-3 hover:text-ink",
  },
} as const;

/**
 * Pill navigation / segmented control with the reference video's sliding pill:
 * a duplicate label layer clipped to the active item, so the text colour flips exactly
 * at the pill edge while the leading edge outruns the trailing edge (see .slide-pill in globals.css).
 */
export function PillGroup({
  items, activeKey, onSelect, variant = "segmented", ariaLabel, className,
}: {
  items: PillItem[];
  activeKey: string | undefined;
  onSelect?: (key: string) => void;
  variant?: keyof typeof styles;
  ariaLabel: string;
  className?: string;
}) {
  const s = styles[variant];
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const prevLeft = useRef<number | null>(null);
  const activeIndex = items.findIndex((i) => i.key === activeKey);

  const place = useCallback((animate: boolean) => {
    const track = trackRef.current;
    const pill = pillRef.current;
    const target = track?.querySelector<HTMLElement>(`[data-key="${CSS.escape(activeKey ?? "")}"]`);
    if (!track || !pill) return;
    if (!target) {
      pill.style.opacity = "0";
      return;
    }
    const W = track.clientWidth;
    const H = track.clientHeight;
    const l = target.offsetLeft;
    const fwd = prevLeft.current === null || l >= prevLeft.current;
    pill.dataset.dir = animate ? (fwd ? "fwd" : "back") : "none";
    pill.style.opacity = "1";
    pill.style.setProperty("--pl", `${l}px`);
    pill.style.setProperty("--pr", `${W - (l + target.offsetWidth)}px`);
    pill.style.setProperty("--pt", `${target.offsetTop}px`);
    pill.style.setProperty("--pb", `${H - (target.offsetTop + target.offsetHeight)}px`);
    prevLeft.current = l;
  }, [activeKey]);

  useLayoutEffect(() => {
    place(prevLeft.current !== null);
  }, [place]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(track);
    // Fonts load after first paint and change item widths.
    document.fonts?.ready.then(() => place(false));
    return () => ro.disconnect();
  }, [place]);

  const isTabs = !items.some((i) => i.href);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isTabs || !onSelect) return;
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = items[(activeIndex + delta + items.length) % items.length];
    if (next) {
      onSelect(next.key);
      trackRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"]`)?.focus();
    }
  };

  const content = (item: PillItem) => (
    <>
      {item.icon}
      <span>{item.label}</span>
      {item.badge}
    </>
  );
  const itemClass = cn("relative inline-flex items-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors duration-200", s.item);

  return (
    <div
      ref={trackRef}
      role={isTabs ? "tablist" : undefined}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("relative inline-flex w-max items-center", s.track, className)}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return item.href ? (
          <Link key={item.key} data-key={item.key} href={item.href} aria-current={active ? "page" : undefined} className={cn(itemClass, s.idle)} onClick={() => onSelect?.(item.key)}>
            {content(item)}
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            data-key={item.key}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={cn(itemClass, s.idle)}
            onClick={() => onSelect?.(item.key)}
          >
            {content(item)}
          </button>
        );
      })}
      {/* Inverted duplicate, clipped to the active item. Decorative only. */}
      <div ref={pillRef} aria-hidden className={cn("slide-pill pointer-events-none absolute inset-0 flex items-center rounded-full p-1 opacity-0", s.pill)}>
        {items.map((item) => (
          <span key={item.key} className={itemClass}>
            {content(item)}
          </span>
        ))}
      </div>
    </div>
  );
}
