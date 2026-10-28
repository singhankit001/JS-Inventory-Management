/**
 * AI contracts: the typed request/response shape of every AI capability, and the provider seam Phase 3 implements.
 *
 * Phase 1 has NO model, NO network call and NO worker. `demoProvider` answers every capability with deterministic
 * fixtures computed from the (fictional) demo data, so the same data always gives the same output, and every output
 * carries `demo: true` plus citations to real record ids. Screens must show "Demo preview — AI not connected".
 *
 * Lifecycle: each run is an AIProcessingJob (domain/types) moving through the AI_JOB machine (domain/workflows):
 * queued → processing → completed (insights) | needs_review (anything that becomes a request or a payable) → completed
 * once a person confirms it. `outputStatus` asks the machine which of the two a capability lands in.
 */
import type { AIProcessingJob, ID, ISODate, Paise } from "@/domain/types";
import { AI_JOB, transition } from "@/domain/workflows";
import type { SeedData } from "@/lib/data/seed";
import type { Repository } from "@/lib/data/provider";
import { AGEING, ageingBucket, reconciliationExceptions, RECON_LABEL } from "@/features/finance/math";
import { fullMonth, seasonalForecast } from "@/features/analytics/forecast";
import { lastPeriods } from "@/features/dashboards/shared";
import { money, moneyCompact, monthLabel, percent } from "@/lib/format";

// ---------- Capabilities ----------

export const AI_CAPABILITIES = [
  { id: "request_intelligence", name: "Request Intelligence", summary: "Turns a spoken or filmed request into draft line items checked against history.", job: "audio_request" },
  { id: "catalogue_matching", name: "Catalogue Matching", summary: "Maps free-text item names to catalogue products.", job: "audio_request" },
  { id: "inventory_analysis", name: "Inventory Analysis", summary: "Finds SKUs that will run out before the next delivery.", job: "insight" },
  { id: "demand_forecasting", name: "Demand Forecasting", summary: "Projects consumption for the next three months.", job: "insight" },
  { id: "procurement_optimization", name: "Procurement Optimization", summary: "Spots cheaper approved quotations for what we already buy.", job: "insight" },
  { id: "budget_intelligence", name: "Budget Intelligence", summary: "Projects month-end budget use from the current run rate.", job: "insight" },
  { id: "document_intelligence", name: "Document Intelligence", summary: "Reads supplier invoices into structured, matchable records.", job: "invoice_ocr" },
  { id: "reconciliation", name: "Reconciliation", summary: "Pairs payments with invoices and flags what does not tie out.", job: "insight" },
  { id: "executive_insights", name: "Executive Insights", summary: "Writes the three things leadership should know today.", job: "insight" },
  { id: "operational_assistant", name: "Operational Assistant", summary: "Answers operational questions with links to the records.", job: "insight" },
] as const satisfies readonly { id: string; name: string; summary: string; job: AIProcessingJob["kind"] }[];

export type AICapabilityId = (typeof AI_CAPABILITIES)[number]["id"];
export type AIJobStatus = AIProcessingJob["status"];

/** A record an output is based on. `href` points at the record's page. */
export interface Citation {
  kind: "centre" | "product" | "supplier" | "invoice" | "purchase_order" | "request" | "budget" | "payment" | "ai_job";
  id: ID;
  label: string;
  href: string;
}

/** Presentation-ready line of an output, so generic UI can show any capability. */
export interface Highlight { label: string; value: string; href?: string }

export interface AIOutput<R> {
  capability: AICapabilityId;
  /** Always true in Phase 1: fixture output, not a model. */
  demo: true;
  provider: string;
  /** Where the job would land in the AI_JOB machine after processing. */
  status: Extract<AIJobStatus, "completed" | "needs_review">;
  generatedAt: ISODate;
  /** 0..1. For the demo provider this is derived from the data (match scores, forecast spread), never random. */
  confidence: number;
  summary: string;
  /** Why the output says what it says, step by step. */
  explanation: string[];
  citations: Citation[];
  highlights: Highlight[];
  result: R;
}

// ---------- Per-capability input / result ----------

export interface DraftLine { phrase: string; productId: ID | null; qty: number; score: number; historicalAvgQty: number }
export type AssistantQuestionId = "low_stock" | "overdue_invoices" | "budget_risk" | "late_deliveries";

