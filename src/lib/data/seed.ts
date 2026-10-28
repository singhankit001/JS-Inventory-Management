// DEVELOPMENT SEED DATA — fictional records for demo mode only. Never presented as live business data:
// the shell shows a "Demo data" badge whenever this provider is active.
//
// The dataset is simulated day by day over the last 12 months so every figure ties out:
// stock movements drive balances, purchase-order lines drive PO totals, goods-receipt lines drive receipt totals,
// receipt movements and budget spend, and invoices are three-way matched against PO and receipt lines.
import type {
  AIProcessingJob, Approval, AuditEvent, Budget, Centre, GoodsReceipt, GoodsReceiptLine, Integration, Invoice, MonthlyRequest,
  Notification, Payment, Product, ProductCategory, PurchaseOrder, PurchaseOrderLine, RequestItem, StockBalance, StockCount,
  StockMovement, Supplier, SupplierQuotation, UnitOfMeasure, User,
} from "@/domain/types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedData {
  today: Date;
  centres: Centre[];
  users: User[];
  categories: ProductCategory[];
  uoms: UnitOfMeasure[];
  products: Product[];
  balances: StockBalance[];
  movements: StockMovement[];
  counts: StockCount[];
  requests: MonthlyRequest[];
  requestItems: RequestItem[];
  approvals: Approval[];
  suppliers: Supplier[];
  quotations: SupplierQuotation[];
  purchaseOrders: PurchaseOrder[];
  purchaseOrderLines: PurchaseOrderLine[];
  receipts: GoodsReceipt[];
  receiptLines: GoodsReceiptLine[];
  invoices: Invoice[];
  payments: Payment[];
  budgets: Budget[];
  notifications: Notification[];
  audit: AuditEvent[];
  aiJobs: AIProcessingJob[];
  integrations: Integration[];
}

export const period = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Accounts offered on the sign-in page. Other seeded staff (centre leaders) exist so records have real owners. */
export const DEMO_LOGIN_IDS = ["u-ceo", "u-ho", "u-cl", "u-cl2", "u-po", "u-fin", "u-rcv", "u-adm"];

/** POs above this value need final authorisation before they are issued. */
const AUTH_THRESHOLD = 25_000_00;

// Term-time seasonality (Jan…Dec): summer break in May, school reopens mid-June, Christmas week in December.
const MONTH_SEASON = [1, 1, 0.95, 0.85, 0.35, 0.7, 1.1, 1.05, 1, 1, 1, 0.85];
// Diwali holidays close centres for most of a week.
const DIWALI = ["2024-11-01", "2025-10-21", "2026-11-08", "2027-10-29", "2028-10-17"].map((s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y!, m! - 1, d!).getTime(); });
const season = (d: Date) => MONTH_SEASON[d.getMonth()]! * (DIWALI.some((t) => Math.abs(d.getTime() - t) <= 4 * 86_400_000) ? 0.25 : 1);
/** Average seasonality over the 30 days from `d` — what a monthly order should cover. */
const seasonAhead = (d: Date) => Array.from({ length: 10 }, (_, i) => season(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i * 3))).reduce((a, b) => a + b, 0) / 10;

