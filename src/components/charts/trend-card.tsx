import type { LucideIcon } from "lucide-react";
import { IconBubble } from "@/components/ui/card";
import { TrendCardClient, type TrendView } from "./trend-card-client";

export type { TrendView };

/** Card with a segmented control switching between chart views (reference: "Revenue & cost | Bikes built").
 *  Server-safe wrapper so pages can pass a Lucide icon like every other card. */
export function TrendCard({ icon, ...rest }: { icon: LucideIcon; title: string; subtitle?: string; views: TrendView[]; className?: string }) {
  return <TrendCardClient leading={<IconBubble icon={icon} />} {...rest} />;
}
