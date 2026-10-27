import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, FlaskConical } from "lucide-react";
import { listDemoUsers } from "@/lib/data/provider";
import { getSession } from "@/lib/auth/session";
import { DASHBOARD_PATH, ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { signIn } from "@/app/actions/session";
import { initials } from "@/lib/format";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const session = await getSession();
  if (session) redirect(DASHBOARD_PATH[session.role]);
  const { next, error } = await searchParams;
  const users = listDemoUsers();
  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-4 py-12 lg:grid-cols-[1fr_1.1fr]">
      <section className="animate-enter">
        <span className="grid size-12 place-items-center rounded-[14px] bg-pill text-pill-ink shadow-float">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 18 L9 6 L12 13 L15 9 L20 18" /><circle cx="15" cy="5" r="1.6" fill="currentColor" stroke="none" /></svg>
        </span>
        <h1 className="mt-6 text-[2.5rem] leading-[1.1] font-light tracking-[-0.03em]">Jumpstart<br />Inventory OS</h1>
        <p className="mt-4 max-w-sm text-body text-ink-2">Stock, requests, purchasing, receiving and finance for every Jumpstart International Preschool centre.</p>
        <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1.5 text-[12px] font-medium text-amber"><FlaskConical className="size-3.5" />Demo mode — choose a seeded account. No real data.</p>
      </section>
      <section className="card stagger animate-enter p-3" aria-labelledby="pick">
        <h2 id="pick" className="px-3 pt-3 pb-2 text-title">Sign in as</h2>
        {error && <p role="alert" className="mx-3 mb-2 rounded-[12px] bg-red-soft px-3 py-2 text-label text-red">That account can&apos;t sign in. Pick another.</p>}
        {users.map((u) => (
          <form key={u.id} action={signIn}>
            <input type="hidden" name="userId" value={u.id} />
            {next && <input type="hidden" name="next" value={next} />}
            <button className="group flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition-colors hover:bg-surface-2">
              <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2 ring-1 ring-line">{initials(u.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium">{u.name}</span>
                <span className="block truncate text-label text-ink-3">{u.roles.map((r) => ROLE_DEFINITIONS[r].label).join(" + ")}</span>
              </span>
              <ArrowRight className="size-4 text-ink-3 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink" />
            </button>
          </form>
        ))}
      </section>
    </main>
  );
}
