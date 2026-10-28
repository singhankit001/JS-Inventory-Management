import type { AIProcessingJob, Integration, Supplier } from "@/domain/types";
import { ROLES } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { hourOf, indexBy } from "./shared";
import { count, relative } from "@/lib/format";

// Admins have no finance.read: nothing here may expose budgets, prices or PO values.

const INTEGRATION: Record<Integration["status"], { label: string; tone: Tone }> = {
  not_configured: { label: "Not configured", tone: "neutral" },
  connected: { label: "Connected", tone: "green" },
  degraded: { label: "Degraded", tone: "amber" },
  down: { label: "Down", tone: "red" },
};
const JOB_KIND: Record<AIProcessingJob["kind"], string> = { audio_request: "Audio request", video_request: "Video request", invoice_ocr: "Invoice OCR", insight: "Insight" };
const JOB_STATUS: Record<AIProcessingJob["status"], { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" }, processing: { label: "Processing", tone: "blue" }, needs_review: { label: "Needs review", tone: "amber" },
  completed: { label: "Completed", tone: "slate" }, failed: { label: "Failed", tone: "red" },
};
const SUPPLIER_STATUS: Record<Supplier["status"], Tone> = { approved: "neutral", pending: "amber", blocked: "red" };

/** Whole days since `iso`, 0 for anything today. */
const daysAgo = (iso: string, today: Date) => Math.max(0, Math.ceil((today.getTime() - new Date(iso).getTime()) / 86_400_000));

export async function loadAdmin(repo: Repository) {
  const today = repo.today();
  const [users, centres, products, categories, uoms, suppliers, integrations, aiJobs, audit, balances] = await Promise.all([
    repo.users(), repo.centres(), repo.products(), repo.categories(), repo.uoms(), repo.suppliers(), repo.integrations(), repo.aiJobs(), repo.audit(), repo.balances(),
  ]);
  const cmap = indexBy(centres, "id");
  const umap = indexBy(users, "id");

  const active = users.filter((u) => u.status === "active");
  const recency = (min: number, max: number) => active.filter((u) => { const d = daysAgo(u.lastActiveAt, today); return d >= min && d <= max; }).length;
  const activeToday = recency(0, 0);
  const dormant = recency(8, Infinity);

  const activeProducts = products.filter((p) => p.status === "active");
  const openJobs = aiJobs.filter((j) => ["queued", "processing", "needs_review"].includes(j.status));
  const connected = integrations.filter((i) => i.status === "connected").length;

  const todaysEvents = [
    ...audit.filter((e) => new Date(e.occurredAt).toDateString() === today.toDateString()).map((e) => ({ id: e.id, hour: hourOf(e.occurredAt), label: `${umap.get(e.actorId)?.name ?? "Someone"} ${e.action}`, tone: "green" as Tone })),
    ...active.filter((u) => daysAgo(u.lastActiveAt, today) === 0).map((u) => ({ id: `u-${u.id}`, hour: hourOf(u.lastActiveAt), label: `${u.name} signed in`, tone: "blue" as Tone })),
  ];

  return {
    welcome: {
      users: active.length,
      centres: centres.length,
      unconfigured: integrations.filter((i) => i.status === "not_configured").length,
      review: aiJobs.filter((j) => j.status === "needs_review").length,
      events: todaysEvents,
      nowHour: new Date().getHours() + new Date().getMinutes() / 60,
    },
    kpis: {
      active: active.length,
      suspended: users.length - active.length,
      activeToday,
      todayRatio: active.length ? activeToday / active.length : 0,
      dormant,
      products: activeProducts.length,
      discontinued: products.length - activeProducts.length,
      categories: categories.length,
      openJobs: openJobs.length,
    },
    // A user can hold several roles, so these counts may exceed the head count.
    roles: ROLES.map((r) => {
      const n = active.filter((u) => u.roles.includes(r)).length;
      return { label: ROLE_DEFINITIONS[r].label, sub: ROLE_DEFINITIONS[r].scope === "organisation" ? "Organisation" : "Centre", value: n, display: count(n), tone: "blue" as Tone };
    }),
    recency: [
      { label: "Today", value: activeToday },
      { label: "Last 7 days", value: recency(1, 7) },
      { label: "8–30 days", value: recency(8, 30) },
      { label: "Over 30 days", value: recency(31, Infinity) },
    ].map((r) => ({ ...r, display: count(r.value), tone: "slate" as Tone })),
    catalogue: {
      segments: categories.map((c) => ({ label: c.name, value: activeProducts.filter((p) => p.categoryId === c.id).length, tone: c.color as Tone })).filter((s) => s.value > 0),
      active: activeProducts.length,
      discontinued: products.length - activeProducts.length,
      uoms: uoms.length,
      ratio: products.length ? activeProducts.length / products.length : 1,
    },
    integrations: integrations.map((i) => ({
      id: i.id, label: i.name, status: INTEGRATION[i.status].label, tone: INTEGRATION[i.status].tone,
      detail: i.lastCheckedAt ? `Checked ${relative(i.lastCheckedAt, today)}` : "Wired in Phase 2",
    })),
    connected,
    centres: centres.map((c) => {
      const staff = users.filter((u) => u.status === "active" && u.centreIds.includes(c.id)).length;
      return {
        id: c.id, title: c.name, sub: `${c.code} · ${c.city} · ${balances.filter((b) => b.centreId === c.id).length} SKUs stocked`,
        value: `${staff} staff`, badge: c.status === "active" ? { label: "Active", tone: "green" as Tone } : { label: "Inactive", tone: "neutral" as Tone },
      };
    }),
    suppliers: {
      counts: (["approved", "pending", "blocked"] as const).map((s) => ({ status: s, n: suppliers.filter((x) => x.status === s).length })),
      rows: [...suppliers].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "approved" ? 1 : -1)).slice(0, 5).map((s) => ({
        id: s.id, title: s.name, sub: `${s.categoryIds.length} categor${s.categoryIds.length === 1 ? "y" : "ies"} · ${s.avgLeadDays}d lead`,
        badge: { label: s.status[0]!.toUpperCase() + s.status.slice(1), tone: SUPPLIER_STATUS[s.status] },
      })),
    },
    jobs: {
      byStatus: (Object.keys(JOB_STATUS) as AIProcessingJob["status"][]).map((s) => ({ status: s, label: JOB_STATUS[s].label, n: aiJobs.filter((j) => j.status === s).length })),
      rows: [...aiJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((j) => ({
        id: j.id, title: JOB_KIND[j.kind], sub: `${j.centreId ? cmap.get(j.centreId)?.name ?? j.centreId : "Organisation"} · ${relative(j.createdAt, today)}`,
        badge: JOB_STATUS[j.status],
      })),
    },
    activity: audit.slice(0, 6).map((e) => ({ id: e.id, actor: umap.get(e.actorId)?.name ?? "Unknown", action: e.action, subject: e.subject, at: relative(e.occurredAt, today) })),
    users: users.map((u) => ({
      id: u.id, name: u.name, email: u.email,
      roles: u.roles.map((r) => ROLE_DEFINITIONS[r].label).join(", "),
      centres: u.centreIds.length ? u.centreIds.map((id) => cmap.get(id)?.code ?? id).join(", ") : "All centres",
      status: u.status === "active" ? { label: "Active", tone: "green" as Tone } : { label: "Suspended", tone: "red" as Tone },
      lastActive: u.lastActiveAt,
    })),
  };
}
