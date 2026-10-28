import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import type { Role } from "@/domain/types";
import { allCentres, listDemoUsers } from "@/lib/data/provider";
import { getSession } from "@/lib/auth/session";
import { DASHBOARD_PATH, ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { RolePicker, type AccountGroup } from "./role-picker";

export const metadata: Metadata = { title: "Sign in" };

const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 18 L9 6 L12 13 L15 9 L20 18" /><circle cx="15" cy="5" r="1.6" fill="currentColor" stroke="none" /></svg>
);

const GROUPS: { label: string; roles: Role[] }[] = [
  { label: "Leadership", roles: ["ceo", "head_office"] },
  { label: "Centres", roles: ["centre_leader", "receiving"] },
  { label: "Back office", roles: ["purchasing", "finance", "admin"] },
];

/** Head Office at the centre, every published centre on an arc around it; Bengaluru sits apart from the Pune cluster. */
function NetworkMap({ centres }: { centres: { id: string; name: string; city: string }[] }) {
  const pune = centres.filter((c) => c.city === "Pune");
  const other = centres.filter((c) => c.city !== "Pune");
  const cx = 250, cy = 250, r = 168;
  const place = (i: number, n: number, from: number, to: number) => {
    const a = ((from + (to - from) * (n === 1 ? 0.5 : i / (n - 1))) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), a };
  };
  const nodes = [
    ...pune.map((c, i) => ({ ...c, ...place(i, pune.length, 150, 390), far: false })),
    ...other.map((c, i) => ({ ...c, ...place(i, other.length, 60, 90), far: true })),
  ];
  return (
    <svg viewBox="-120 -10 740 520" className="h-auto w-full max-w-[620px]" role="img" aria-label={`Network of ${centres.length} Jumpstart centres connected to Head Office`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2 6" />
      <circle cx={cx} cy={cy} r={r * 0.55} fill="none" stroke="currentColor" strokeOpacity="0.07" />
      {nodes.map((n, i) => (
        <path key={`l-${n.id}`} d={`M${cx} ${cy} L${n.x.toFixed(1)} ${n.y.toFixed(1)}`} pathLength={1} className="net-line" data-far={n.far || undefined} stroke="currentColor" strokeOpacity={n.far ? 0.35 : 0.22} strokeDasharray={n.far ? "0.02 0.02" : undefined} style={{ animationDelay: `${300 + i * 55}ms` }} />
      ))}
      {nodes.map((n, i) => {
        const right = Math.cos(n.a) >= 0;
        const lx = cx + (r + 14) * Math.cos(n.a), ly = cy + (r + 14) * Math.sin(n.a);
        return (
          <g key={n.id} className="net-node" style={{ animationDelay: `${520 + i * 55}ms` }}>
            <circle cx={n.x} cy={n.y} r="4.5" fill="currentColor" />
            <circle cx={n.x} cy={n.y} r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" />
            <text x={lx} y={ly} dy="0.35em" textAnchor={right ? "start" : "end"} fontSize="12.5" fill="currentColor" fillOpacity="0.72" letterSpacing="0.01em">
              {n.name}{n.far ? ` · ${n.city}` : ""}
            </text>
          </g>
        );
      })}
      <g className="net-node" style={{ animationDelay: "200ms" }}>
        <circle cx={cx} cy={cy} r="30" fill="currentColor" fillOpacity="0.08" />
        <circle cx={cx} cy={cy} r="17" fill="currentColor" />
        <text x={cx} y={cy + 50} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.55" letterSpacing="0.14em">HEAD OFFICE</text>
      </g>
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const session = await getSession();
  if (session) redirect(DASHBOARD_PATH[session.role]);
  const { next, error } = await searchParams;
  const users = listDemoUsers();
  const centres = allCentres();
  const centreName = new Map(centres.map((c) => [c.id, c.name]));
  const cities = [...new Set(centres.map((c) => c.city))];

  const groups: AccountGroup[] = GROUPS.map((g) => ({
    label: g.label,
    accounts: users.filter((u) => g.roles.includes(u.roles[0]!)).map((u) => ({
      id: u.id, role: u.roles[0]!, person: u.name,
      label: u.roles.map((r) => ROLE_DEFINITIONS[r].label).join(" + "),
      scope: ROLE_DEFINITIONS[u.roles[0]!].scope === "organisation" || u.centreIds.length === 0 ? "All centres" : u.centreIds.map((id) => centreName.get(id) ?? id).join(", "),
    })),
  })).filter((g) => g.accounts.length > 0);

  return (
    <main className="grid min-h-dvh gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <section aria-label="Jumpstart Inventory OS" className="relative isolate flex flex-col overflow-hidden rounded-[30px] bg-primary-card p-6 text-primary-card-ink sm:p-9 lg:min-h-[calc(100dvh-2rem)] lg:p-12">
        <div aria-hidden className="login-glow pointer-events-none absolute -top-1/3 left-1/4 -z-10 size-[70%] rounded-full" />
        <div className="login-rise flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[13px] bg-primary-card-ink text-primary-card"><Mark className="size-[22px]" /></span>
            <span className="leading-tight">
              <span className="block text-[15px] font-medium tracking-[-0.01em]">Jumpstart</span>
              <span className="block text-[11.5px] text-primary-card-ink-2">International Preschool</span>
            </span>
          </div>
          <span className="hidden rounded-full px-3 py-1 text-[11px] tracking-[0.12em] text-primary-card-ink-2 uppercase ring-1 ring-primary-card-ink/15 sm:inline">Inventory OS</span>
        </div>

        <div className="relative my-6 hidden flex-1 items-center justify-center sm:flex">
          <NetworkMap centres={centres} />
        </div>

        <div className="login-rise mt-10 sm:mt-0" style={{ animationDelay: "120ms" }}>
          <h1 className="max-w-[16ch] text-[2.4rem] leading-[1.02] font-light tracking-[-0.04em] text-balance sm:text-[3.25rem] xl:text-[3.75rem]">
            One quiet system behind every classroom.
          </h1>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-t border-primary-card-ink/10 pt-5">
            <p className="max-w-sm text-[14px] leading-relaxed text-primary-card-ink-2 text-pretty">
              Counts, monthly requests, approvals, purchasing, receiving and finance for {centres.length} centres across {cities.join(" and ")}.
            </p>
            <p className="text-[11px] text-primary-card-ink-2/80">Centre names from jumpstartpreschool.in · figures simulated</p>
          </div>
        </div>
      </section>

      {/* Sign-in panel */}
      <section aria-labelledby="signin-h" className="flex items-center justify-center px-2 py-10 sm:px-8 lg:py-12">
        <div className="w-full max-w-[420px]">
          <div className="login-rise" style={{ animationDelay: "80ms" }}>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11.5px] font-medium text-amber">
              <FlaskConical className="size-3.5" />Demo environment
            </p>
            <h2 id="signin-h" className="mt-6 text-[2rem] leading-[1.1] font-light tracking-[-0.03em]">Sign in</h2>
            <p className="mt-2 text-body text-ink-2 text-pretty">Choose a demo account. Each one opens the workspace and permissions of its role.</p>
          </div>

          {error && <p role="alert" className="mt-5 rounded-[14px] bg-red-soft px-3.5 py-2.5 text-label text-red">That account can&apos;t sign in. Pick another.</p>}

          <div className="mt-8">
            <RolePicker groups={groups} next={next} />
          </div>

          <p className="login-rise mt-6 text-center text-[12px] leading-relaxed text-ink-3" style={{ animationDelay: "420ms" }}>
            No password in demo mode · data resets daily
          </p>
        </div>
      </section>
    </main>
  );
}
