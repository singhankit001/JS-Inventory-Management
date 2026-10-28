import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import type { Role } from "@/domain/types";
import { allCentres, listDemoUsers } from "@/lib/data/provider";
import { getSession } from "@/lib/auth/session";
import { DASHBOARD_PATH, ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { RolePicker, type AccountGroup, type GroupTone } from "./role-picker";
import { OpsScene } from "./ops-scene";
import { SceneStage } from "./scene-stage";

export const metadata: Metadata = { title: "Sign in" };

const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 18 L9 6 L12 13 L15 9 L20 18" /><circle cx="15" cy="5" r="1.6" fill="currentColor" stroke="none" /></svg>
);

const GROUPS: { label: string; tone: GroupTone; roles: Role[] }[] = [
  { label: "Leadership", tone: "blue", roles: ["ceo", "head_office"] },
  { label: "Centres", tone: "orange", roles: ["centre_leader", "receiving"] },
  { label: "Back office", tone: "green", roles: ["purchasing", "finance", "admin"] },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const session = await getSession();
  if (session) redirect(DASHBOARD_PATH[session.role]);
  const { next, error } = await searchParams;
  const users = listDemoUsers();
  const centres = allCentres();
  const centreName = new Map(centres.map((c) => [c.id, c.name]));
  const cities = [...new Set(centres.map((c) => c.city))];

  const groups: AccountGroup[] = GROUPS.map((g) => ({
    label: g.label, tone: g.tone,
    accounts: users.filter((u) => g.roles.includes(u.roles[0]!)).map((u) => ({
      id: u.id, role: u.roles[0]!, person: u.name,
      label: ROLE_DEFINITIONS[u.roles[0]!].label,
      also: u.roles.slice(1).map((r) => ROLE_DEFINITIONS[r].label),
      scope: ROLE_DEFINITIONS[u.roles[0]!].scope === "organisation" || u.centreIds.length === 0 ? "All centres" : u.centreIds.map((id) => centreName.get(id) ?? id).join(", "),
    })),
  })).filter((g) => g.accounts.length > 0);

  return (
    <main className="login-shell grid min-h-dvh gap-3 p-3 lg:h-dvh lg:min-h-[640px] lg:grid-cols-[minmax(0,1.15fr)_minmax(400px,1fr)]">
      {/* Hero: brand, promise and the isometric operations landscape */}
      <section aria-label="Jumpstart Inventory OS" className="login-hero relative isolate flex min-h-0 flex-col overflow-hidden rounded-[32px] p-6 text-secondary-card-ink sm:p-8 xl:p-10">
        <div className="login-rise flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[13px] bg-surface text-blue shadow-float"><Mark className="size-[22px]" /></span>
            <span className="leading-tight">
              <span className="block text-[15px] font-medium tracking-[-0.01em]">Jumpstart</span>
              <span className="block text-[11.5px] text-secondary-card-ink-2">International Preschool</span>
            </span>
          </div>
          <span className="hidden rounded-full bg-surface/55 px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-secondary-card-ink-2 uppercase ring-1 ring-surface/60 backdrop-blur-sm sm:inline">Inventory OS</span>
        </div>

        <div className="login-rise mt-7 max-w-xl xl:mt-9" style={{ animationDelay: "90ms" }}>
          <h1 className="text-[clamp(2rem,1.2rem+2.4vw,3.35rem)] leading-[1.02] font-light tracking-[-0.04em] text-balance">
            Every request, from <span className="text-blue">classroom</span> to <span className="text-violet">boardroom</span>.
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-secondary-card-ink-2 text-pretty">
            Stock counts, monthly requests, approvals, purchasing, deliveries and finance for {centres.length} centres across {cities.join(" and ")}, in one connected flow.
          </p>
        </div>

        <SceneStage className="ops-stage relative -mx-4 mt-2 min-h-[260px] flex-1 sm:-mx-2 lg:min-h-0">
          <OpsScene />
        </SceneStage>

        <p className="login-rise mt-1 text-[11px] text-secondary-card-ink-2" style={{ animationDelay: "1200ms" }}>
          Centre names from jumpstartpreschool.in · all operational figures are simulated
        </p>
      </section>

      {/* Sign-in workspace */}
      <section aria-labelledby="signin-h" className="login-panel relative flex min-h-0 items-center justify-center overflow-y-auto rounded-[32px] px-3 py-10 sm:px-8 lg:py-6">
        <div className="w-full max-w-[468px]">
          <div className="login-rise" style={{ animationDelay: "60ms" }}>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11.5px] font-medium text-amber ring-1 ring-amber/20">
              <FlaskConical className="size-3.5" />Demo environment
            </p>
            <h2 id="signin-h" className="mt-5 text-[clamp(1.6rem,1.2rem+1vw,2.1rem)] leading-[1.1] font-light tracking-[-0.03em]">Sign in to your workspace</h2>
            <p className="mt-2 text-body text-ink-2 text-pretty">Choose a demo account. Each opens the dashboard and permissions of its role.</p>
          </div>

          {error && <p role="alert" className="mt-5 rounded-[14px] bg-red-soft px-3.5 py-2.5 text-label text-red">That account can&apos;t sign in. Pick another.</p>}

          <div className="mt-6">
            <RolePicker groups={groups} next={next} />
          </div>

          <p className="login-rise mt-4 text-center text-[11.5px] text-ink-3" style={{ animationDelay: "480ms" }}>
            No password in demo mode · use arrow keys and Enter · data resets daily
          </p>
        </div>
      </section>
    </main>
  );
}
