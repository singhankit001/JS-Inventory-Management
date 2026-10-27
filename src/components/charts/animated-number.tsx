"use client";

import { useEffect, useRef, useState } from "react";
import { count, money, moneyCompact, percent } from "@/lib/format";

const formats = { money, moneyCompact, count, percent, decimal: (n: number) => n.toFixed(1) } as const;
export type NumberFormat = keyof typeof formats;

/**
 * Counts up from 0 (first paint) or the previous value (updates) — the reference's metric roll-in.
 * Server-renders the final value so there is no layout shift and no-JS still reads correctly.
 */
export function AnimatedNumber({ value, format = "count", duration = 900, suffix }: { value: number; format?: NumberFormat; duration?: number; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // power3.out, same curve as --ease-out-3
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const f = formats[format];
  // Whole numbers stay whole while counting; ratios and decimals interpolate smoothly.
  const display = format === "count" || format === "money" || format === "moneyCompact" ? f(Math.round(shown)) : f(shown);
  return <span className="tabular" aria-label={`${f(value)}${suffix ?? ""}`}><span aria-hidden>{display}{suffix}</span></span>;
}
