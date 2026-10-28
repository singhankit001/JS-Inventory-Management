import type { Metadata } from "next";
import { AudioLines, ShieldCheck, Sparkles } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { loadIntake } from "@/features/ai/intake";
import { ModulePageHeader } from "@/components/shell/module-header";
import { DataList } from "@/components/dashboard/lists";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { IntakeFlow } from "@/components/ai/intake-flow";

export const metadata: Metadata = { title: "Audio & video intake" };

export default async function IntakePage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("requests.create");
  const { repo, centre } = scopedRepository(session, (await searchParams).centre);
  const d = await loadIntake(repo, centre ? [centre] : session.centres);

  return (
    <>
      <ModulePageHeader role={session.role} module="requests" active="intake" title="Audio & video intake"
        description="Say what your centre needs; a draft request is prepared for you to check, edit and save."
        aside={<StatusBadge tone="neutral" dot>AI transcription: not connected</StatusBadge>} />

      <div className="stagger grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <Card aria-labelledby="intake-h">
          <CardHeader id="intake-h" icon={AudioLines} title="New recording" subtitle={`Drafts the ${d.targetPeriod} request · you confirm every line`} />
          {d.drafts.length ? <IntakeFlow drafts={d.drafts} products={d.products} transcript={d.transcript} targetPeriod={d.targetPeriod} />
            : <EmptyState title="No centre assigned" body="Audio and video intake drafts a request for your centre. Ask an administrator to assign you to one." />}
        </Card>
        <div className="grid content-start gap-4">
          <Card aria-labelledby="how-h">
            <CardHeader id="how-h" icon={ShieldCheck} title="What happens to the recording" />
            <ul className="grid list-disc gap-1.5 pl-4 text-label text-ink-2">
              <li>It stays in this browser tab and is discarded when you leave.</li>
              <li>Only its type and size are sent, to open an AI job for your centre.</li>
              <li>The draft is never submitted automatically: you review it, then submit from the request page.</li>
            </ul>
          </Card>
          <Card aria-labelledby="jobs-h">
            <CardHeader id="jobs-h" icon={Sparkles} title="Recent intake jobs" />
            <DataList rows={d.jobs.map((j) => ({ ...j, icon: AudioLines }))} empty="No audio or video requests yet" label="Recent intake jobs" />
          </Card>
        </div>
      </div>
    </>
  );
}
