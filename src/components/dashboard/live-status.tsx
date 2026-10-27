"use client";

import { useEffect, useState } from "react";

/** Header chip: pulsing dot + live clock + one-line status with progress (reference: "3:36 PM · 5 on the floor"). */
export function LiveStatus({ title, detail, progress }: { title: string; detail: string; progress: number }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="animate-enter flex items-center gap-4 rounded-full bg-surface/80 py-2 pr-5 pl-3 shadow-card ring-1 ring-line/70 backdrop-blur-xl">
      <span className="flex items-center gap-2 text-label font-medium tabular">
        <span className="pulse-dot size-2 rounded-full bg-green" aria-hidden />
        <span suppressHydrationWarning className="min-w-14">{now ?? "—"}</span>
      </span>
      <span className="leading-tight">
        <span className="block text-label font-medium">{title}</span>
        <span className="block text-[11px] text-ink-3">{detail}</span>
      </span>
      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-surface-3 sm:block" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={title}>
        <span className="bar-grow block h-full rounded-full bg-orange" style={{ width: `${p * 100}%` }} />
      </span>
    </div>
  );
}
