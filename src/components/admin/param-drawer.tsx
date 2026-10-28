"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DrawerContent } from "@/components/ui/dialog";

/**
 * A drawer whose open state is a search param (`?job=<id>`), so rows can link to it and the URL can be shared.
 * The server renders it only when the record exists; closing drops the param.
 */
export function ParamDrawer({ param, title, description, children }: { param: string; title: string; description?: string; children: React.ReactNode }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const close = () => {
    const p = new URLSearchParams(params);
    p.delete(param);
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };
  return (
    <Dialog open={params.has(param)} onOpenChange={(o) => !o && close()}>
      <DrawerContent title={title} description={description}>{children}</DrawerContent>
    </Dialog>
  );
}
