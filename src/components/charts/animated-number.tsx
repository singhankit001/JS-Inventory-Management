"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { count, money, moneyCompact, percent } from "@/lib/format";

const formats = { money, moneyCompact, count, percent, decimal: (n: number) => n.toFixed(1) } as const;
export type NumberFormat = keyof typeof formats;

/** Has the server-rendered value already been on screen? "fading" = on screen but its card is still entering. */
function visibility(el: HTMLElement): "seen" | "fading" | "offscreen" {
  const r = el.getBoundingClientRect();
  if (document.hidden || r.bottom <= 0 || r.top >= innerHeight) return "offscreen";
  let opacity = 1;
  for (let n: HTMLElement | null = el; n && opacity > 0.05; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
  return opacity > 0.6 ? "seen" : "fading";
}

/**
 * Counts up from 0 on first sight, or from the current value on updates — the reference's metric roll-in.
 * Server-renders the final value (no layout shift, correct without JS). It only resets to 0 where nobody has
 * seen the final value yet: while its card is still fading in, or just before it scrolls into view.
 * Reduced motion: shows the value, never animates.
 */
export function AnimatedNumber({ value, format = "count", duration = 900, suffix }: { value: number; format?: NumberFormat; duration?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const mounted = useRef(false);
  // Layout effect: the reset to 0 lands before the browser paints the client commit.
  useLayoutEffect(() => {
    const el = ref.current;
    const set = (n: number) => { current.current = n; setShown(n); };
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) { set(value); mounted.current = true; return; }
    let raf = 0;
    let io: IntersectionObserver | undefined;
    const run = (a: number) => {
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        set(a + (value - a) * (1 - Math.pow(1 - p, 3))); // power3.out, same curve as --ease-out-3
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    if (mounted.current) run(current.current);
    else {
      mounted.current = true;
      const v = visibility(el);
      if (v === "fading") set(0); // the count-up rides along with the card's enter animation
      if (v !== "seen") {
        // Off-screen numbers keep their final value (print, full-page captures) until just before they scroll in.
        io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { io?.disconnect(); io = undefined; set(0); run(0); } }, { rootMargin: "0px 0px 64px 0px" });
        io.observe(el);
      }
    }
    return () => {
      cancelAnimationFrame(raf);
      // Still waiting to be seen: re-run the first-sight path (value change, or Strict Mode's re-mount).
      if (io) { io.disconnect(); mounted.current = false; }
    };
  }, [value, duration]);
  const f = formats[format];
  // Whole numbers stay whole while counting; ratios and decimals interpolate smoothly.
  const display = format === "count" || format === "money" || format === "moneyCompact" ? f(Math.round(shown)) : f(shown);
  return (
    <span ref={ref} className="tabular">
      <span className="sr-only">{f(value)}{suffix}</span>
      <span aria-hidden>{display}{suffix}</span>
    </span>
  );
}
