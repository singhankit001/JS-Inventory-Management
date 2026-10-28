import type { Metadata } from "next";
import { Bell, Code2, Database, Info, PackageX } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { DEFAULT_CONFIG, getConfig } from "@/features/admin/config-store";
import { money, relative } from "@/lib/format";
import { ModulePageHeader } from "@/components/shell/module-header";
import { ConfigForm } from "@/components/admin/config-form";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "System configuration" };

const editable = (c: typeof DEFAULT_CONFIG) => ({ opensOnDay: c.requestWindow.opensOnDay, closesOnDay: c.requestWindow.closesOnDay, criticalApprovalThreshold: c.criticalApprovalThreshold });

/** Where each setting is actually decided today. None of them read this page's store yet. */
const ENFORCED = [
  { setting: "Request deadline · 25th", where: "features/dashboards/centre.ts", effect: "Centre leader countdown and overdue flag" },
  { setting: "Request window opens", where: "Not enforced", effect: "Drafts can be started on any day" },
  { setting: `Critical approval · above ${money(DEFAULT_CONFIG.criticalApprovalThreshold)}`, where: "app/actions/procurement.ts, seed", effect: "Marks PO approvals critical; emergency requests always are" },
  { setting: `PO authorisation · above ${money(DEFAULT_CONFIG.poAuthorisationThreshold)}`, where: "Seed simulation only", effect: "New POs raised in the app always go to authorisation" },
  { setting: "Critical stock · ½ reorder point", where: "features/dashboards/shared.ts", effect: "Every stock health badge, alert and heatmap" },
];
const NOTIFICATIONS = [
  { rule: "Emergency request raised", to: "Everyone", severity: "Critical" },
  { rule: "PO awaiting final authorisation", to: "Everyone", severity: "Info" },
  { rule: "Closing stock count due (last working day)", to: "Everyone", severity: "Warning" },
];

export default async function ConfigurationPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const session = await requirePermission("admin.config");
  const { repo } = scopedRepository(session, (await searchParams).centre);
  const { config, updatedAt, updatedBy } = getConfig();
  const editor = updatedBy ? (await repo.users()).find((u) => u.id === updatedBy)?.name ?? "An administrator" : undefined;

  return (
    <>
      <ModulePageHeader role={session.role} module="admin" active="configuration" title="System configuration"
        description="Request windows, approval and stock thresholds, notifications and the data source."
        aside={<StatusBadge tone={updatedAt ? "blue" : "neutral"} dot>{updatedAt ? `Changed ${relative(updatedAt, repo.today())} by ${editor}` : "Defaults · not changed today"}</StatusBadge>} />

      <div role="note" className="animate-enter mb-4 flex gap-3 rounded-card bg-secondary-card p-4 text-body text-secondary-card-ink sm:p-5">
        <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p><b className="font-medium">Applies to new records.</b> Saving stores these values in demo memory (resets daily) and records an audit event. The modules still use the values written in code — listed under “Where these live today” — until Phase 2 wires them to this configuration.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <ConfigForm saved={editable(config)} defaults={editable(DEFAULT_CONFIG)} />

          <Card aria-labelledby="cfg-stock">
            <CardHeader id="cfg-stock" icon={PackageX} title="Stock thresholds" subtitle="Read-only — not in the updateConfig command yet" />
            <div className="grid gap-2 sm:grid-cols-3">
              <StatTile label="Critical" value={`≤ ${config.stockCriticalRatio === 0.5 ? "½" : config.stockCriticalRatio} reorder point`} />
              <StatTile label="Low" value="≤ reorder point" />
              <StatTile label="Healthy" value="above reorder point" />
            </div>
            <p className="mt-3 text-label text-ink-3">Example: a product with a reorder point of 40 turns critical at 20 units and low at 40.</p>
          </Card>

          <Card aria-labelledby="cfg-notify">
            <CardHeader id="cfg-notify" icon={Bell} title="Notification rules" subtitle="In-app only · email delivery is not configured" action={<StatusBadge>Read-only</StatusBadge>} />
            <ul className="grid gap-1" aria-label="Notification rules">
              {NOTIFICATIONS.map((n) => (
                <li key={n.rule} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 py-2.5 last:border-0">
                  <span className="text-body text-ink">{n.rule}</span>
                  <span className="text-label text-ink-3">{n.to} · {n.severity}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card aria-labelledby="cfg-data">
            <CardHeader id="cfg-data" icon={Database} title="Data mode" subtitle="Set by the deployment, not from this page" />
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={repo.mode === "seed" ? "amber" : "green"} dot>{repo.mode === "seed" ? "Seed · demo data" : "Live"}</StatusBadge>
              <span className="text-label text-ink-3">{repo.mode === "seed" ? "Fictional data rebuilt every day; writes reset with it." : "Connected to the production database."}</span>
            </div>
          </Card>

          <Card aria-labelledby="cfg-enforced">
            <CardHeader id="cfg-enforced" icon={Code2} title="Where these live today" subtitle="Hard-coded values the app actually enforces" />
            <ul className="grid gap-1">
              {ENFORCED.map((e) => (
                <li key={e.setting} className="border-b border-line/60 py-2.5 last:border-0">
                  <p className="text-body font-medium text-ink">{e.setting}</p>
                  <p className="text-label text-ink-3">{e.effect}</p>
                  <p className="mt-0.5"><code className="text-[12px] text-ink-2">{e.where}</code></p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
