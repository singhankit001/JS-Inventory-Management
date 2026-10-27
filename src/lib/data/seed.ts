// DEVELOPMENT SEED DATA — fictional records for demo mode only. Never presented as live business data:
// the shell shows a "Demo data" badge whenever this provider is active.
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

export function buildSeed(now = new Date()): SeedData {
  const rnd = mulberry32(20261027);
  const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (offset: number, hour = 10) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    d.setHours(hour, int(0, 59));
    return d.toISOString();
  };
  const monthsAgo = (n: number) => new Date(today.getFullYear(), today.getMonth() - n, 1);

  const centres: Centre[] = [
    { id: "c-and", code: "AND", name: "Andheri West", city: "Mumbai", status: "active", monthlyBudget: 420_000_00 },
    { id: "c-pow", code: "POW", name: "Powai Lakeside", city: "Mumbai", status: "active", monthlyBudget: 360_000_00 },
    { id: "c-kor", code: "KOR", name: "Koramangala", city: "Bengaluru", status: "active", monthlyBudget: 390_000_00 },
    { id: "c-whf", code: "WHF", name: "Whitefield", city: "Bengaluru", status: "active", monthlyBudget: 310_000_00 },
    { id: "c-ban", code: "BAN", name: "Banjara Hills", city: "Hyderabad", status: "active", monthlyBudget: 340_000_00 },
  ];

  const users: User[] = [
    { id: "u-ceo", name: "Aarav Kapoor", email: "ceo@demo.jumpstart.local", roles: ["ceo"], centreIds: [], status: "active", lastActiveAt: day(0, 9) },
    { id: "u-ho", name: "Meera Iyer", email: "headoffice@demo.jumpstart.local", roles: ["head_office", "finance"], centreIds: [], status: "active", lastActiveAt: day(0, 9) },
    { id: "u-cl", name: "Kavya Nair", email: "andheri@demo.jumpstart.local", roles: ["centre_leader"], centreIds: ["c-and"], status: "active", lastActiveAt: day(0, 8) },
    { id: "u-cl2", name: "Rohan Desai", email: "koramangala@demo.jumpstart.local", roles: ["centre_leader"], centreIds: ["c-kor"], status: "active", lastActiveAt: day(-1, 17) },
    { id: "u-po", name: "Vikram Shah", email: "purchasing@demo.jumpstart.local", roles: ["purchasing"], centreIds: [], status: "active", lastActiveAt: day(0, 10) },
    { id: "u-fin", name: "Anjali Rao", email: "finance@demo.jumpstart.local", roles: ["finance"], centreIds: [], status: "active", lastActiveAt: day(0, 11) },
    { id: "u-rcv", name: "Suresh Pillai", email: "receiving@demo.jumpstart.local", roles: ["receiving"], centreIds: ["c-and", "c-pow"], status: "active", lastActiveAt: day(0, 7) },
    { id: "u-adm", name: "Neha Joshi", email: "admin@demo.jumpstart.local", roles: ["admin"], centreIds: [], status: "active", lastActiveAt: day(0, 12) },
    { id: "u-old", name: "Former Staff", email: "former@demo.jumpstart.local", roles: ["receiving"], centreIds: ["c-ban"], status: "suspended", lastActiveAt: day(-60) },
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

  const balances: StockBalance[] = centres.flatMap((c) =>
    products.map((p) => {
      const r = rnd();
      // ~10% critical (below half reorder), ~15% low, rest healthy.
      const onHand = r < 0.1 ? int(0, Math.floor(p.reorderPoint / 2)) : r < 0.25 ? int(Math.ceil(p.reorderPoint / 2), p.reorderPoint) : int(p.reorderPoint + 1, p.reorderPoint * 4);
      return { centreId: c.id, productId: p.id, onHand, updatedAt: day(-int(0, 3)) };
    }),
  );

  const movements: StockMovement[] = [];
  for (let m = 11; m >= 0; m--) {
    const base = monthsAgo(m);
    for (const c of centres) {
      for (const p of products) {
        if (rnd() < 0.55) continue;
        const d = new Date(base);
        d.setDate(int(1, m === 0 ? Math.max(1, today.getDate()) : 28));
        // Seasonal swing: June (new academic year) and festive months consume more.
        const season = [0.9, 0.85, 0.95, 1, 0.8, 1.35, 1.15, 1.05, 1, 1.2, 1.1, 0.9][d.getMonth()]!;
        movements.push({
          id: `mv-${movements.length + 1}`, centreId: c.id, productId: p.id, type: "consumption",
          quantity: Math.round(int(2, p.reorderPoint) * season), occurredAt: d.toISOString(),
        });
      }
    }
  }

  const thisPeriod = period(today);
  const counts: StockCount[] = centres.flatMap((c, i) => [
    { id: `sc-${c.id}-o`, centreId: c.id, period: thisPeriod, kind: "opening" as const, status: "submitted" as const, submittedAt: day(-today.getDate() + 2) },
    { id: `sc-${c.id}-c`, centreId: c.id, period: thisPeriod, kind: "closing" as const, status: i % 3 === 0 ? ("in_progress" as const) : ("not_started" as const) },
  ]);

  const requestStatuses: MonthlyRequest["status"][] = ["submitted", "revision_requested", "submitted", "approved", "draft"];
  const requests: MonthlyRequest[] = [];
  const requestItems: RequestItem[] = [];
  centres.forEach((c, i) => {
    const id = `rq-${c.code}-${thisPeriod}`;
    const items = products.filter(() => rnd() < 0.45).map((p, j) => {
      const hist = int(Math.ceil(p.reorderPoint / 2), p.reorderPoint * 2);
      return { id: `${id}-${j}`, requestId: id, productId: p.id, historicalAvgQty: hist, proposedQty: Math.max(1, Math.round(hist * (0.8 + rnd() * 0.7))), unitCost: p.unitCost };
    });
    requestItems.push(...items);
    requests.push({
      id, centreId: c.id, period: thisPeriod, status: requestStatuses[i]!, priority: "routine", source: i === 2 ? "audio" : "form",
      submittedBy: c.id === "c-and" ? "u-cl" : c.id === "c-kor" ? "u-cl2" : "u-cl", submittedAt: requestStatuses[i] === "draft" ? undefined : day(-int(1, 6)),
      total: items.reduce((s, it) => s + it.proposedQty * it.unitCost, 0),
    });
  });
  requests.push(
    { id: "rq-AND-em1", centreId: "c-and", period: thisPeriod, status: "submitted", priority: "emergency", source: "video", submittedBy: "u-cl", submittedAt: day(0, 9), total: 18_600_00 },
    { id: "rq-BAN-em1", centreId: "c-ban", period: thisPeriod, status: "approved", priority: "emergency", source: "form", submittedBy: "u-cl", submittedAt: day(-2), total: 9_450_00 },
  );

  const suppliers: Supplier[] = [
    { id: "s-1", name: "Crayonworks Educational Supplies", categoryIds: ["cat-art", "cat-sta"], status: "approved", onTimeRate: 0.94, qualityScore: 0.92, avgLeadDays: 4 },
    { id: "s-2", name: "CleanNest Hygiene Pvt", categoryIds: ["cat-hyg"], status: "approved", onTimeRate: 0.81, qualityScore: 0.88, avgLeadDays: 6 },
    { id: "s-3", name: "Little Learners Toys", categoryIds: ["cat-toy"], status: "approved", onTimeRate: 0.89, qualityScore: 0.95, avgLeadDays: 8 },
    { id: "s-4", name: "MediSafe Distributors", categoryIds: ["cat-aid"], status: "approved", onTimeRate: 0.97, qualityScore: 0.9, avgLeadDays: 3 },
    { id: "s-5", name: "FreshPantry Foods", categoryIds: ["cat-pan"], status: "approved", onTimeRate: 0.72, qualityScore: 0.84, avgLeadDays: 2 },
    { id: "s-6", name: "Paper Trail Stationers", categoryIds: ["cat-sta", "cat-art"], status: "pending", onTimeRate: 0.86, qualityScore: 0.8, avgLeadDays: 5 },
  ];

  const quotations: SupplierQuotation[] = products.slice(0, 10).flatMap((p, i) =>
    suppliers.filter((s) => s.categoryIds.includes(p.categoryId)).map((s, j) => ({
      id: `q-${i}-${j}`, supplierId: s.id, productId: p.id, unitPrice: Math.round(p.unitCost * (0.88 + rnd() * 0.25)),
      validUntil: day(int(5, 25)), status: pick(["requested", "received", "received", "accepted"] as const),
    })),
  );

  const poStatuses: PurchaseOrder["status"][] = ["issued", "issued", "awaiting_authorisation", "partially_received", "received", "received", "issued", "awaiting_authorisation", "received", "issued", "received", "issued"];
  const purchaseOrders: PurchaseOrder[] = poStatuses.map((status, i) => {
    const s = suppliers[i % 5]!;
    const created = -int(2, 20);
    return {
      id: `po-${i + 1}`, number: `PO-${2400 + i}`, supplierId: s.id, centreId: centres[i % centres.length]!.id, status,
      total: int(8_000, 95_000) * 100, createdAt: day(created),
      // Some issued orders are overdue (expected in the past) so "delayed" is meaningful.
      expectedAt: status === "issued" && i % 3 === 0 ? day(-int(1, 4)) : status.startsWith("received") ? day(created + s.avgLeadDays) : day(i % 4 === 0 ? 0 : int(1, 7), 9 + (i % 6)),
      priceVariance: int(-3_000, 6_000) * 100,
    };
  });

  const receipts: GoodsReceipt[] = purchaseOrders.filter((po) => po.status === "received" || po.status === "partially_received").map((po, i) => {
    const ordered = int(40, 160);
    const short = i % 3 === 1 ? int(2, 10) : 0;
    const damaged = i % 4 === 2 ? int(1, 5) : 0;
    return {
      id: `gr-${i + 1}`, purchaseOrderId: po.id, centreId: po.centreId, receivedAt: day(-i), receivedBy: "u-rcv",
      status: po.status === "partially_received" ? "pending_confirmation" : short || damaged ? "discrepancy" : "confirmed",
      orderedQty: ordered, receivedQty: ordered - short, damagedQty: damaged,
    };
  });

  const invoices: Invoice[] = purchaseOrders.filter((po) => po.status !== "awaiting_authorisation").map((po, i) => ({
    id: `inv-${i + 1}`, number: `INV-${8800 + i}`, supplierId: po.supplierId, purchaseOrderId: po.id, centreId: po.centreId,
    amount: po.total + (i % 4 === 1 ? po.priceVariance : 0), dueAt: day(int(-3, 20)),
    status: pick(["received", "received", "approved", "approved", "query", "paid"] as const),
    match: i % 4 === 1 ? "price_mismatch" : i % 5 === 3 ? "quantity_mismatch" : i % 7 === 6 ? "unmatched" : "matched",
  }));

  const payments: Payment[] = [];
  for (let m = 5; m >= 0; m--) {
    for (let k = 0; k < 4; k++) {
      const d = monthsAgo(m);
      d.setDate(int(3, 26));
      if (d > today) continue;
      payments.push({ id: `pay-${payments.length + 1}`, invoiceId: invoices[(payments.length) % invoices.length]!.id, amount: int(20_000, 140_000) * 100, paidAt: d.toISOString(), method: pick(["neft", "neft", "upi", "cheque"] as const) });
    }
  }

  const budgets: Budget[] = centres.flatMap((c) =>
    [5, 4, 3, 2, 1, 0].map((m) => {
      const spentRatio = m === 0 ? 0.35 + rnd() * 0.45 : 0.78 + rnd() * 0.3;
      return { centreId: c.id, period: period(monthsAgo(m)), allocated: c.monthlyBudget, committed: Math.round(c.monthlyBudget * (m === 0 ? 0.2 : 0)), spent: Math.round(c.monthlyBudget * spentRatio) };
    }),
  );

  const approvals: Approval[] = [
    ...requests.filter((r) => r.status === "submitted").map((r, i) => ({
      id: `ap-r${i}`, subjectType: "monthly_request" as const, subjectId: r.id, centreId: r.centreId, stage: "head_office" as const,
      status: "pending" as const, amount: r.total, critical: r.priority === "emergency", requestedAt: r.submittedAt ?? day(-1),
    })),
    ...purchaseOrders.filter((p) => p.status === "awaiting_authorisation").map((p, i) => ({
      id: `ap-p${i}`, subjectType: "purchase_order" as const, subjectId: p.id, centreId: p.centreId, stage: "final" as const,
      status: "pending" as const, amount: p.total, critical: p.total > 60_000_00, requestedAt: p.createdAt,
    })),
    ...quotations.filter((q) => q.status === "received").slice(0, 4).map((q, i) => ({
      id: `ap-q${i}`, subjectType: "supplier_price" as const, subjectId: q.id, stage: "head_office" as const,
      status: "pending" as const, amount: q.unitPrice, critical: false, requestedAt: day(-i),
    })),
  ];

  const notifications: Notification[] = [
    { id: "n1", userId: "*", title: "Emergency request from Andheri West", body: "Hand wash and first-aid refills — video request awaiting review.", href: "/dashboards/head-office", createdAt: day(0, 9), read: false, readBy: [], severity: "critical" },
    { id: "n2", userId: "*", title: "Closing count due", body: "Monthly closing stock counts are due on the last working day.", createdAt: day(-1, 16), read: false, readBy: [], severity: "warning" },
    { id: "n3", userId: "*", title: "PO-2402 awaiting authorisation", body: "Final authorisation needed before it can be issued.", createdAt: day(-1, 11), read: false, readBy: users.map((u) => u.id), severity: "info" },
  ];

  const actions: [string, string, string][] = [
    ["u-cl", "submitted", "Monthly request · Andheri West"],
    ["u-ho", "returned for revision", "Monthly request · Powai Lakeside"],
    ["u-po", "issued", "PO-2400 · Crayonworks"],
    ["u-rcv", "recorded receipt", "GR for PO-2404 · 3 damaged"],
    ["u-fin", "approved invoice", "INV-8805 · MediSafe"],
    ["u-adm", "changed role", "Rohan Desai → Centre Leader"],
    ["u-ho", "approved", "Monthly request · Banjara Hills"],
    ["u-po", "requested quotation", "Building blocks (100) · 2 suppliers"],
    ["u-fin", "raised query", "INV-8801 · price mismatch"],
    ["u-rcv", "reported shortage", "PO-2406 · 6 units short"],
  ];
  const audit: AuditEvent[] = actions.map(([actorId, action, subject], i) => ({
    id: `ae-${i}`, actorId, action, subject, centreId: subject.includes("Andheri") ? "c-and" : undefined, occurredAt: day(-Math.floor(i / 3), 17 - i),
  }));

  const aiJobs: AIProcessingJob[] = [
    { id: "ai-1", kind: "video_request", centreId: "c-and", status: "needs_review", createdAt: day(0, 9) },
    { id: "ai-2", kind: "audio_request", centreId: "c-kor", status: "completed", createdAt: day(-3) },
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
    suppliers, quotations, purchaseOrders, purchaseOrderLines: [], receipts, receiptLines: [], invoices, payments, budgets, notifications, audit, aiJobs, integrations,
  };
}
