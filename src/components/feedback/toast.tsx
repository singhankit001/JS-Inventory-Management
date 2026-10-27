"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "info" | "error";
interface Toast { id: number; title: string; body?: string; tone: ToastTone }

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const icons = { success: CheckCircle2, info: Info, error: TriangleAlert };
const iconTone = { success: "text-green", info: "text-blue", error: "text-red" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id));
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div role="region" aria-live="polite" aria-label="Notifications" className="pointer-events-none fixed right-4 bottom-24 z-[60] flex w-[min(92vw,360px)] flex-col gap-2 lg:bottom-6">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div key={t.id} className="animate-pop pointer-events-auto flex items-start gap-3 rounded-[18px] border border-line bg-surface p-4 shadow-pop">
              <Icon className={cn("mt-0.5 size-4.5 shrink-0", iconTone[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium">{t.title}</p>
                {t.body && <p className="text-label text-ink-3">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-3 hover:text-ink"><X className="size-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
