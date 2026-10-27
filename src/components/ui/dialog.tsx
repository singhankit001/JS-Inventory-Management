"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay = "fixed inset-0 z-50 bg-[rgb(10_12_12/0.32)] backdrop-blur-[3px] data-[state=open]:animate-[enter_240ms_var(--ease-out-3)]";

export function DialogContent({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content className={cn("animate-pop fixed top-[12vh] left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-card border border-line bg-surface p-6 shadow-pop", className)}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-title font-medium">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-label text-ink-3">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close"><X className="size-4" /></D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

/** Right-hand drawer (bottom sheet on small screens). */
export function DrawerContent({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-card border border-line bg-surface p-6 shadow-pop data-[state=open]:animate-[drawer-up_420ms_var(--ease-out-3)] sm:inset-y-3 sm:right-3 sm:left-auto sm:w-[440px] sm:rounded-card sm:data-[state=open]:animate-[drawer-in_420ms_var(--ease-out-3)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-title font-medium">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-label text-ink-3">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close"><X className="size-4" /></D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel, onConfirm, destructive }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; body: string; confirmLabel: string; onConfirm: () => void; destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={body}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild><Button>Cancel</Button></DialogClose>
          <Button variant={destructive ? "danger" : "primary"} onClick={() => { onConfirm(); onOpenChange(false); }}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
