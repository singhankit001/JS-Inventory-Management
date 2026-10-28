"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DrawerContent } from "@/components/ui/dialog";

/**
 * A drawer (or dialog) whose open state is a URL param (`?po=…`, `?new=1`), so detail panels are linkable and survive reload.
 * The server renders the content only when the param is set; closing removes the param without scrolling.
 */
export function UrlDrawer({ param, title, description, children, dialog, wide }: { param: string; title: string; description?: string; children: React.ReactNode; dialog?: boolean; wide?: boolean }) {
  const close = useCloseParam(param);
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      {dialog
        ? <DialogContent title={title} description={description} className={wide ? "top-[6vh] max-h-[88dvh] w-[min(94vw,720px)] overflow-y-auto" : "max-h-[84dvh] overflow-y-auto"}>{children}</DialogContent>
        : <DrawerContent title={title} description={description}>{children}</DrawerContent>}
    </Dialog>
  );
}

/** Removes `param` from the URL (closes its UrlDrawer); `set` optionally opens another one, e.g. the new PO's drawer. */
export function useCloseParam(param: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (set?: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    next.delete(param);
    for (const [k, v] of Object.entries(set ?? {})) next.set(k, v);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
}