export interface AIInput {
  request_intelligence: { centreId: ID; transcript: string };
  catalogue_matching: { phrases: string[] };
  inventory_analysis: { centreId?: ID };
  demand_forecasting: { months: 3 };
  procurement_optimization: Record<string, never>;
  budget_intelligence: Record<string, never>;
  document_intelligence: { invoiceId: ID };
  reconciliation: Record<string, never>;
  executive_insights: Record<string, never>;
  operational_assistant: { questionId: AssistantQuestionId };
}

export interface AIResult {
  request_intelligence: { lines: DraftLine[] };
  catalogue_matching: { matches: { phrase: string; productId: ID | null; score: number }[] };
  inventory_analysis: { risks: { centreId: ID; productId: ID; onHand: number; reorderPoint: number; daysCover: number }[] };
  demand_forecasting: { method: string; history: { period: string; value: Paise }[]; forecast: { period: string; value: Paise; low: Paise; high: Paise }[] };
  procurement_optimization: { suggestions: { productId: ID; currentSupplierId: ID; currentPrice: Paise; altSupplierId: ID; altPrice: Paise; annualUnits: number; saving: Paise }[] };
  budget_intelligence: { centres: { centreId: ID; allocated: Paise; used: Paise; projected: Paise; risk: "over" | "watch" | "ok" }[] };
  document_intelligence: { fields: { field: string; value: string; confidence: number }[] };
  reconciliation: { exceptions: { invoiceId: ID; kind: string; delta: Paise }[] };
  executive_insights: { headlines: string[] };
  operational_assistant: { questionId: AssistantQuestionId; question: string; answer: string };
}

/** Phase 3 implements this against a real model; callers never know which provider answered except via `provider`/`demo`. */
export interface AIProvider {
  readonly name: string;
  readonly connected: boolean;
  run<C extends AICapabilityId>(capability: C, input: AIInput[C]): Promise<AIOutput<AIResult[C]>>;
}

export const ASSISTANT_QUESTIONS: { id: AssistantQuestionId; question: string }[] = [
  { id: "low_stock", question: "What is running low right now?" },
  { id: "overdue_invoices", question: "Which supplier invoices are overdue?" },
  { id: "budget_risk", question: "Which centre is closest to its budget this month?" },
  { id: "late_deliveries", question: "Which deliveries are late?" },
];

/** Fixture transcript for the audio/video intake demo (a centre leader dictating next month's top-up). */
export const DEMO_TRANSCRIPT =
  "Hi, this is the centre leader. For next month we need 12 boxes of jumbo crayons, 6 packs of glue sticks, 40 tissue boxes, " +
  "10 litres of hand wash, 3 first aid kit refills and 24 packs of wet wipes. Also 8 packs of sparkly stickers for the festival week.";

/** Pipeline stages the intake screen animates, with the AI_JOB status each one corresponds to. */
export const INTAKE_STAGES: { key: string; label: string; status: AIJobStatus }[] = [
  { key: "upload", label: "Upload", status: "queued" },
  { key: "transcribe", label: "Transcribe", status: "processing" },
  { key: "extract", label: "Extract items", status: "processing" },
  { key: "match", label: "Match catalogue", status: "processing" },
  { key: "draft", label: "Draft for review", status: "needs_review" },
];

// ---------- Demo provider ----------

/** The slice of demo data the demo provider reads. Build it with `aiDataset(repo)` so it respects the caller's scope. */
export type AIDataset = Pick<SeedData,
  "today" | "centres" | "products" | "suppliers" | "quotations" | "balances" | "movements" | "budgets" | "invoices" | "payments" | "purchaseOrders" | "aiJobs">;

export async function aiDataset(repo: Repository): Promise<AIDataset> {
  const [centres, products, suppliers, quotations, balances, movements, budgets, invoices, payments, purchaseOrders, aiJobs] = await Promise.all([
    repo.centres(), repo.products(), repo.suppliers(), repo.quotations(), repo.balances(), repo.movements(), repo.budgets(), repo.invoices(), repo.payments(), repo.purchaseOrders(), repo.aiJobs(),
  ]);
  return { today: repo.today(), centres, products, suppliers, quotations, balances, movements, budgets, invoices, payments, purchaseOrders, aiJobs };
}

const JOB_OF = Object.fromEntries(AI_CAPABILITIES.map((c) => [c.id, c.job])) as Record<AICapabilityId, AIProcessingJob["kind"]>;

