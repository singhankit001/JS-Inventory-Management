import { Inbox, Lock, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon: Icon = Inbox, title, body, action, className }: { icon?: LucideIcon; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-tile border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-3"><Icon className="size-5" strokeWidth={1.5} /></span>
      <p className="text-body font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-label text-ink-3">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", body, action }: { title?: string; body?: string; action?: React.ReactNode }) {
  return <EmptyState icon={TriangleAlert} title={title} body={body} action={action} className="border-red/30" />;
}

export function PermissionDenied({ body = "Your current workspace does not include this page. Switch workspace from the profile menu if you hold another role." }: { body?: string }) {
  return <EmptyState icon={Lock} title="You don't have access to this page" body={body} />;
}
