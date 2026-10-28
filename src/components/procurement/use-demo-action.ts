"use client";

import { useTransition } from "react";
import { useToast } from "@/components/feedback/toast";
import type { DemoResult } from "@/lib/demo/command";

/** Runs a demoCommand server action and toasts its message (success says it was saved to demo data). */
export function useDemoAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = <T,>(call: () => Promise<DemoResult<T>>, failTitle: string, onOk?: (data?: T) => void) => start(async () => {
    try {
      const res = await call();
      if (res.ok) { toast({ tone: "success", title: res.message.split(" · ")[0]!, body: "Saved to demo data, which resets daily." }); onOk?.(res.data); }
      else toast({ tone: "error", title: failTitle, body: res.error });
    } catch {
      toast({ tone: "error", title: failTitle, body: "The server could not be reached. Try again." });
    }
  });
  return { pending, run };
}