/** completed when the AI_JOB machine lets the job finish on its own; needs_review when a person must confirm it. */
export const outputStatus = (capability: AICapabilityId): AIOutput<unknown>["status"] =>
  transition(AI_JOB, "processing", "finish", { kind: JOB_OF[capability] }).ok ? "completed" : "needs_review";

const words = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter((w) => w.length > 2).map((w) => w.replace(/(es|s)$/, ""));
const UNIT_WORDS = new Set(words("box boxes pack packs litre litres piece pieces tub tubs kit kits"));

/** Token overlap between a spoken phrase and a product name (0..1); unit words are ignored. Deterministic and explainable. */
export function matchScore(phrase: string, productName: string) {
  const p = words(phrase).filter((w) => !UNIT_WORDS.has(w));
  const n = new Set(words(productName));
  return p.length ? p.filter((w) => n.has(w)).length / p.length : 0;
}

/** Splits a transcript into "<qty> <item>" phrases. */
export function extractPhrases(transcript: string): { phrase: string; qty: number }[] {
  return [...transcript.matchAll(/(\d+)\s+((?:[a-z-]+\s?){1,5}?)(?=,|\.|\band\b|\bfor\b|$)/gi)].map((m) => ({ qty: Number(m[1]), phrase: m[2]!.trim().replace(/^(?:\w+\s+of\s+)/i, "") }));
}

