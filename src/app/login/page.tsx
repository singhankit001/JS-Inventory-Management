import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { allCentres, listDemoUsers } from "@/lib/data/provider";
import { getSession } from "@/lib/auth/session";
import { DASHBOARD_PATH, ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { signIn } from "@/app/actions/session";
import { RoleTile } from "./role-tile";

export const metadata: Metadata = { title: "Sign in" };

const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 18 L9 6 L12 13 L15 9 L20 18" /><circle cx="15" cy="5" r="1.6" fill="currentColor" stroke="none" /></svg>
);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const session = await getSession();
  if (session) redirect(DASHBOARD_PATH[session.role]);
  const { next, error } = await searchParams;
  const users = listDemoUsers();
  const centres = allCentres();
  const centreName = new Map(centres.map((c) => [c.id, c.name]));
  const cities = [...new Set(centres.map((c) => c.city))].map((city) => ({ city, names: centres.filter((c) => c.city === city).map((c) => c.name) }));

  return (
    <main className="grid min-h-dvh gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <section aria-label="Jumpstart Inventory OS" className="login-brand relative isolate flex flex-col justify-between overflow-hidden rounded-[28px] bg-primary-card p-6 text-primary-card-ink sm:p-8 lg:min-h-[calc(100dvh-2rem)] lg:p-12">
        <svg className="pointer-events-none absolute -right-40 -bottom-48 -z-10 size-[640px] opacity-[0.09]" viewBox="0 0 200 200" aria-hidden>
          {[96, 80, 64, 48, 32].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="0.35" />)}
        </svg>
        <div className="animate-enter flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[13px] bg-primary-card-ink text-primary-card"><Mark className="size-[22px]" /></span>
          <span className="leading-tight">
            <span className="block text-[15px] font-medium tracking-[-0.01em]">Jumpstart</span>
            <span className="block text-[11.5px] text-primary-card-ink-2">International Preschool</span>
          </span>
        </div>

        <div className="animate-enter mt-12 [animation-delay:80ms] lg:mt-0">
          <p className="text-eyebrow font-medium tracking-[0.16em] text-primary-card-ink-2 uppercase">Smart Inventory OS</p>
          <h1 className="mt-4 max-w-[13ch] text-[2.6rem] leading-[1.02] font-light tracking-[-0.035em] text-balance sm:text-[3.4rem] xl:text-[4rem]">
            Every centre, stocked with care.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-primary-card-ink-2 text-pretty">
            Counts, monthly requests, approvals, purchasing, receiving and finance for the Jumpstart network, in one place.
          </p>
        </div>

        <div className="animate-enter mt-10 hidden [animation-delay:160ms] sm:block">
          <dl className="grid gap-5 border-t border-primary-card-ink/10 pt-6 sm:grid-cols-[auto_1fr]">
            {cities.map(({ city, names }) => (
              <div key={city} className="contents">
                <dt className="flex items-baseline gap-2 text-label">
                  <span className="text-metric font-light tabular">{names.length}</span>
                  <span className="text-primary-card-ink-2">{city}</span>
                </dt>
                <dd className="self-center text-[12.5px] leading-relaxed text-primary-card-ink-2">{names.join(" · ")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-[11.5px] text-primary-card-ink-2/80">Centre names from jumpstartpreschool.in. All stock, request and financial figures are simulated.</p>
        </div>
      </section>

      {/* Sign-in panel */}
      <section aria-labelledby="pick" className="flex items-center justify-center px-2 py-8 sm:px-6 lg:py-12">
        <div className="w-full max-w-[460px]">
          <div className="animate-enter">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11.5px] font-medium text-amber">
              <FlaskConical className="size-3.5" />Demo environment
            </p>
            <h2 id="pick" className="mt-5 text-[1.75rem] leading-tight font-light tracking-[-0.025em]">Choose a workspace</h2>
            <p className="mt-2 text-body text-ink-2 text-pretty">Each demo account opens the dashboard and permissions of one role. No password needed.</p>
          </div>

          {error && <p role="alert" className="mt-5 rounded-[14px] bg-red-soft px-3.5 py-2.5 text-label text-red">That account can&apos;t sign in. Pick another.</p>}

          <ul className="stagger mt-7 grid grid-cols-1 gap-2.5 xs:grid-cols-2" style={{ "--stagger-base": "120ms" } as React.CSSProperties}>
            {users.map((u) => {
              const def = ROLE_DEFINITIONS[u.roles[0]!];
              const label = u.roles.map((r) => ROLE_DEFINITIONS[r].label).join(" + ");
              const scope = def.scope === "organisation" || u.centreIds.length === 0 ? "All centres" : u.centreIds.map((id) => centreName.get(id) ?? id).join(", ");
              return (
                <li key={u.id}>
                  <form action={signIn} className="h-full">
                    <input type="hidden" name="userId" value={u.id} />
                    {next && <input type="hidden" name="next" value={next} />}
                    <RoleTile role={u.roles[0]!} label={label} person={u.name} scope={scope} />
                  </form>
                </li>
              );
            })}
          </ul>

          <p className="mt-7 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-3">
            Demo sign-in only. Data resets daily and nothing you change leaves this environment.
          </p>
        </div>
      </section>
    </main>
  );
}
