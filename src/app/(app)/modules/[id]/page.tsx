import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { ArrowUpRight, CornerDownRight, Database, KeyRound, PenLine } from "lucide-react";
import { requireSession, scopedRepository } from "@/lib/auth/session";
import { findModule, visiblePages } from "@/lib/modules";
import { count } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ centre?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: findModule((await params).id)?.label ?? "Module not found" };
}

const humanise = (key: string) => key.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`);
const chip = "inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-ink-2 ring-1 ring-line";

export default async function ModulePage({ params, searchParams }: Params) {
  const group = findModule((await params).id);
  if (!group) notFound();
  const session = await requireSession();
  const pages = visiblePages(session.role, group);
  if (pages.length === 0) forbidden();
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);

  // One scoped read per distinct collection; counts respect the caller's centre scope.
  const keys = [...new Set(pages.flatMap((p) => p.reads))];
  const rows = new Map(await Promise.all(keys.map(async (k) => [k, (k === "notifications" ? await repo.notifications(session.user.id) : await repo[k]()).length] as const)));
  const live = pages.filter((p) => p.status === "implemented").length;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jumpstart", href: "/" }, { label: centre?.name ?? "All centres" }, { label: group.short }]}
        title={group.label}
        aside={<StatusBadge tone="green" dot>{live} live · {pages.length - live} planned</StatusBadge>}
      />
      <p className="animate-enter -mt-3 mb-6 max-w-2xl text-body text-ink-2">{group.description} Planned pages show the data contract they will be built against; counts are live from your scope.</p>

      <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pages.map((p) => {
          // Detail routes (`nav: false`, href with `[id]`) are opened from a record on their parent list, never directly.
          const detail = p.nav === false;
          const parent = detail ? group.pages.find((x) => x.href === p.href?.replace(/\/\[id\]$/, "")) : undefined;
          const implemented = p.status === "implemented" && p.href && !detail;
          return (
            <Card key={p.slug} as="article" id={p.slug} aria-labelledby={`${p.slug}-h`} className="flex scroll-mt-28 flex-col target:ring-2 target:ring-focus">
              <header className="mb-3 flex items-start justify-between gap-3">
                <h2 id={`${p.slug}-h`} className="text-title font-normal tracking-[-0.01em]">
                  {implemented ? <Link href={p.href!} className="underline-offset-4 hover:underline">{p.title}</Link> : p.title}
                </h2>
                {p.status !== "implemented" ? <StatusBadge>Phase {p.phase}</StatusBadge> : <StatusBadge tone="green" dot>{detail ? "Detail" : "Live"}</StatusBadge>}
              </header>
              <p className="text-body text-ink-2">{p.summary}</p>

              <dl className="mt-4 grid gap-2.5 text-label">
                <div className="flex flex-wrap items-center gap-1.5">
                  <dt className="flex items-center gap-1 text-ink-3"><KeyRound className="size-3.5" aria-hidden />Permission</dt>
                  <dd><code className={chip}>{p.permission}</code></dd>
                </div>
                {p.reads.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <dt className="flex items-center gap-1 text-ink-3"><Database className="size-3.5" aria-hidden />Reads</dt>
                    {p.reads.map((r) => <dd key={r} className={chip}>{humanise(r)}<span className="font-medium text-ink tabular">{count(rows.get(r) ?? 0)}</span></dd>)}
                  </div>
                )}
                {p.writes && p.writes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <dt className="flex items-center gap-1 text-ink-3"><PenLine className="size-3.5" aria-hidden />Writes</dt>
                    {p.writes.map((w) => <dd key={w}><code className={chip}>{w}</code></dd>)}
                  </div>
                )}
              </dl>

              {detail && p.status === "implemented" && (
                <p className="mt-auto flex items-center gap-1.5 pt-5 text-label text-ink-3">
                  <CornerDownRight className="size-3.5" aria-hidden />Opened from {parent?.href ? <Link href={parent.href} className="font-medium text-ink underline-offset-4 hover:underline">{parent.title}</Link> : "its list"}
                </p>
              )}
              {implemented && <div className="mt-auto pt-5"><Link href={p.href!} className={buttonClass("primary", "sm")} aria-label={`Open ${p.title}`}>Open<ArrowUpRight /></Link></div>}
            </Card>
          );
        })}
      </div>
    </>
  );
}