export function demoProvider(d: AIDataset): AIProvider {
  const href = {
    centre: (id: ID) => `/inventory/centres/${id}`, product: (sku: string) => `/inventory/catalogue?q=${encodeURIComponent(sku)}`,
    supplier: (id: ID) => `/procurement/suppliers?supplier=${id}`, invoice: (id: ID) => `/finance/invoices/${id}`, po: (id: ID) => `/procurement/orders?po=${id}`,
  };
  const pmap = new Map(d.products.map((p) => [p.id, p]));
  const cmap = new Map(d.centres.map((c) => [c.id, c]));
  const smap = new Map(d.suppliers.map((s) => [s.id, s]));
  const imap = new Map(d.invoices.map((i) => [i.id, i]));
  const cite = {
    centre: (id: ID): Citation => ({ kind: "centre", id, label: cmap.get(id)?.name ?? id, href: href.centre(id) }),
    product: (id: ID): Citation => ({ kind: "product", id, label: pmap.get(id)?.name ?? id, href: href.product(pmap.get(id)?.sku ?? id) }),
    supplier: (id: ID): Citation => ({ kind: "supplier", id, label: smap.get(id)?.name ?? id, href: href.supplier(id) }),
    invoice: (id: ID): Citation => ({ kind: "invoice", id, label: imap.get(id)?.number ?? id, href: href.invoice(id) }),
  };
  const today = d.today;
  const periods = lastPeriods(today, 12);
  const thisPeriod = periods.at(-1)!;
  const dayMs = 86_400_000;
  const consumed = (since: number, centreId?: ID, productId?: ID) => d.movements
    .filter((m) => m.type === "consumption" && (!centreId || m.centreId === centreId) && (!productId || m.productId === productId) && today.getTime() - new Date(m.occurredAt).getTime() <= since * dayMs)
    .reduce((s, m) => s + m.quantity, 0);
  const monthlyAvg = (centreId: ID, productId: ID) => Math.round(consumed(90, centreId, productId) / 3);
  const uniq = <T extends Citation>(cs: T[]) => [...new Map(cs.map((c) => [`${c.kind}:${c.id}`, c])).values()];

  const out = <C extends AICapabilityId>(capability: C, o: Omit<AIOutput<AIResult[C]>, "capability" | "demo" | "provider" | "status" | "generatedAt">): AIOutput<AIResult[C]> =>
    ({ capability, demo: true, provider: "demo", status: outputStatus(capability), generatedAt: today.toISOString(), ...o, confidence: Math.round(o.confidence * 100) / 100, citations: uniq(o.citations) });

  const match = (phrases: string[]) => phrases.map((phrase) => {
    const best = d.products.map((p) => ({ p, s: matchScore(phrase, p.name) })).sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))[0];
    return best && best.s >= 0.5 ? { phrase, productId: best.p.id, score: best.s } : { phrase, productId: null, score: best?.s ?? 0 };
  });

  const budgetRows = () => {
    const daysIn = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return d.budgets.filter((b) => b.period === thisPeriod).map((b) => {
      const used = b.spent + b.committed;
      // Spend runs at today's daily rate for the rest of the month; commitments are already counted in full.
      const projected = Math.round(b.committed + b.spent * daysIn / today.getDate());
      return { centreId: b.centreId, allocated: b.allocated, used, projected, risk: (projected > b.allocated ? "over" : projected > b.allocated * 0.9 ? "watch" : "ok") as "over" | "watch" | "ok" };
    }).sort((a, b) => b.projected / b.allocated - a.projected / a.allocated);
  };

  const risks = (centreId?: ID) => d.balances
    .filter((b) => !centreId || b.centreId === centreId)
    .map((b) => {
      const rate = consumed(90, b.centreId, b.productId) / 90;
      return { centreId: b.centreId, productId: b.productId, onHand: b.onHand, reorderPoint: pmap.get(b.productId)?.reorderPoint ?? 0, daysCover: rate > 0 ? Math.round(b.onHand / rate) : 999 };
    })
    .filter((r) => r.onHand <= r.reorderPoint)
    .sort((a, b) => a.daysCover - b.daysCover || a.centreId.localeCompare(b.centreId) || a.productId.localeCompare(b.productId));

  const overdue = () => d.invoices.filter((i) => i.status !== "paid" && ageingBucket(i.dueAt, today) !== "current").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const late = () => d.purchaseOrders.filter((p) => (p.status === "issued" || p.status === "partially_received") && new Date(p.expectedAt).getTime() < today.getTime()).sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));

  const handlers: { [C in AICapabilityId]: (input: AIInput[C]) => AIOutput<AIResult[C]> } = {
    request_intelligence: ({ centreId, transcript }) => {
      const phrases = extractPhrases(transcript);
      const matched = match(phrases.map((p) => p.phrase));
      const lines: DraftLine[] = phrases.map((p, i) => ({ ...matched[i]!, qty: p.qty, historicalAvgQty: matched[i]!.productId ? monthlyAvg(centreId, matched[i]!.productId!) : 0 }));
      const found = lines.filter((l) => l.productId);
      return out("request_intelligence", {
        confidence: lines.length ? found.reduce((s, l) => s + l.score, 0) / lines.length : 0,
        summary: `${lines.length} items heard; ${found.length} matched to the catalogue for ${cmap.get(centreId)?.name ?? "the centre"}.`,
        explanation: ["Quantities and item names were read from the transcript (\"<number> <item>\").", "Each item was matched to the catalogue by shared words; matches under 50% are left for you to pick.", "History = average monthly consumption at this centre over the last 90 days."],
        citations: [cite.centre(centreId), ...found.map((l) => cite.product(l.productId!))],
        highlights: lines.map((l) => ({ label: `${l.qty} × ${l.phrase}`, value: l.productId ? `${pmap.get(l.productId)!.name} · ${percent(l.score)}` : "No match", href: l.productId ? href.product(pmap.get(l.productId)!.sku) : undefined })),
        result: { lines },
      });
    },
    catalogue_matching: ({ phrases }) => {
      const matches = match(phrases);
      return out("catalogue_matching", {
        confidence: matches.length ? matches.reduce((s, m) => s + m.score, 0) / matches.length : 0,
        summary: `${matches.filter((m) => m.productId).length} of ${matches.length} phrases matched a catalogue product.`,
        explanation: ["Words in the phrase are compared with words in each product name (plurals and unit words ignored).", "Score = share of the phrase's words found in the product name; the best product at 50% or more wins."],
        citations: matches.filter((m) => m.productId).map((m) => cite.product(m.productId!)),
        highlights: matches.map((m) => ({ label: m.phrase, value: m.productId ? `${pmap.get(m.productId)!.name} · ${percent(m.score)}` : "No match", href: m.productId ? href.product(pmap.get(m.productId)!.sku) : undefined })),
        result: { matches },
      });
    },
    inventory_analysis: ({ centreId }) => {
      const all = risks(centreId), r = all.slice(0, 6);
      return out("inventory_analysis", {
        confidence: 0.8,
        summary: r.length ? `${all.length} centre-SKU line${all.length === 1 ? "" : "s"} at or under reorder point; the tightest has ${r[0]!.daysCover} days of cover.` : "Nothing is at or under its reorder point.",
        explanation: ["Only lines at or under their reorder point are considered.", "Days of cover = units on hand ÷ average daily consumption over the last 90 days."],
        citations: r.flatMap((x) => [cite.centre(x.centreId), cite.product(x.productId)]),
        highlights: r.map((x) => ({ label: `${pmap.get(x.productId)?.name} · ${cmap.get(x.centreId)?.name}`, value: `${x.onHand} on hand · ${x.daysCover} days`, href: href.centre(x.centreId) })),
        result: { risks: r },
      });
    },
    demand_forecasting: () => {
      const value = (per: string) => d.movements.filter((m) => m.type === "consumption" && m.occurredAt.slice(0, 7) === per).reduce((s, m) => s + m.quantity * (pmap.get(m.productId)?.unitCost ?? 0), 0);
      const history = periods.map((p, i) => ({ period: p, value: i === 11 ? fullMonth(value(p), today) : value(p) }));
      const { points, spread } = seasonalForecast(history.map((h) => h.value));
      const next = (k: number) => lastPeriods(new Date(today.getFullYear(), today.getMonth() + k, 1), 1)[0]!;
      const forecast = points.map((p) => ({ period: next(p.step), value: p.value, low: p.low, high: p.high }));
      const avg = forecast.reduce((s, f) => s + f.value, 0) / forecast.length || 1;
      return out("demand_forecasting", {
        confidence: Math.max(0.3, 1 - spread / avg),
        summary: `Consumption of about ${moneyCompact(forecast[0]!.value)} expected in ${monthLabel(forecast[0]!.period)}.`,
        explanation: ["Statistical stand-in: same month last year, averaged with its neighbours (seasonal moving average).", `80% band = ±${moneyCompact(spread)}, the month-to-month noise in the last 12 months.`, "This month is scaled to a full month by elapsed days."],
        citations: d.centres.map((c) => cite.centre(c.id)),
        highlights: forecast.map((f) => ({ label: monthLabel(f.period), value: `${moneyCompact(f.value)} (${moneyCompact(f.low)}–${moneyCompact(f.high)})` })),
        result: { method: "seasonal_moving_average", history, forecast },
      });
    },
    procurement_optimization: () => {
      const accepted = d.quotations.filter((q) => q.status === "accepted");
      const suggestions = accepted.flatMap((cur) => {
        const alt = d.quotations
          .filter((q) => q.productId === cur.productId && q.status === "received" && q.unitPrice < cur.unitPrice && smap.get(q.supplierId)?.status === "approved")
          .sort((a, b) => a.unitPrice - b.unitPrice)[0];
        if (!alt) return [];
        const annualUnits = consumed(365, undefined, cur.productId);
        return [{ productId: cur.productId, currentSupplierId: cur.supplierId, currentPrice: cur.unitPrice, altSupplierId: alt.supplierId, altPrice: alt.unitPrice, annualUnits, saving: annualUnits * (cur.unitPrice - alt.unitPrice) }];
      }).sort((a, b) => b.saving - a.saving).slice(0, 5);
      return out("procurement_optimization", {
        confidence: 0.7,
        summary: suggestions.length ? `Switching ${suggestions.length} item${suggestions.length === 1 ? "" : "s"} could save about ${moneyCompact(suggestions.reduce((s, x) => s + x.saving, 0))} a year.` : "No approved supplier currently undercuts our contract prices.",
        explanation: ["Compares each contract (accepted) price with received quotations from approved suppliers.", "Saving = last 12 months' consumption × price difference; lead time and quality are not weighed yet."],
        citations: suggestions.flatMap((s) => [cite.product(s.productId), cite.supplier(s.currentSupplierId), cite.supplier(s.altSupplierId)]),
        highlights: suggestions.map((s) => ({ label: pmap.get(s.productId)?.name ?? s.productId, value: `${smap.get(s.altSupplierId)?.name} · ${moneyCompact(s.saving)}/yr`, href: href.supplier(s.altSupplierId) })),
        result: { suggestions },
      });
    },
    budget_intelligence: () => {
      const rows = budgetRows();
      const atRisk = rows.filter((r) => r.risk !== "ok");
      return out("budget_intelligence", {
        confidence: Math.min(0.9, 0.4 + today.getDate() / 60),
        summary: atRisk.length ? `${atRisk.length} centre${atRisk.length === 1 ? "" : "s"} on course to exceed or come within 10% of budget.` : "Every centre is on course to stay within budget.",
        explanation: ["Projected = committed orders + spend so far scaled to the full month at today's daily rate.", "Over = projected above allocation; watch = within 10% of it. Confidence grows as the month progresses."],
        citations: rows.slice(0, 5).map((r) => cite.centre(r.centreId)),
        highlights: rows.slice(0, 5).map((r) => ({ label: cmap.get(r.centreId)?.name ?? r.centreId, value: `${moneyCompact(r.projected)} of ${moneyCompact(r.allocated)} · ${r.risk}`, href: href.centre(r.centreId) })),
        result: { centres: rows },
      });
    },
    document_intelligence: ({ invoiceId }) => {
      const inv = imap.get(invoiceId);
      const po = d.purchaseOrders.find((p) => p.id === inv?.purchaseOrderId);
      const fields = inv ? [
        { field: "Supplier", value: smap.get(inv.supplierId)?.name ?? inv.supplierId, confidence: 0.97 },
        { field: "Invoice number", value: inv.number, confidence: 0.99 },
        { field: "PO reference", value: po?.number ?? "—", confidence: po ? 0.93 : 0.4 },
        { field: "Total (tax-free)", value: money(inv.amount), confidence: 0.95 },
        { field: "Due date", value: new Date(inv.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), confidence: 0.9 },
      ] : [];
      return out("document_intelligence", {
        confidence: fields.length ? fields.reduce((s, f) => s + f.confidence, 0) / fields.length : 0,
        summary: inv ? `${inv.number}: fields read and linked to ${po?.number ?? "no PO"}; a person confirms before it enters payables.` : "Invoice not found in your scope.",
        explanation: ["Demo: fields are read from the invoice record, not a scanned PDF.", "Per-field confidence is fixed per field type in the fixture; a real model scores each extraction."],
        citations: inv ? [cite.invoice(inv.id), cite.supplier(inv.supplierId), ...(po ? [{ kind: "purchase_order" as const, id: po.id, label: po.number, href: href.po(po.id) }] : [])] : [],
        highlights: fields.map((f) => ({ label: f.field, value: `${f.value} · ${percent(f.confidence)}` })),
        result: { fields },
      });
    },
    reconciliation: () => {
      const ex = reconciliationExceptions(d.invoices, d.payments).slice(0, 8);
      return out("reconciliation", {
        confidence: 0.9,
        summary: `${ex.length} item${ex.length === 1 ? "" : "s"} do not tie out between invoices, payments and receipts.`,
        explanation: ["Sums payments per invoice and compares with the billed amount.", "Open invoices with no goods receipt cannot be matched yet."],
        citations: ex.map((x) => cite.invoice(x.invoiceId)),
        highlights: ex.map((x) => ({ label: `${imap.get(x.invoiceId)?.number} · ${RECON_LABEL[x.kind]}`, value: x.delta ? money(x.delta) : "—", href: href.invoice(x.invoiceId) })),
        result: { exceptions: ex },
      });
    },
    executive_insights: () => {
      const spend = (p: string) => d.budgets.filter((b) => b.period === p).reduce((s, b) => s + b.spent, 0);
      const prev = spend(periods.at(-2)!), mtd = spend(thisPeriod);
      const top = budgetRows()[0];
      const od = overdue();
      const r = risks();
      const headlines = [
        `Spend is ${moneyCompact(mtd)} month to date against ${moneyCompact(prev)} for all of last month.`,
        ...(top ? [`${cmap.get(top.centreId)?.name} is projected at ${percent(top.projected / top.allocated)} of its budget.`] : []),
        `${od.length} supplier invoice${od.length === 1 ? " is" : "s are"} overdue, worth ${moneyCompact(od.reduce((s, i) => s + i.amount, 0))}.`,
        `${r.length} centre-SKU line${r.length === 1 ? " is" : "s are"} at or under reorder point.`,
      ];
      return out("executive_insights", {
        confidence: 0.85,
        summary: headlines[0]!,
        explanation: ["Each headline is one computed figure from budgets, invoices or stock — no free-text generation."],
        citations: [...(top ? [cite.centre(top.centreId)] : []), ...od.slice(0, 3).map((i) => cite.invoice(i.id)), ...r.slice(0, 2).map((x) => cite.product(x.productId))],
        highlights: headlines.map((h, i) => ({ label: `#${i + 1}`, value: h })),
        result: { headlines },
      });
    },
    operational_assistant: ({ questionId }) => {
      const question = ASSISTANT_QUESTIONS.find((q) => q.id === questionId)!.question;
      let answer = "", citations: Citation[] = [], highlights: Highlight[] = [];
      if (questionId === "low_stock") {
        const r = risks().slice(0, 5);
        answer = r.length ? `${risks().length} lines are at or under reorder point. Tightest: ${r.slice(0, 3).map((x) => `${pmap.get(x.productId)?.name} at ${cmap.get(x.centreId)?.name} (${x.daysCover} days of cover)`).join("; ")}.` : "Nothing is at or under its reorder point.";
        citations = r.flatMap((x) => [cite.product(x.productId), cite.centre(x.centreId)]);
        highlights = r.map((x) => ({ label: `${pmap.get(x.productId)?.name} · ${cmap.get(x.centreId)?.name}`, value: `${x.onHand} on hand`, href: href.centre(x.centreId) }));
      } else if (questionId === "overdue_invoices") {
        const od = overdue();
        const bucket = (i: (typeof od)[number]) => AGEING.find((b) => b.key === ageingBucket(i.dueAt, today))!.label;
        answer = od.length ? `${od.length} invoices are overdue, ${moneyCompact(od.reduce((s, i) => s + i.amount, 0))} in total. Oldest: ${od.slice(0, 3).map((i) => `${i.number} (${smap.get(i.supplierId)?.name}, ${bucket(i)})`).join("; ")}.` : "No supplier invoice is overdue.";
        citations = od.slice(0, 5).map((i) => cite.invoice(i.id));
        highlights = od.slice(0, 5).map((i) => ({ label: `${i.number} · ${smap.get(i.supplierId)?.name}`, value: money(i.amount), href: href.invoice(i.id) }));
      } else if (questionId === "budget_risk") {
        const rows = budgetRows().slice(0, 3);
        answer = rows.length ? `${cmap.get(rows[0]!.centreId)?.name} is closest: ${moneyCompact(rows[0]!.used)} used of ${moneyCompact(rows[0]!.allocated)}, projected ${moneyCompact(rows[0]!.projected)} by month end.` : "No budgets for this month.";
        citations = rows.map((r) => cite.centre(r.centreId));
        highlights = rows.map((r) => ({ label: cmap.get(r.centreId)?.name ?? r.centreId, value: `${percent(r.projected / r.allocated)} projected`, href: href.centre(r.centreId) }));
      } else {
        const l = late();
        answer = l.length ? `${l.length} purchase order${l.length === 1 ? " is" : "s are"} past the expected date: ${l.slice(0, 3).map((p) => `${p.number} from ${smap.get(p.supplierId)?.name} to ${cmap.get(p.centreId)?.name}`).join("; ")}.` : "No deliveries are late.";
        citations = l.slice(0, 5).map((p) => ({ kind: "purchase_order" as const, id: p.id, label: p.number, href: href.po(p.id) }));
        highlights = l.slice(0, 5).map((p) => ({ label: `${p.number} · ${cmap.get(p.centreId)?.name}`, value: smap.get(p.supplierId)?.name ?? "", href: href.po(p.id) }));
      }
      return out("operational_assistant", {
        confidence: 0.9, summary: answer, citations, highlights,
        explanation: ["Answered from a fixed question list with a deterministic query over the demo data; free-text questions need the AI model."],
        result: { questionId, question, answer },
      });
    },
  };

  return {
    name: "demo",
    connected: false,
    run: (capability, input) => Promise.resolve(handlers[capability](input)),
  };
}

/** Default input per capability, for screens that preview every capability at once. */
export function previewInputs(d: Pick<AIDataset, "centres" | "invoices">): { [C in AICapabilityId]: AIInput[C] } {
  const centreId = d.centres[0]?.id ?? "";
  return {
    request_intelligence: { centreId, transcript: DEMO_TRANSCRIPT },
    catalogue_matching: { phrases: extractPhrases(DEMO_TRANSCRIPT).map((p) => p.phrase) },
    inventory_analysis: {},
    demand_forecasting: { months: 3 },
    procurement_optimization: {},
    budget_intelligence: {},
    document_intelligence: { invoiceId: d.invoices.at(-1)?.id ?? "" },
    reconciliation: {},
    executive_insights: {},
    operational_assistant: { questionId: "low_stock" },
  };
}
