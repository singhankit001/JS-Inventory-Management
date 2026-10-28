"use client";

import { CheckCircle2, Send, Undo2 } from "lucide-react";
import { decidePO } from "@/app/actions/procurement";
import { Button } from "@/components/ui/button";
import type { PoAction } from "@/features/procurement/shared";
import { useDemoAction } from "./use-demo-action";

const icon = { authorise: CheckCircle2, returnToDraft: Undo2, submit: Send };

/** Workflow buttons for one PO. A button blocked by separation of duties stays visible, disabled, with the policy reason. */
export function PoActions({ poId, actions }: { poId: string; actions: { command: PoAction; label: string; blocked?: string }[] }) {
  const { pending, run } = useDemoAction();
  if (!actions.length) return null;
  const reason = actions.find((a) => a.blocked)?.blocked;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = icon[a.command];
          return (
            <Button key={a.command} size="sm" variant={a.command === "returnToDraft" ? "secondary" : "primary"} disabled={pending || !!a.blocked} aria-describedby={a.blocked ? `${poId}-sod` : undefined}
              onClick={() => run(() => decidePO({ purchaseOrderId: poId }, a.command), `${a.label} failed`)}>
              <Icon />{a.label}
            </Button>
          );
        })}
      </div>
      {reason && <p id={`${poId}-sod`} className="text-[12px] text-ink-3">Separation of duties: {reason}</p>}
    </div>
  );
}
