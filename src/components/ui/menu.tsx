"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuRadioGroup = M.RadioGroup;

export function MenuContent({ className, align = "end", children, ...props }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={10}
        collisionPadding={12}
        className={cn("animate-pop z-50 min-w-56 rounded-[18px] border border-line bg-surface p-1.5 text-ink shadow-pop", className)}
        {...props}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

const itemClass =
  "relative flex cursor-default items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-body outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3";

export function MenuItem({ className, ...props }: M.DropdownMenuItemProps) {
  return <M.Item className={cn(itemClass, className)} {...props} />;
}

export function MenuRadioItem({ className, children, ...props }: M.DropdownMenuRadioItemProps) {
  return (
    <M.RadioItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <M.ItemIndicator className="absolute right-2.5"><Check className="!text-ink" /></M.ItemIndicator>
    </M.RadioItem>
  );
}

export function MenuLabel({ className, ...props }: M.DropdownMenuLabelProps) {
  return <M.Label className={cn("px-2.5 pt-2 pb-1 text-eyebrow font-medium tracking-[0.1em] text-ink-3 uppercase", className)} {...props} />;
}

export const MenuSeparator = () => <M.Separator className="my-1.5 h-px bg-line" />;