export function buildSeed(now = new Date()): SeedData {
  const rnd = mulberry32(20261027);
  const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
  const between = (min: number, max: number) => min + rnd() * (max - min);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = (offset: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const day = (offset: number, hour = 10) => { const d = date(offset); d.setHours(hour, int(0, 59)); return d.toISOString(); };
  const offsetOf = (d: Date) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000);
  const monthsAgo = (n: number) => new Date(today.getFullYear(), today.getMonth() - n, 1);
  const rupees = (paise: number) => Math.round(paise / 100) * 100;
  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
  const thisPeriod = period(today);

  // ---- Master data ----
  // Names and cities of the centres listed on jumpstartpreschool.in. Enrolment, budgets and every operational figure below are simulated.
  const centreSpec: [string, string, string, string, number][] = [
    // id, code, name, city, enrolled children (drives consumption and budget)
    ["c-bnr", "BNR", "Baner", "Pune", 210],
    ["c-wkd", "WKD", "Wakad", "Pune", 175],
    ["c-kor", "KOR", "Koramangala", "Bengaluru", 190],
    ["c-hjw", "HJW", "Hinjewadi", "Pune", 150],
    ["c-vmn", "VMN", "Viman Nagar", "Pune", 165],
    ["c-krv", "KRV", "Karve Road", "Pune", 140],
    ["c-mgp", "MGP", "Magarpatta", "Pune", 185],
    ["c-pms", "PMS", "Pimple Saudagar", "Pune", 160],
    ["c-nyc", "NYC", "Nyati County", "Pune", 130],
    ["c-bbw", "BBW", "Bibwewadi", "Pune", 170],
    ["c-khr", "KHR", "Kharadi", "Pune", 125],
  ];

  const categories: ProductCategory[] = [
    { id: "cat-art", name: "Art & craft", color: "orange" },
    { id: "cat-sta", name: "Stationery", color: "blue" },
    { id: "cat-hyg", name: "Hygiene & cleaning", color: "green" },
    { id: "cat-toy", name: "Learning toys", color: "violet" },
    { id: "cat-aid", name: "First aid", color: "amber" },
    { id: "cat-pan", name: "Pantry", color: "slate" },
  ];
  const uoms: UnitOfMeasure[] = [
    { id: "pcs", code: "pcs", name: "Pieces" }, { id: "box", code: "box", name: "Box" },
    { id: "pack", code: "pack", name: "Pack" }, { id: "L", code: "L", name: "Litre" }, { id: "kg", code: "kg", name: "Kilogram" },
  ];
  const productSpec: [string, string, string, number, number][] = [
    ["Jumbo wax crayons (12)", "cat-art", "box", 180_00, 30],
    ["Washable poster paint 500 ml", "cat-art", "pcs", 240_00, 24],
    ["Play dough tubs (4)", "cat-art", "pack", 320_00, 20],
    ["A3 drawing paper (100)", "cat-art", "pack", 410_00, 15],
    ["Child-safe scissors", "cat-art", "pcs", 65_00, 40],
    ["Glue sticks (10)", "cat-sta", "pack", 150_00, 25],
    ["Pencils HB (12)", "cat-sta", "box", 90_00, 30],
    ["Activity notebooks", "cat-sta", "pcs", 55_00, 120],
    ["Whiteboard markers (4)", "cat-sta", "pack", 140_00, 20],
    ["Hand wash refill 5 L", "cat-hyg", "L", 620_00, 8],
    ["Surface disinfectant 5 L", "cat-hyg", "L", 780_00, 6],
    ["Tissue boxes", "cat-hyg", "box", 85_00, 60],
    ["Wet wipes (80)", "cat-hyg", "pack", 120_00, 50],
    ["Floor cleaner 5 L", "cat-hyg", "L", 540_00, 6],
    ["Wooden puzzle set", "cat-toy", "pcs", 690_00, 6],
    ["Building blocks (100)", "cat-toy", "box", 1_450_00, 4],
    ["Story books (Level 1)", "cat-toy", "pcs", 180_00, 30],
    ["Sensory balls (6)", "cat-toy", "pack", 520_00, 5],
    ["First-aid kit refill", "cat-aid", "pcs", 950_00, 3],
    ["Adhesive bandages (100)", "cat-aid", "box", 210_00, 6],
    ["Antiseptic liquid 500 ml", "cat-aid", "pcs", 175_00, 6],
    ["Milk powder 1 kg", "cat-pan", "kg", 480_00, 10],
    ["Whole-grain biscuits", "cat-pan", "pack", 60_00, 80],
    ["Drinking cups (50)", "cat-pan", "pack", 95_00, 20],
  ];
  const products: Product[] = productSpec.map(([name, categoryId, uomId, unitCost, reorderPoint], i) => ({
    id: `p-${i + 1}`, sku: `JS-${String(1001 + i)}`, name, categoryId, uomId, unitCost, reorderPoint, status: "active",
  }));
  const pmap = new Map(products.map((p) => [p.id, p]));
  const kids = new Map(centreSpec.map(([id, , , , k]) => [id, k]));
  /** Units a centre uses in a normal term month: reorder point is sized to roughly three weeks at an average (170-child) centre. */
  const planUse = (centreId: string, p: Product) => p.reorderPoint * 1.2 * kids.get(centreId)! / 170;

  const centres: Centre[] = centreSpec.map(([id, code, name, city]) => ({
    id, code, name, city, status: "active",
    // Allocation = a planned term month at catalogue cost plus ~20% headroom, rounded to ₹5,000.
    monthlyBudget: Math.round(sum(products, (p) => planUse(id, p) * p.unitCost) * 1.2 / 5_000_00) * 5_000_00,
  }));

  const leaderSpec: [string, string, string, string, number][] = [
    // centre, id, name, email, last active (days ago)
    ["c-wkd", "u-cl-wkd", "Ishita Menon", "wakad@demo.jumpstart.local", 0],
    ["c-hjw", "u-cl-hjw", "Karthik Rao", "hinjewadi@demo.jumpstart.local", 1],
    ["c-vmn", "u-cl-vmn", "Sana Qureshi", "vimannagar@demo.jumpstart.local", 0],
    ["c-krv", "u-cl-krv", "Fatima Sheikh", "karveroad@demo.jumpstart.local", 2],
    ["c-mgp", "u-cl-mgp", "Pranav Kulkarni", "magarpatta@demo.jumpstart.local", 0],
    ["c-pms", "u-cl-pms", "Divya Shetty", "pimplesaudagar@demo.jumpstart.local", 3],
    ["c-nyc", "u-cl-nyc", "Nikhil Bhat", "nyaticounty@demo.jumpstart.local", 1],
    ["c-bbw", "u-cl-bbw", "Lakshmi Reddy", "bibwewadi@demo.jumpstart.local", 9],
    ["c-khr", "u-cl-khr", "Aditi Deshpande", "kharadi@demo.jumpstart.local", 0],
  ];
  const users: User[] = [
    { id: "u-ceo", name: "Aarav Kapoor", email: "ceo@demo.jumpstart.local", roles: ["ceo"], centreIds: [], status: "active", lastActiveAt: day(0, 9) },
    { id: "u-ho", name: "Meera Iyer", email: "headoffice@demo.jumpstart.local", roles: ["head_office", "finance"], centreIds: [], status: "active", lastActiveAt: day(0, 9) },
    { id: "u-cl", name: "Kavya Nair", email: "baner@demo.jumpstart.local", roles: ["centre_leader"], centreIds: ["c-bnr"], status: "active", lastActiveAt: day(0, 8) },
    { id: "u-cl2", name: "Rohan Desai", email: "koramangala@demo.jumpstart.local", roles: ["centre_leader"], centreIds: ["c-kor"], status: "active", lastActiveAt: day(-1, 17) },
    { id: "u-po", name: "Vikram Shah", email: "purchasing@demo.jumpstart.local", roles: ["purchasing"], centreIds: [], status: "active", lastActiveAt: day(0, 10) },
    { id: "u-fin", name: "Anjali Rao", email: "finance@demo.jumpstart.local", roles: ["finance"], centreIds: [], status: "active", lastActiveAt: day(0, 11) },
    { id: "u-rcv", name: "Suresh Pillai", email: "receiving@demo.jumpstart.local", roles: ["receiving"], centreIds: ["c-bnr", "c-wkd"], status: "active", lastActiveAt: day(0, 7) },
    { id: "u-adm", name: "Neha Joshi", email: "admin@demo.jumpstart.local", roles: ["admin"], centreIds: [], status: "active", lastActiveAt: day(0, 12) },
    { id: "u-old", name: "Former Staff", email: "former@demo.jumpstart.local", roles: ["receiving"], centreIds: ["c-vmn"], status: "suspended", lastActiveAt: day(-60) },
    ...leaderSpec.map(([centreId, id, name, email, ago]): User => ({ id, name, email, roles: ["centre_leader"], centreIds: [centreId], status: "active", lastActiveAt: day(-ago, int(8, 18)) })),
  ];
  const leaderOf = new Map<string, string>([["c-bnr", "u-cl"], ["c-kor", "u-cl2"], ...leaderSpec.map(([c, id]) => [c, id] as [string, string])]);
  const receiverOf = (centreId: string) => (centreId === "c-bnr" || centreId === "c-wkd" ? "u-rcv" : leaderOf.get(centreId)!);

  const suppliers: Supplier[] = [
    { id: "s-1", name: "Crayonworks Educational Supplies", categoryIds: ["cat-art", "cat-sta"], status: "approved", onTimeRate: 0.94, qualityScore: 0.92, avgLeadDays: 4 },
    { id: "s-2", name: "CleanNest Hygiene Pvt", categoryIds: ["cat-hyg"], status: "approved", onTimeRate: 0.81, qualityScore: 0.88, avgLeadDays: 6 },
    { id: "s-3", name: "Little Learners Toys", categoryIds: ["cat-toy"], status: "approved", onTimeRate: 0.89, qualityScore: 0.95, avgLeadDays: 8 },
    { id: "s-4", name: "MediSafe Distributors", categoryIds: ["cat-aid"], status: "approved", onTimeRate: 0.97, qualityScore: 0.9, avgLeadDays: 3 },
    { id: "s-5", name: "FreshPantry Foods", categoryIds: ["cat-pan"], status: "approved", onTimeRate: 0.72, qualityScore: 0.84, avgLeadDays: 2 },
    // Alternatives that only quote for now; their scores are from onboarding references, not our deliveries.
    { id: "s-6", name: "Paper Trail Stationers", categoryIds: ["cat-sta", "cat-art"], status: "pending", onTimeRate: 0.86, qualityScore: 0.8, avgLeadDays: 5 },
    { id: "s-7", name: "SafeHands Hygiene Supplies", categoryIds: ["cat-hyg"], status: "approved", onTimeRate: 0.9, qualityScore: 0.9, avgLeadDays: 5 },
    { id: "s-8", name: "Kidz Kitchen Provisions", categoryIds: ["cat-pan"], status: "pending", onTimeRate: 0.85, qualityScore: 0.82, avgLeadDays: 2 },
  ];
  const smap = new Map(suppliers.map((s) => [s.id, s]));
  // Simulation parameters, kept apart because the published scores are re-derived from actual deliveries below.
  const nominal = new Map(suppliers.map((s) => [s.id, { onTime: s.onTimeRate, quality: s.qualityScore, lead: s.avgLeadDays }]));
  const INCUMBENT: Record<string, string> = { "cat-art": "s-1", "cat-sta": "s-1", "cat-hyg": "s-2", "cat-toy": "s-3", "cat-aid": "s-4", "cat-pan": "s-5" };
  const supplierOf = (p: Product) => INCUMBENT[p.categoryId]!;
  const incumbents = [...new Set(Object.values(INCUMBENT))];
  const ESSENTIALS = ["s-2", "s-4", "s-5"];

  // Incumbents hold an accepted quotation (the contract price); alternatives have quoted, been declined or not replied yet.
  const quotations: SupplierQuotation[] = [];
  const contract = new Map<string, number>();
  for (const p of products) {
    for (const s of suppliers.filter((x) => x.categoryIds.includes(p.categoryId))) {
      const inc = INCUMBENT[p.categoryId] === s.id;
      const status = inc ? "accepted" : pick(["requested", "received", "received", "declined"] as const);
      const unitPrice = rupees(p.unitCost * (inc ? between(0.94, 1.06) : between(0.9, 1.12)));
      if (inc) contract.set(`${s.id}:${p.id}`, unitPrice);
      quotations.push({ id: `q-${quotations.length + 1}`, supplierId: s.id, productId: p.id, unitPrice, status, validUntil: day(inc ? int(30, 150) : status === "received" ? int(2, 30) : int(10, 40)) });
    }
  }
  const refPrice = (supplierId: string, productId: string) => contract.get(`${supplierId}:${productId}`) ?? pmap.get(productId)!.unitCost;

  // ---- Day-by-day simulation ----
  type Kind = "monthly" | "pantry" | "topup" | "scripted" | "next_month";
  interface Script { centreId: string; supplierId: string; off: number; delay?: number; short?: boolean; followUp?: number; hold?: boolean }
  interface Sim {
    po: PurchaseOrder; lines: PurchaseOrderLine[]; owed: Map<string, number>; kind: Kind; createdOff: number; issuedOff: number; expectedOff: number;
    script?: Script; receipts: GoodsReceipt[]; requestId?: string;
  }
  const purchaseOrders: PurchaseOrder[] = [];
  const purchaseOrderLines: PurchaseOrderLine[] = [];
  const receipts: GoodsReceipt[] = [];
  const receiptLines: GoodsReceiptLine[] = [];
  const movements: StockMovement[] = [];
  const requests: MonthlyRequest[] = [];
  const requestItems: RequestItem[] = [];
  const sims: Sim[] = [];
  const due = new Map<number, { sim: Sim; first: boolean }[]>();
  const stock = new Map<string, number>();
  const onOrder = new Map<string, number>();
  const used = new Map<string, number>(); // `${centre}:${product}:${period}` → units consumed
  const lastTopup = new Map<string, Sim>();
  const drift = new Map<string, number>(); // `${centre}:${product}:${period}` → actual ÷ planned use
  const k = (c: string, p: string) => `${c}:${p}`;
  const get = (m: Map<string, number>, key: string) => m.get(key) ?? 0;
  const add = (m: Map<string, number>, key: string, n: number) => m.set(key, get(m, key) + n);
  const move = (centreId: string, productId: string, type: StockMovement["type"], quantity: number, occurredAt: string, reference?: string) =>
    movements.push({ id: `mv-${movements.length + 1}`, centreId, productId, type, quantity, occurredAt, ...(reference ? { reference } : {}) });

  // Scripted situations so the demo accounts always have something to do today (receiving user covers AND + POW).
  const scripts: Script[] = [
    { centreId: "c-wkd", supplierId: "s-2", off: -8, delay: 9 }, // expected two days ago, still not here → overdue
    { centreId: "c-bnr", supplierId: "s-4", off: -6, delay: 0, short: true, followUp: 2 }, // arrived short, balance due in two days
    { centreId: "c-bnr", supplierId: "s-3", off: -4 }, // due later this week
    { centreId: "c-kor", supplierId: "s-1", off: 0, hold: true }, // raised today, awaiting authorisation
  ];

  const raise = (c: Centre, supplierId: string, off: number, kind: Kind, items: { productId: string; qty: number; requestItemId?: string }[], script?: Script) => {
    const n = purchaseOrders.length;
    const po: PurchaseOrder = {
      id: `po-${n + 1}`, number: `PO-${2400 + n}`, supplierId, centreId: c.id, status: "issued", total: 0, expectedAt: "",
      createdAt: day(off, int(10, 16)), raisedBy: "u-po", priceVariance: 0,
    };
    const lines = items.map((it, i): PurchaseOrderLine => {
      const ref = refPrice(supplierId, it.productId);
      // Contract price for planned orders; urgent top-ups and fresh pantry stock pay spot prices.
      const drift = kind === "topup" || kind === "scripted" ? between(0, 0.07) : kind === "pantry" ? between(-0.02, 0.05) : rnd() < 0.75 ? 0 : between(-0.03, 0.04);
      return { id: `${po.id}-l${i + 1}`, purchaseOrderId: po.id, productId: it.productId, quantity: it.qty, unitPrice: rupees(ref * (1 + drift)), ...(it.requestItemId ? { requestItemId: it.requestItemId } : {}) };
    });
    po.total = sum(lines, (l) => l.quantity * l.unitPrice);
    po.priceVariance = sum(lines, (l) => l.quantity * (l.unitPrice - refPrice(supplierId, l.productId)));
    const nom = nominal.get(supplierId)!;
    const issuedOff = script?.hold ? 1 : off + (po.total > AUTH_THRESHOLD && rnd() < 0.5 ? 1 : 0);
    const expectedOff = kind === "next_month" ? offsetOf(new Date(today.getFullYear(), today.getMonth() + 1, 3)) + nom.lead
      : issuedOff + nom.lead + (kind === "pantry" || script ? 0 : rnd() < 0.3 ? 1 : 0);
    po.expectedAt = day(expectedOff, 9 + int(0, 6));
    const sim: Sim = { po, lines, owed: new Map(lines.map((l) => [l.id, l.quantity])), kind, createdOff: off, issuedOff, expectedOff, receipts: [], ...(script ? { script } : {}) };
    if (kind === "next_month") po.status = po.total > AUTH_THRESHOLD ? "awaiting_authorisation" : "draft";
    else if (issuedOff > 0) po.status = "awaiting_authorisation";
    else {
      // Fresh pantry stock comes on the booked day; others occasionally a day early.
      const delay = script?.delay ?? (rnd() < nom.onTime ? (kind !== "pantry" && rnd() < 0.15 ? -1 : 0) : int(1, 6));
      const arrival = Math.max(issuedOff + 1, expectedOff + delay);
      // Arrivals from today on are still expected: nothing has been counted in yet today.
      if (arrival < 0) due.set(arrival, [...(due.get(arrival) ?? []), { sim, first: true }]);
    }
    if (kind !== "next_month") for (const l of lines) add(onOrder, k(c.id, l.productId), l.quantity);
    purchaseOrders.push(po);
    purchaseOrderLines.push(...lines);
    sims.push(sim);
    return sim;
  };

  const deliver = (sim: Sim, off: number, first: boolean) => {
    const counts = sim.lines.filter((l) => sim.owed.get(l.id)! > 0).map((l) => ({ l, ordered: sim.owed.get(l.id)!, received: sim.owed.get(l.id)!, damaged: 0 }));
    if (!counts.length) return;
    if (first) {
      const nom = nominal.get(sim.po.supplierId)!;
      const shortP = sim.script ? (sim.script.short ? 1 : 0) : (1 - nom.onTime) * 0.25 + (1 - nom.quality) * 0.35;
      if (rnd() < shortP) {
        const x = pick(counts);
        x.received = Math.max(counts.length === 1 ? 1 : 0, rnd() < 0.15 ? 0 : x.ordered - Math.max(1, Math.round(x.ordered * between(0.1, 0.4))));
      }
      if (!sim.script && rnd() < (1 - nom.quality) * 0.8) {
        const xs = counts.filter((c) => c.received > 0);
        if (xs.length) { const x = pick(xs); x.damaged = Math.min(x.received, int(1, 3)); }
      }
      if (!sim.script && rnd() < 0.03) {
        const x = pick(counts);
        if (x.received === x.ordered && !x.damaged) x.received += Math.min(Math.ceil(x.ordered * 0.1), int(1, 2));
      }
    }
    const c = sim.po.centreId;
    const r: GoodsReceipt = {
      id: `gr-${receipts.length + 1}`, purchaseOrderId: sim.po.id, centreId: c, receivedAt: day(off, int(9, 15)), receivedBy: receiverOf(c),
      status: counts.some((x) => x.received !== x.ordered || x.damaged > 0) ? "discrepancy" : "confirmed",
      orderedQty: sum(counts, (x) => x.ordered), receivedQty: sum(counts, (x) => x.received), damagedQty: sum(counts, (x) => x.damaged),
    };
    receipts.push(r);
    sim.receipts.push(r);
    counts.forEach((x, i) => {
      receiptLines.push({ id: `${r.id}-l${i + 1}`, receiptId: r.id, purchaseOrderLineId: x.l.id, productId: x.l.productId, orderedQty: x.ordered, receivedQty: x.received, damagedQty: x.damaged });
      const good = x.received - x.damaged;
      sim.owed.set(x.l.id, Math.max(0, x.ordered - good));
      add(onOrder, k(c, x.l.productId), -Math.min(good, x.ordered));
      if (good > 0) { add(stock, k(c, x.l.productId), good); move(c, x.l.productId, "receipt", good, r.receivedAt, r.id); }
    });
    if (sum([...sim.owed.values()], (n) => n) > 0) {
      const next = first && sim.script?.followUp !== undefined ? sim.script.followUp : off + int(3, 7);
      if (next < 0) due.set(next, [...(due.get(next) ?? []), { sim, first: false }]);
    }
  };

  /** Average monthly use over the three months before `d`, from what was actually consumed (falls back to the plan). */
  const historyAvg = (centreId: string, p: Product, d: Date, start: Date) => {
    const ps = [1, 2, 3].map((m) => new Date(d.getFullYear(), d.getMonth() - m, 1)).filter((m) => m >= start).map(period);
    return ps.length ? Math.round(sum(ps, (x) => get(used, `${k(centreId, p.id)}:${x}`)) / ps.length) : Math.round(planUse(centreId, p));
  };
  const minLine = (c: string, p: Product) => Math.max(1, Math.round(planUse(c, p) * 0.15));
  /** Planned need: back up to the reorder point plus a month's cover, from the plan rate (actual use drifts month to month). */
  const monthlyNeed = (c: string, p: Product, d: Date, projected?: number) =>
    Math.ceil(p.reorderPoint + 1.1 * planUse(c, p) * seasonAhead(d) - (projected ?? get(stock, k(c, p.id)) + get(onOrder, k(c, p.id))));
  const groupLines = <T extends { productId: string }>(items: T[]) => {
    const out: [string, T[]][] = [];
    for (const sid of incumbents) {
      const mine = items.filter((it) => supplierOf(pmap.get(it.productId)!) === sid);
      for (let i = 0; i < mine.length; i += 6) out.push([sid, mine.slice(i, i + 6)]); // at most 6 lines per PO
    }
    return out;
  };
  const cycleDay = (ci: number) => 3 + (ci % 3);
  const pantryOffset = (ci: number) => (ci < 2 ? 0 : (ci * 5) % 14); // AND and POW get a pantry delivery due today

  const start = monthsAgo(11);
  const startOff = offsetOf(start);
  for (const c of centres) for (const p of products) {
    const qty = Math.round(0.7 * p.reorderPoint + planUse(c.id, p) * between(0.2, 0.5));
    stock.set(k(c.id, p.id), qty);
    move(c.id, p.id, "adjustment", qty, day(startOff, 8), "opening-balance");
  }

  for (let off = startOff; off <= 0; off++) {
    const d = date(off);
    const per = period(d);
    for (const [ci, c] of centres.entries()) {
      // Actual use runs above or below plan by month (themes, absences, events), so some lines run short before the next cycle.
      if (d.getDate() === 1 || off === startOff) for (const p of products) drift.set(`${k(c.id, p.id)}:${per}`, rnd() < 0.12 ? between(1.5, 2.1) : between(0.75, 1.25));
      // 1. Deliveries arriving today
      for (const x of due.get(off) ?? []) if (x.sim.po.centreId === c.id) deliver(x.sim, off, x.first);

      // 2. Ordering: monthly cycle from last month's request, fortnightly pantry, scripted situations
      if (d.getDate() === cycleDay(ci)) {
        const reqPeriod = period(new Date(d.getFullYear(), d.getMonth() - 1, 1));
        const rqId = `rq-${c.code}-${reqPeriod}`;
        const need = products.filter((p) => p.categoryId !== "cat-pan").map((p) => ({ p, qty: monthlyNeed(c.id, p, d) })).filter((x) => x.qty >= minLine(c.id, x.p));
        const items = need.map(({ p, qty }, j): RequestItem => ({
          id: `${rqId}-${j}`, requestId: rqId, productId: p.id, historicalAvgQty: historyAvg(c.id, p, d, start),
          proposedQty: Math.max(qty, Math.round(qty * between(1, 1.2))), approvedQty: qty, unitCost: p.unitCost,
        }));
        if (items.length) {
          requestItems.push(...items);
          requests.push({
            id: rqId, centreId: c.id, period: reqPeriod, status: "ordered", priority: "routine", source: rnd() < 0.15 ? "audio" : "form", submittedBy: leaderOf.get(c.id)!,
            submittedAt: day(offsetOf(new Date(d.getFullYear(), d.getMonth() - 1, int(20, 25))), int(9, 18)), total: sum(items, (i) => i.proposedQty * i.unitCost),
          });
          for (const [sid, its] of groupLines(items)) raise(c, sid, off, "monthly", its.map((i) => ({ productId: i.productId, qty: i.approvedQty!, requestItemId: i.id }))).requestId = rqId;
        }
      }
      if ((((-off - nominal.get("s-5")!.lead - pantryOffset(ci)) % 14) + 14) % 14 === 0) {
        const its = products.filter((p) => p.categoryId === "cat-pan")
          .map((p) => ({ productId: p.id, qty: Math.ceil(p.reorderPoint + 0.6 * planUse(c.id, p) * season(d) - get(stock, k(c.id, p.id)) - get(onOrder, k(c.id, p.id))) }))
          .filter((x) => x.qty >= 1);
        if (its.length) raise(c, "s-5", off, "pantry", its);
      }
      for (const s of scripts.filter((x) => x.centreId === c.id && x.off === off)) {
        const its = products.filter((p) => supplierOf(p) === s.supplierId)
          .sort((a, b) => get(stock, k(c.id, a.id)) / planUse(c.id, a) - get(stock, k(c.id, b.id)) / planUse(c.id, b)).slice(0, 3)
          .map((p) => ({ productId: p.id, qty: Math.max(1, Math.round(planUse(c.id, p) * 0.4), Math.ceil(p.reorderPoint + 0.5 * planUse(c.id, p) - get(stock, k(c.id, p.id)) - get(onOrder, k(c.id, p.id)))) }));
        lastTopup.set(k(c.id, s.supplierId), raise(c, s.supplierId, off, "scripted", its, s));
      }

      // 3. Consumption, issued to classrooms twice a week (Mon, Thu), never more than is on the shelf
      if (d.getDay() === 1 || d.getDay() === 4) {
        for (const p of products) {
          const key = k(c.id, p.id);
          const want = planUse(c.id, p) * season(d) * drift.get(`${key}:${per}`)! / 8.66 * between(0.7, 1.3);
          const q = Math.min(get(stock, key), Math.floor(want) + (rnd() < want % 1 ? 1 : 0));
          if (q <= 0) continue;
          add(stock, key, -q);
          add(used, `${key}:${per}`, q);
          move(c.id, p.id, "consumption", q, day(off, 17));
        }
        // 4. Essentials (hygiene, first aid, pantry) get an emergency top-up once stock plus what is on order is critical;
        //    classroom supplies wait for the next monthly cycle.
        for (const sid of ESSENTIALS) {
          const open = lastTopup.get(k(c.id, sid));
          if (open && (open.po.status === "awaiting_authorisation" || sum([...open.owed.values()], (n) => n) > 0)) continue;
          const its = products.filter((p) => supplierOf(p) === sid && get(stock, k(c.id, p.id)) + get(onOrder, k(c.id, p.id)) <= Math.floor(p.reorderPoint / 2))
            .map((p) => ({ productId: p.id, qty: Math.ceil(p.reorderPoint + 0.5 * planUse(c.id, p) * season(d) - get(stock, k(c.id, p.id)) - get(onOrder, k(c.id, p.id))) }))
            .filter((x) => x.qty >= 1).slice(0, 6);
          if (its.length) lastTopup.set(k(c.id, sid), raise(c, sid, off, "topup", its));
        }
      }

      // 5. Month-end count: small shrinkage write-offs
      if (off < 0 && date(off + 1).getDate() === 1) {
        for (const p of products) {
          if (rnd() >= 0.06) continue;
          const q = Math.min(get(stock, k(c.id, p.id)), int(1, 2));
          if (q > 0) { add(stock, k(c.id, p.id), -q); move(c.id, p.id, "adjustment", -q, day(off, 18), `count-${c.code}-${per}`); }
        }
      }
    }
  }

  // ---- PO status from what actually arrived ----
  for (const s of sims) {
    if (s.po.status === "draft" || s.po.status === "awaiting_authorisation") continue;
    const owed = sum([...s.owed.values()], (n) => n);
    s.po.status = !s.receipts.length ? "issued" : owed > 0 ? "partially_received" : "received";
  }
  const simOf = new Map(sims.map((s) => [s.po.id, s]));
  for (const r of requests) {
    const mine = sims.filter((s) => s.requestId === r.id);
    r.status = mine.every((s) => s.po.status === "received") ? "fulfilled" : "ordered";
  }

  // Supplier scorecards from actual deliveries: first delivery on or before the expected day; receipts without damage; PO → first receipt.
  for (const s of suppliers) {
    const done = sims.filter((x) => x.po.supplierId === s.id && x.receipts.length);
    if (!done.length) continue;
    const late = sims.filter((x) => x.po.supplierId === s.id && x.po.status === "issued" && x.expectedOff < 0).length;
    const firstOff = (x: Sim) => offsetOf(new Date(x.receipts[0]!.receivedAt));
    const rs = done.flatMap((x) => x.receipts);
    s.onTimeRate = Math.round(done.filter((x) => firstOff(x) <= x.expectedOff).length / (done.length + late) * 100) / 100;
    s.qualityScore = Math.round(rs.filter((r) => r.damagedQty === 0).length / rs.length * 100) / 100;
    s.avgLeadDays = Math.round(sum(done, (x) => firstOff(x) - x.createdOff) / done.length * 10) / 10;
  }

  // ---- Requests still in the pipeline ----
  const submittedOff = () => -Math.min(int(1, 6), today.getDate() - 1);
  const requestFrom = (c: Centre, id: string, per: string, status: MonthlyRequest["status"], extra: Partial<MonthlyRequest> = {}) => {
    const daysToCycle = Math.max(0, offsetOf(new Date(today.getFullYear(), today.getMonth() + (per === thisPeriod ? 1 : 0), cycleDay(centres.indexOf(c)))));
    const items = products.filter((p) => p.categoryId !== "cat-pan").flatMap((p, j): RequestItem[] => {
      const key = k(c.id, p.id);
      const projected = Math.max(0, get(stock, key) + get(onOrder, key) - planUse(c.id, p) * season(today) * daysToCycle / 30);
      const qty = monthlyNeed(c.id, p, date(daysToCycle), projected);
      if (qty < minLine(c.id, p)) return [];
      // Some centres over-ask; Head Office reviews against history.
      const proposedQty = Math.max(qty, Math.round(qty * between(1, 1.35)));
      return [{ id: `${id}-${j}`, requestId: id, productId: p.id, historicalAvgQty: historyAvg(c.id, p, today, start), proposedQty, unitCost: p.unitCost, ...(status === "approved" || status === "ordered" ? { approvedQty: proposedQty } : {}) }];
    });
    requestItems.push(...items);
    const r: MonthlyRequest = {
      id, centreId: c.id, period: per, status, priority: "routine", source: "form", submittedBy: leaderOf.get(c.id)!,
      ...(status === "draft" ? {} : { submittedAt: day(submittedOff(), int(9, 17)) }), total: sum(items, (i) => i.proposedQty * i.unitCost), ...extra,
    };
    requests.push(r);
    return { r, items };
  };
  // Last month's request is only turned into POs on the cycle day; before that it waits in the purchasing queue.
  for (const [ci, c] of centres.entries()) {
    if (today.getDate() >= cycleDay(ci)) continue;
    const per = period(monthsAgo(1));
    requestFrom(c, `rq-${c.code}-${per}`, per, "approved");
  }
  const CURRENT: MonthlyRequest["status"][] = [
    "submitted", "revision_requested", "submitted", "approved", "draft", "ordered", "submitted", "approved",
    "draft", "ordered", "submitted", "revision_requested", "approved", "submitted", "ordered",
  ];
  for (const [ci, c] of centres.entries()) {
    const { r, items } = requestFrom(c, `rq-${c.code}-${thisPeriod}`, thisPeriod, CURRENT[ci]!, ci === 2 ? { source: "audio" } : {});
    if (r.status !== "ordered") continue;
    // Purchasing has already drafted next month's orders for these.
    for (const [sid, its] of groupLines(items)) raise(c, sid, -int(0, 1), "next_month", its.map((i) => ({ productId: i.productId, qty: i.approvedQty!, requestItemId: i.id }))).requestId = r.id;
  }
  const emergency = (centreId: string, code: string, status: MonthlyRequest["status"], source: MonthlyRequest["source"], off: number, hour: number, lines: [string, number][]) => {
    const id = `rq-${code}-em1`;
    const items = lines.map(([productId, qty], j): RequestItem => ({ id: `${id}-${j}`, requestId: id, productId, proposedQty: qty, historicalAvgQty: 0, unitCost: pmap.get(productId)!.unitCost, ...(status === "approved" ? { approvedQty: qty } : {}) }));
    requestItems.push(...items);
    requests.push({ id, centreId, period: thisPeriod, status, priority: "emergency", source, submittedBy: leaderOf.get(centreId)!, submittedAt: day(off, hour), total: sum(items, (i) => i.proposedQty * i.unitCost) });
  };
  emergency("c-bnr", "BNR", "submitted", "video", 0, 9, [["p-10", 12], ["p-19", 4], ["p-21", 8]]);
  emergency("c-vmn", "VMN", "approved", "form", -2, 11, [["p-11", 8], ["p-13", 30]]);
  emergency("c-pms", "PMS", "submitted", "audio", -1, 15, [["p-12", 40], ["p-20", 6]]);

  // ---- Balances ----
  const lastMove = new Map<string, string>();
  for (const m of movements) lastMove.set(k(m.centreId, m.productId), m.occurredAt);
  const balances: StockBalance[] = centres.flatMap((c) => products.map((p) => ({ centreId: c.id, productId: p.id, onHand: get(stock, k(c.id, p.id)), updatedAt: lastMove.get(k(c.id, p.id))! })));

  // ---- Budgets: spend = good units received × PO price; commitments = value still owed on authorised (issued / part-received) POs ----
  const lineById = new Map(purchaseOrderLines.map((l) => [l.id, l]));
  const receiptById = new Map(receipts.map((r) => [r.id, r]));
  const spent = new Map<string, number>();
  for (const l of receiptLines) {
    const r = receiptById.get(l.receiptId)!;
    add(spent, `${r.centreId}:${period(new Date(r.receivedAt))}`, (l.receivedQty - l.damagedQty) * lineById.get(l.purchaseOrderLineId)!.unitPrice);
  }
  const committed = new Map<string, number>();
  for (const s of sims) if (s.po.status === "issued" || s.po.status === "partially_received")
    add(committed, s.po.centreId, sum(s.lines, (l) => s.owed.get(l.id)! * l.unitPrice));
  const budgets: Budget[] = centres.flatMap((c) => Array.from({ length: 12 }, (_, i) => {
    const per = period(monthsAgo(11 - i));
    return { centreId: c.id, period: per, allocated: c.monthlyBudget, committed: per === thisPeriod ? get(committed, c.id) : 0, spent: get(spent, `${c.id}:${per}`) };
  }));

  // ---- Invoices: three-way match of billed lines against PO lines and good units received ----
  const goodOf = new Map<string, number>();
  for (const l of receiptLines) add(goodOf, l.purchaseOrderLineId, l.receivedQty - l.damagedQty);
  const draftInvoices: { inv: Omit<Invoice, "id" | "number">; invOff: number; payOff?: number; payAmount?: number }[] = [];
  for (const s of sims) {
    if (s.po.status === "draft" || s.po.status === "awaiting_authorisation") continue;
    let invOff: number;
    if (s.receipts.length) invOff = offsetOf(new Date(s.receipts[0]!.receivedAt));
    else if (s.issuedOff <= -2 && rnd() < 0.3) invOff = s.issuedOff + 1; // billed on dispatch, goods not here yet
    else continue;
    const billed = s.lines.map((l) => ({ l, qty: Math.max(l.quantity, get(goodOf, l.id)), price: l.unitPrice }));
    const priceErr = rnd() < (s.po.supplierId === "s-5" ? 0.12 : s.po.supplierId === "s-2" ? 0.08 : 0.04);
    if (priceErr) { const b = pick(billed); b.price = rupees(b.price * between(1.03, 1.09)); }
    const qtyErr = rnd() < 0.04;
    if (qtyErr) pick(billed).qty += int(1, 3);
    const match: Invoice["match"] = !s.receipts.length ? "unmatched" : billed.some((b) => b.price !== b.l.unitPrice) ? "price_mismatch" : billed.some((b) => b.qty !== get(goodOf, b.l.id)) ? "quantity_mismatch" : "matched";
    const terms = s.po.supplierId === "s-5" ? 15 : 30;
    const amount = sum(billed, (b) => b.qty * b.price);
    const base = { supplierId: s.po.supplierId, purchaseOrderId: s.po.id, centreId: s.po.centreId, amount, dueAt: day(invOff + terms, 23), match };
    if (match === "matched") {
      const payOff = invOff + int(terms - 10, terms + 25);
      if (payOff < 0) draftInvoices.push({ inv: { ...base, status: "paid" }, invOff, payOff, payAmount: amount });
      else draftInvoices.push({ inv: { ...base, status: invOff >= -1 ? "received" : "approved" }, invOff });
    } else if (match === "unmatched" || (match === "quantity_mismatch" && s.po.status === "partially_received" && !qtyErr && !priceErr)) {
      draftInvoices.push({ inv: { ...base, status: "received" }, invOff }); // waiting for the goods before it can match
    } else {
      // Queried; settled at the agreed value (PO price, good units) once the supplier issues a credit note.
      const payOff = invOff + (rnd() < 0.5 ? int(7, 40) : int(45, 180));
      const agreed = sum(billed, (b) => Math.min(b.qty, get(goodOf, b.l.id)) * Math.min(b.price, b.l.unitPrice));
      if (payOff < 0) draftInvoices.push({ inv: { ...base, status: "paid" }, invOff, payOff, payAmount: agreed });
      else draftInvoices.push({ inv: { ...base, status: "query" }, invOff });
    }
  }
  draftInvoices.sort((a, b) => a.invOff - b.invOff);
  const invoices: Invoice[] = draftInvoices.map((x, i) => ({ id: `inv-${i + 1}`, number: `INV-${8800 + i}`, ...x.inv }));
  const payments: Payment[] = draftInvoices
    .map((x, i) => ({ x, inv: invoices[i]! }))
    .filter(({ x }) => x.payOff !== undefined)
    .map(({ x, inv }) => ({ invoiceId: inv.id, amount: x.payAmount!, paidAt: day(x.payOff!, int(11, 17)), method: pick(["neft", "neft", "neft", "upi", "cheque"] as const) }))
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    .map((p, i) => ({ id: `pay-${i + 1}`, ...p }));

  // ---- Counts, approvals, notifications, audit ----
  const counts: StockCount[] = centres.flatMap((c, i) => [
    { id: `sc-${c.id}-o`, centreId: c.id, period: thisPeriod, kind: "opening" as const, status: "submitted" as const, submittedAt: day(-today.getDate() + Math.min(2, today.getDate())) },
    { id: `sc-${c.id}-c`, centreId: c.id, period: thisPeriod, kind: "closing" as const, status: i % 3 === 0 ? ("in_progress" as const) : ("not_started" as const) },
  ]);

  const openReqs = requests.filter((r) => r.period >= period(monthsAgo(1)) && ["submitted", "revision_requested", "approved", "ordered"].includes(r.status));
  const recentAuthorised = sims.filter((s) => s.po.total > AUTH_THRESHOLD && s.issuedOff <= 0 && s.issuedOff >= -14 && s.po.status !== "draft" && s.po.status !== "awaiting_authorisation");
  const approvals: Approval[] = [
    ...openReqs.map((r, i): Approval => {
      const decided = r.status !== "submitted";
      return {
        id: `ap-r${i}`, subjectType: "monthly_request", subjectId: r.id, centreId: r.centreId, stage: "head_office",
        status: r.status === "submitted" ? "pending" : r.status === "revision_requested" ? "revision_requested" : "approved",
        amount: r.total, critical: r.priority === "emergency", requestedAt: r.submittedAt ?? day(-1),
        ...(decided ? { decidedBy: "u-ho", decidedAt: new Date(Math.min(now.getTime(), new Date(r.submittedAt ?? day(-1)).getTime() + 86_400_000)).toISOString() } : {}),
      };
    }),
    ...sims.filter((s) => s.po.status === "awaiting_authorisation").map((s, i): Approval => ({
      id: `ap-p${i}`, subjectType: "purchase_order", subjectId: s.po.id, centreId: s.po.centreId, stage: "final",
      status: "pending", amount: s.po.total, critical: s.po.total > 60_000_00, requestedAt: s.po.createdAt,
    })),
    ...recentAuthorised.map((s, i): Approval => ({
      id: `ap-pa${i}`, subjectType: "purchase_order", subjectId: s.po.id, centreId: s.po.centreId, stage: "final", status: "approved",
      amount: s.po.total, critical: s.po.total > 60_000_00, requestedAt: s.po.createdAt, decidedBy: s.po.total > 60_000_00 ? "u-ceo" : "u-ho", decidedAt: day(s.issuedOff, 9),
    })),
    ...quotations.filter((q) => q.status === "received").slice(0, 5).map((q, i): Approval => ({
      id: `ap-q${i}`, subjectType: "supplier_price", subjectId: q.id, stage: "head_office", status: "pending", amount: q.unitPrice, critical: false, requestedAt: day(-i, 12),
    })),
  ];

  const centreName = new Map(centres.map((c) => [c.id, c.name]));
  const supplierName = (id: string) => smap.get(id)?.name ?? id;
  const issued = sims.filter((s) => s.po.status === "issued");
  const rcvToday = issued.filter((s) => s.expectedOff === 0 && (s.po.centreId === "c-bnr" || s.po.centreId === "c-wkd"));
  const rcvOverdue = issued.filter((s) => s.expectedOff < 0 && (s.po.centreId === "c-bnr" || s.po.centreId === "c-wkd"));
  const awaiting = sims.filter((s) => s.po.status === "awaiting_authorisation");
  const queries = invoices.filter((i) => i.status === "query");
  const andCritical = products.filter((p) => get(stock, k("c-bnr", p.id)) <= Math.floor(p.reorderPoint / 2));
  const overBudget = centres.filter((c) => { const b = budgets.find((x) => x.centreId === c.id && x.period === thisPeriod)!; return b.spent + b.committed > b.allocated; });
  const readyToOrder = requests.filter((r) => r.status === "approved");
  const allUsers = users.map((u) => u.id);
  const notifications: Notification[] = [
    { id: "n1", userId: "*", title: "Emergency request from Baner", body: "Hand wash and first-aid refills — video request awaiting review.", href: "/dashboards/head-office", createdAt: day(0, 9), read: false, readBy: [], severity: "critical" },
    { id: "n2", userId: "*", title: "Closing count due", body: "Monthly closing stock counts are due on the last working day.", createdAt: day(-1, 16), read: false, readBy: [], severity: "warning" },
    ...(awaiting[0] ? [{ id: "n3", userId: "*", title: `${awaiting[0].po.number} awaiting authorisation`, body: `${awaiting.length} purchase order${awaiting.length === 1 ? "" : "s"} need final authorisation before they can be issued.`, href: "/dashboards/head-office", createdAt: awaiting[0].po.createdAt, read: false, readBy: allUsers, severity: "info" as const }] : []),
    ...(rcvToday.length ? [{ id: "n4", userId: "u-rcv", title: `${rcvToday.length} deliver${rcvToday.length === 1 ? "y" : "ies"} expected today`, body: rcvToday.map((s) => `${s.po.number} · ${supplierName(s.po.supplierId)}`).join(", "), href: "/dashboards/receiving", createdAt: day(0, 7), read: false, readBy: [], severity: "info" as const }] : []),
    ...(rcvOverdue.length ? [{ id: "n5", userId: "u-rcv", title: `${rcvOverdue[0]!.po.number} is overdue`, body: `${supplierName(rcvOverdue[0]!.po.supplierId)} has not delivered to ${centreName.get(rcvOverdue[0]!.po.centreId)}.`, href: "/dashboards/receiving", createdAt: day(-1, 18), read: false, readBy: [], severity: "warning" as const }] : []),
    ...(queries.length ? [{ id: "n6", userId: "u-fin", title: `${queries.length} invoice${queries.length === 1 ? "" : "s"} on query`, body: "Price or quantity differs from the PO and goods receipt.", href: "/dashboards/finance", createdAt: day(-1, 10), read: false, readBy: [], severity: "warning" as const }] : []),
    ...(andCritical.length ? [{ id: "n7", userId: "u-cl", title: `${andCritical.length} item${andCritical.length === 1 ? "" : "s"} at critical stock`, body: andCritical.slice(0, 3).map((p) => p.name).join(", "), href: "/dashboards/centre", createdAt: day(0, 8), read: false, readBy: [], severity: "critical" as const }] : []),
    ...(overBudget.length ? [{ id: "n8", userId: "u-ho", title: `${overBudget.length} centre${overBudget.length === 1 ? "" : "s"} over budget`, body: overBudget.slice(0, 3).map((c) => c.name).join(", "), href: "/dashboards/head-office", createdAt: day(-1, 9), read: false, readBy: [], severity: "warning" as const }] : []),
    ...(readyToOrder.length ? [{ id: "n9", userId: "u-po", title: `${readyToOrder.length} approved request${readyToOrder.length === 1 ? "" : "s"} ready to order`, body: "Approved by Head Office with no purchase order yet.", href: "/dashboards/purchasing", createdAt: day(-1, 12), read: false, readBy: ["u-po"], severity: "info" as const }] : []),
  ];

  const windowOff = -14;
  const recent = (iso?: string) => !!iso && offsetOf(new Date(iso)) >= windowOff;
  const events: Omit<AuditEvent, "id">[] = [
    ...receipts.filter((r) => recent(r.receivedAt)).map((r) => {
      const notes = [r.orderedQty > r.receivedQty && `${r.orderedQty - r.receivedQty} short`, r.receivedQty > r.orderedQty && `${r.receivedQty - r.orderedQty} over`, r.damagedQty && `${r.damagedQty} damaged`].filter(Boolean).join(", ");
      return { actorId: r.receivedBy, action: "recorded receipt", subject: `GR for ${simOf.get(r.purchaseOrderId)!.po.number}${notes ? ` · ${notes}` : ""}`, centreId: r.centreId, occurredAt: r.receivedAt };
    }),
    ...sims.filter((s) => recent(s.po.createdAt)).map((s) => ({
      actorId: s.po.raisedBy, action: s.po.status === "draft" ? "drafted" : s.po.status === "awaiting_authorisation" ? "raised for authorisation" : "issued",
      subject: `${s.po.number} · ${supplierName(s.po.supplierId)}`, centreId: s.po.centreId, occurredAt: s.po.createdAt,
    })),
    ...requests.filter((r) => r.priority === "emergency" || (r.period === thisPeriod && r.submittedAt)).filter((r) => recent(r.submittedAt)).map((r) => ({
      actorId: r.submittedBy, action: "submitted", subject: `${r.priority === "emergency" ? "Emergency request" : "Monthly request"} · ${centreName.get(r.centreId)}`, centreId: r.centreId, occurredAt: r.submittedAt!,
    })),
    ...approvals.filter((a) => a.subjectType === "monthly_request" && a.decidedAt && recent(a.decidedAt)).map((a) => ({
      actorId: a.decidedBy!, action: a.status === "approved" ? "approved" : "returned for revision", subject: `Monthly request · ${centreName.get(a.centreId!)}`, centreId: a.centreId, occurredAt: a.decidedAt!,
    })),
    ...draftInvoices.map((x, i) => ({ x, inv: invoices[i]! })).filter(({ inv, x }) => inv.status === "query" && x.invOff + 1 >= windowOff && x.invOff + 1 <= 0).map(({ inv, x }) => ({
      actorId: "u-fin", action: "raised query", subject: `${inv.number} · ${inv.match === "price_mismatch" ? "price mismatch" : "quantity mismatch"}`, centreId: inv.centreId, occurredAt: day(x.invOff + 1, 11),
    })),
    ...payments.filter((p) => recent(p.paidAt)).map((p) => {
      const inv = invoices.find((i) => i.id === p.invoiceId)!;
      return { actorId: "u-fin", action: "recorded payment", subject: `${inv.number} · ${supplierName(inv.supplierId)}`, centreId: inv.centreId, occurredAt: p.paidAt };
    }),
    { actorId: "u-adm", action: "changed role", subject: "Rohan Desai → Centre Leader", occurredAt: day(-3, 12) },
    { actorId: "u-adm", action: "invited user", subject: "Aditi Deshpande · Kharadi", occurredAt: day(-11, 15) },
    { actorId: "u-adm", action: "suspended user", subject: "Former Staff · Viman Nagar", occurredAt: day(-13, 10) },
  ];
  const audit: AuditEvent[] = events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map((e, i) => ({ id: `ae-${i + 1}`, ...e }));

  const aiJobs: AIProcessingJob[] = [
    { id: "ai-1", kind: "video_request", centreId: "c-bnr", status: "needs_review", createdAt: day(0, 9) },
    { id: "ai-2", kind: "audio_request", centreId: "c-kor", status: "completed", createdAt: day(submittedOff(), 11) },
    { id: "ai-3", kind: "audio_request", centreId: "c-pms", status: "processing", createdAt: day(-1, 15) },
    ...invoices.slice(-4).map((inv, i): AIProcessingJob => ({ id: `ai-${4 + i}`, kind: "invoice_ocr", centreId: inv.centreId, status: i === 0 ? "failed" : "completed", createdAt: day(Math.min(0, draftInvoices.at(-4 + i)!.invOff), 16) })),
    { id: "ai-8", kind: "insight", status: "queued", createdAt: day(0, 6) },
  ];

  // Integrations are honestly "not configured" — nothing external is wired in Phase 1.
  const integrations: Integration[] = [
    { id: "int-db", name: "Production database", status: "not_configured" },
    { id: "int-mail", name: "Email notifications", status: "not_configured" },
    { id: "int-ai", name: "AI request transcription", status: "not_configured" },
    { id: "int-acc", name: "Accounting export", status: "not_configured" },
  ];

  return {
    today, centres, users, categories, uoms, products, balances, movements, counts, requests, requestItems, approvals,
    suppliers, quotations, purchaseOrders, purchaseOrderLines, receipts, receiptLines, invoices, payments, budgets, notifications, audit, aiJobs, integrations,
  };
}
