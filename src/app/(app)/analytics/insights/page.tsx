import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Cpu, Sparkles } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadInsights } from "@/features/analytics/insights";
import { ModulePageHeader } from "@/components/shell/module-header";
import { DataList } from "@/components/dashboard/lists";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { DemoBanner } from "@/components/ai/demo-output";
import { InsightGrid } from "@/components/ai/insight-grid";
import { Assistant } from "@/components/ai/assistant";

export const metadata: Metadata = { title: "AI insights & assistant" };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("analytics.read");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const d = await loadInsights(repo);

  return (
    <>
      <ModulePageHeader role={session.role} module="analytics" active="insights" title="AI insights & assistant"
        description="Ten AI capabilities and what each will return. Until a model is connected, every panel is a deterministic demo with links to the records it used."
        aside={<StatusBadge tone="neutral" dot>AI provider: not connected</StatusBadge>} />

      <DemoBanner className="mb-4">
        Each capability below runs the typed contract it will use in Phase 3 against a demo provider: fixed rules over demo data, with a confidence score, an explanation and citations. No data is sent anywhere.
      </DemoBanner>

      <section aria-labelledby="caps-h">
        <h2 id="caps-h" className="sr-only">AI capabilities</h2>
        <InsightGrid capabilities={d.capabilities} />
      </section>

      <div className="stagger mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-labelledby="assistant-h">
          <CardHeader id="assistant-h" icon={Bot} title="Operational Assistant" subtitle="Suggested questions, answered from demo fixtures" action={<StatusBadge tone="amber">Demo</StatusBadge>} />
          <Assistant answers={d.answers} />
        </Card>
        <Card aria-labelledby="jobs-h">
          <CardHeader id="jobs-h" icon={Cpu} title="AI jobs" subtitle="Queued → processing → needs review → completed"
            action={can(session.role, "admin.config") ? <Link href="/governance/integrations" className={buttonClass("ghost", "sm")}>Job health ›</Link> : undefined} />
          <DataList rows={d.jobs.map((j) => ({ ...j, icon: Sparkles }))} empty="No AI jobs in your scope" label="AI jobs" />
          <p className="mt-3 text-[12px] text-ink-3">Seeded job records. Nothing is processed in Phase 1; drafts from audio or video intake still wait for a person to confirm.</p>
        </Card>
      </div>
    </>
  );
}
