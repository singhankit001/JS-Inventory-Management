import type { Repository } from "@/lib/data/provider";
import type { Role } from "@/domain/types";
import type { Tone } from "@/components/ui/badge";
import { indexBy } from "@/features/dashboards/shared";
import { period } from "@/lib/data/seed";
import { monthLabel } from "@/lib/format";

/**
 * A scripted walkthrough of one monthly request: Kavya Nair (Baner) records a voice request, the AI intake drafts it,
 * Head Office approves, Purchasing orders, Finance matches the invoices and the CEO sees the outcome.
 * People, products, prices, suppliers and Baner's budget come from the demo data; the story itself (timings, the
 * transcript, the one quantity edit and the one billing query) is scripted so every stage has something to show.
 */
export const JOURNEY_CENTRE = "c-bnr";
export const JOURNEY_ROLES: Role[] = ["centre_leader", "head_office", "purchasing", "finance", "ceo"];

export type StageKey = "voice" | "intake" | "approval" | "purchasing" | "finance" | "executive";

interface Spoken { productId: string; heard: string; qty: number; confidence: number; approvedQty?: number; note?: string; received?: number }

const SPOKEN: Spoken[] = [
  { productId: "p-1", heard: "eighteen boxes of jumbo crayons", qty: 18, confidence: 0.98 },
  { productId: "p-2", heard: "twelve bottles of the washable poster paint", qty: 12, confidence: 0.95 },
  { productId: "p-10", heard: "six refills of hand wash", qty: 6, confidence: 0.97 },
  { productId: "p-13", heard: "forty packs of wet wipes", qty: 40, confidence: 0.92, approvedQty: 32, note: "Trimmed to Baner's 3-month average use plus 10% for the monsoon" },
  { productId: "p-17", heard: "ten level one story books", qty: 10, confidence: 0.81 },
  { productId: "p-20", heard: "four boxes of bandages", qty: 4, confidence: 0.96 },
  { productId: "p-24", heard: "fifteen packs of drinking cups", qty: 15, confidence: 0.9, received: 14 },
];

const TRANSCRIPT =
  "Hi, this is Kavya from Baner. For next month we need eighteen boxes of jumbo crayons, twelve bottles of the washable poster paint, six refills of hand wash and forty packs of wet wipes, the wipes are going faster with the monsoon. Also ten level one story books, four boxes of bandages for the first-aid kit, and fifteen packs of drinking cups. Thanks.";

// Supplier per category, matching the supplier master's categories.
const SUPPLIER_FOR: Record<string, string> = { "cat-art": "s-1", "cat-hyg": "s-7", "cat-toy": "s-3", "cat-aid": "s-4", "cat-pan": "s-5" };

export async function loadJourney(repo: Repository) {
  const today = repo.today();
  const [users, products, categories, suppliers, centres, budgets, uoms] = await Promise.all([
    repo.users(), repo.products(), repo.categories(), repo.suppliers(), repo.centres(), repo.budgets(), repo.uoms(),
  ]);
  const umap = indexBy(users, "id"), pmap = indexBy(products, "id"), cats = indexBy(categories, "id"), smap = indexBy(suppliers, "id"), units = indexBy(uoms, "id");
  const centre = centres.find((c) => c.id === JOURNEY_CENTRE)!;
  const at = (days: number, h: number, m: number) => { const d = new Date(today); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const person = (id: string, role: string) => ({ name: umap.get(id)?.name ?? "—", role });

  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const forPeriod = `${monthLabel(period(next))} ${next.getFullYear()}`;
  const lines = SPOKEN.map((s, i) => {
    const p = pmap.get(s.productId)!;
    const approved = s.approvedQty ?? s.qty;
    const received = s.received ?? approved;
    return {
      id: `l-${i + 1}`, heard: s.heard, product: p.name, sku: p.sku, category: cats.get(p.categoryId)?.name ?? "—", categoryId: p.categoryId,
      uom: units.get(p.uomId)?.code ?? p.uomId, unitCost: p.unitCost, qty: s.qty, confidence: s.confidence, approved, note: s.note,
      received, invoiced: approved, supplierId: SUPPLIER_FOR[p.categoryId]!,
    };
  });
  const requested = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const approvedValue = lines.reduce((s, l) => s + l.approved * l.unitCost, 0);

  // One PO per supplier, numbered in the demo's PO range.
  const orders = [...new Set(lines.map((l) => l.supplierId))].map((sid, i) => {
    const ls = lines.filter((l) => l.supplierId === sid);
    const s = smap.get(sid)!;
    const total = ls.reduce((a, l) => a + l.approved * l.unitCost, 0);
    const received = ls.reduce((a, l) => a + l.received * l.unitCost, 0);
    const invoiced = ls.reduce((a, l) => a + l.invoiced * l.unitCost, 0);
    const short = ls.filter((l) => l.received < l.invoiced);
    return {
      id: sid, po: `PO-${3120 + i}`, invoice: `INV-${s.name.split(" ")[0]!.slice(0, 3).toUpperCase()}-${8841 + i * 7}`, supplier: s.name,
      lead: s.avgLeadDays, lines: ls.length, total, received, invoiced,
      match: short.length
        ? { label: "Query raised", tone: "amber" as Tone, detail: short.map((l) => `${l.product}: billed ${l.invoiced}, received ${l.received}`).join("; ") }
        : { label: "3-way matched", tone: "green" as Tone, detail: "PO, goods receipt and invoice agree" },
    };
  });
  const invoicedTotal = orders.reduce((s, o) => s + o.invoiced, 0);
  const payable = orders.reduce((s, o) => s + (o.match.tone === "green" ? o.invoiced : o.received), 0);
  const budget = budgets.find((b) => b.centreId === centre.id && b.period === period(today));
  const allocation = budget?.allocated ?? centre.monthlyBudget;

  const stages = [
    { key: "voice" as const, title: "Voice request", owner: person("u-cl", "Centre Leader · Baner"), at: at(-9, 8, 42), status: { label: "Submitted", tone: "green" as Tone } },
    { key: "intake" as const, title: "AI intake", owner: { name: "Intake assistant", role: "Demo · model under development" }, at: at(-9, 8, 43), status: { label: "Draft confirmed", tone: "green" as Tone } },
    { key: "approval" as const, title: "Head Office approval", owner: person("u-ho", "Head Office"), at: at(-8, 11, 20), status: { label: "Approved with 1 edit", tone: "green" as Tone } },
    { key: "purchasing" as const, title: "Purchasing", owner: person("u-po", "Purchasing Officer"), at: at(-7, 10, 5), status: { label: `${orders.length} POs issued`, tone: "green" as Tone } },
    { key: "finance" as const, title: "Finance & Accounts", owner: person("u-fin", "Finance & Accounts"), at: at(0, 10, 15), status: { label: "In review", tone: "blue" as Tone } },
    { key: "executive" as const, title: "Executive view", owner: person("u-ceo", "CEO / Executive"), at: at(0, 10, 16), status: { label: "Live", tone: "neutral" as Tone } },
  ];

  return {
    centre: { name: centre.name, city: centre.city }, forPeriod, transcript: TRANSCRIPT, durationSec: 48,
    lines, orders, stages, current: "finance" as StageKey,
    totals: { requested, approved: approvedValue, invoiced: invoicedTotal, payable, held: invoicedTotal - payable, allocation, items: lines.length },
    timeline: { delivered: at(-3, 12, 30), invoiced: at(-2, 16, 10), due: at(28, 23, 0) },
    cycleDays: 9,
  };
}

export type Journey = Awaited<ReturnType<typeof loadJourney>>;
