import Link from "next/link";
import { Suspense } from "react";
import { FlaskConical } from "lucide-react";
import type { Session } from "@/lib/auth/session";
import { getRepository } from "@/lib/data/provider";
import { can, DASHBOARD_PATH, ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { MODULES, visibleModules, visiblePages } from "@/lib/modules";
import { initials, relative } from "@/lib/format";
import { ToastProvider } from "@/components/feedback/toast";
import { CentreSelect, MobileNav, NotificationsMenu, ProfileMenu, Toolbar, TopNav, type CommandEntry, type NavEntry, type QuickAction } from "./shell-client";

/** Badge counts are computed server-side from the caller's scoped data — never trusted from the client. */
async function navBadges(session: Session) {
  const repo = getRepository(session.scope);
  const today = repo.today().toDateString();
  const [approvals, pos, invoices] = await Promise.all([repo.approvals(), repo.purchaseOrders(), repo.invoices()]);
  return {
    approvals: can(session.role, "requests.approve") ? approvals.filter((a) => a.status === "pending" && a.stage === "head_office").length : 0,
    procurement: can(session.role, "procurement.authorise") || can(session.role, "procurement.manage") ? pos.filter((p) => p.status === "awaiting_authorisation").length : 0,
    receiving: can(session.role, "receiving.record") ? pos.filter((p) => new Date(p.expectedAt).toDateString() === today && p.status === "issued").length : 0,
    finance: can(session.role, "finance.manage") ? invoices.filter((i) => i.status === "received" || i.status === "query").length : 0,
  } as Record<string, number>;
}

function quickActions(session: Session): QuickAction[] {
  const r = session.role;
  const out: QuickAction[] = [];
  if (can(r, "receiving.record")) out.push({ label: "Record goods receipt", href: "/dashboards/receiving#receive" });
  if (can(r, "requests.create")) out.push({ label: "New monthly request", phase: 2 }, { label: "Record audio/video request", phase: 3 });
  if (can(r, "procurement.manage")) out.push({ label: "Request quotation", phase: 2 }, { label: "Raise purchase order", phase: 2 });
  if (can(r, "finance.manage")) out.push({ label: "Record payment", phase: 2 });
  if (can(r, "admin.users")) out.push({ label: "Invite user", phase: 2 });
  return out;
}

export async function AppShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const repo = getRepository(session.scope);
  const [badges, notifications] = await Promise.all([navBadges(session), repo.notifications(session.user.id)]);
  const dash = DASHBOARD_PATH[session.role];

  const entries: NavEntry[] = [
    { key: "dashboard", label: "Dashboard", href: dash, match: [dash] },
    ...visibleModules(session.role).map((g) => ({
      key: g.id,
      label: g.short,
      href: `/modules/${g.id}`,
      badge: badges[g.id],
      match: [`/modules/${g.id}`, ...visiblePages(session.role, g).filter((p) => p.href && p.href !== dash).map((p) => p.href!)],
    })),
  ];

  const commands: CommandEntry[] = [
    { label: "My dashboard", href: dash, group: ROLE_DEFINITIONS[session.role].label },
    ...MODULES.flatMap((g) =>
      visiblePages(session.role, g).map((p) => ({ label: p.title, href: p.href ?? `/modules/${g.id}#${p.slug}`, group: g.short, planned: p.status === "planned" })),
    ),
  ];

  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-pill focus:px-4 focus:py-2 focus:text-pill-ink">Skip to content</a>
      <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col px-4 pb-28 sm:px-6 lg:pr-8 lg:pb-12 lg:pl-28">
        <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-3 px-4 pt-4 pb-3 backdrop-blur-[2px] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <Link href={dash} className="flex items-center gap-2.5 rounded-[14px] pr-2" aria-label="Jumpstart Inventory OS — home">
            <span className="grid size-10 place-items-center rounded-[12px] bg-pill text-pill-ink shadow-float">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 18 L9 6 L12 13 L15 9 L20 18" /><circle cx="15" cy="5" r="1.6" fill="currentColor" stroke="none" /></svg>
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[15px] font-medium tracking-[-0.01em]">Jumpstart</span>
              <span className="block text-[11px] text-ink-3">Inventory OS</span>
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden flex-1 justify-center lg:flex">
            <TopNav entries={entries} />
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {repo.mode === "seed" && (
              <span className="hidden items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11px] font-medium text-amber md:inline-flex" title="All figures are fictional development seed data">
                <FlaskConical className="size-3.5" />Demo data
              </span>
            )}
            {session.centres.length > 1 && (
              <span className="hidden xl:block">
                <Suspense><CentreSelect centres={session.centres.map((c) => ({ id: c.id, name: c.name }))} /></Suspense>
              </span>
            )}
            <NotificationsMenu items={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, read: n.read, severity: n.severity, href: n.href, when: relative(n.createdAt) }))} />
            <ProfileMenu
              name={session.user.name}
              email={session.user.email}
              initials={initials(session.user.name)}
              role={session.role}
              roles={session.user.roles.map((r) => ({ role: r, label: ROLE_DEFINITIONS[r].label }))}
            />
            <MobileNav entries={entries} />
          </div>
        </header>
        {repo.mode === "seed" && (
          <p className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11px] font-medium text-amber md:hidden"><FlaskConical className="size-3.5" />Demo data — figures are fictional</p>
        )}
        {session.centres.length > 1 && <div className="mb-4 xl:hidden"><Suspense><CentreSelect centres={session.centres.map((c) => ({ id: c.id, name: c.name }))} /></Suspense></div>}
        <main id="main" className="flex-1">{children}</main>
      </div>
      <Toolbar commands={commands} quickActions={quickActions(session)} />
    </ToastProvider>
  );
}
