"use client";

import { useRef } from "react";

/**
 * Pointer parallax for the hero: writes --px/--py (−1…1, quantised) on the stage; CSS turns them into a small camera
 * tilt and per-layer depth shifts. One rAF per pointer frame, nothing at rest, skipped on touch and reduced motion.
 */
export function SceneStage({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const set = (x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", x.toFixed(2));
    el.style.setProperty("--py", y.toFixed(2));
  };
  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = ((e.clientY - r.top) / r.height) * 2 - 1;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => set(x, y));
      }}
      onPointerLeave={() => { cancelAnimationFrame(frame.current); set(0, 0); }}
    >
      {children}
    </div>
  );
}
