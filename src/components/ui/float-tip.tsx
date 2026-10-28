"use client";

import { useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";

interface Tip { text: string; rect: DOMRect }
const GAP = 8;
const EDGE = 8;

/**
 * One shared tooltip for a group of small targets (heatmap cells, timeline dots). Targets carry `data-tip`; the
 * container spreads `handlers`. The tip renders in a fixed layer on <body>, so no card overflow, stacking context or
 * transform can clip it, and it is clamped to the viewport (flipping below the target when there is no room above).
 */
export function useFloatTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const show = (t: EventTarget) => {
    const el = t instanceof Element ? t.closest<HTMLElement>("[data-tip]") : null;
    if (el?.dataset.tip) setTip({ text: el.dataset.tip, rect: el.getBoundingClientRect() });
  };
  const handlers = {
    onPointerOver: (e: PointerEvent) => show(e.target),
    onPointerLeave: () => setTip(null),
    onFocus: (e: FocusEvent) => show(e.target),
    onBlur: () => setTip(null),
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !tip) return;
    const { rect } = tip;
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - w / 2, EDGE), window.innerWidth - EDGE - w);
    const above = rect.top - GAP - h >= EDGE;
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(above ? rect.top - GAP - h : rect.bottom + GAP)}px)`;
    el.dataset.ready = "true";
  }, [tip]);

  // Scrolling moves the target out from under a fixed tip; hide rather than drift.
  useLayoutEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [tip]);

  const node = tip
    ? createPortal(
        <div ref={ref} key={tip.text} role="tooltip" className="float-tip pointer-events-none fixed top-0 left-0 z-[60] w-max max-w-60 rounded-[10px] bg-pill px-2.5 py-1.5 text-[11.5px] leading-snug text-pill-ink shadow-pop">
          {tip.text}
        </div>,
        document.body,
      )
    : null;

  return { handlers, node };
}

/** Server-component-friendly wrapper: any `data-tip` descendant gets the shared tooltip. */
export function TipGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  const { handlers, node } = useFloatTip();
  return <div className={className} {...handlers}>{children}{node}</div>;
}
