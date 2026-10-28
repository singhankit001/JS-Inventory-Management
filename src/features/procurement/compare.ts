import type { Product, Supplier, SupplierQuotation } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { dayOffset, indexBy } from "@/features/dashboards/shared";
import { QUOTE_STATUS, SUPPLIER_STATUS, supplierHref } from "./shared";
import { count, money, moneyCompact, percent, shortDate } from "@/lib/format";

export interface Cell { text: string; sub?: string; tone?: Tone }
export interface Matrix { suppliers: { id: string; name: string; href: string; best: boolean; current: boolean }[]; rows: { label: string; cells: Cell[] }[] }

const RANK: Record<SupplierQuotation["status"], number> = { accepted: 0, received: 1, requested: 2, declined: 3 };

/** A supplier's live quote for a product: usable (accepted/received and still valid) price, or why not. */
export function liveQuote(quotes: SupplierQuotation[], supplierId: string, productId: string, today: Date) {
  const q = quotes.filter((x) => x.supplierId === supplierId && x.productId === productId).sort((a, b) => RANK[a.status] - RANK[b.status])[0];
  const expired = !!q && dayOffset(q.validUntil, today) < 0;
  const usable = !!q && (q.status === "accepted" || q.status === "received") && !expired;
  return { quote: q, expired, price: usable ? q.unitPrice : undefined };
}

/** Lowest usable price, the current (accepted) price, and the saving per unit and on last-12-month volume. */
export function bestValue(prices: { supplierId: string; price?: number; current: boolean }[], volume: number) {
  const usable = prices.filter((p) => p.price !== undefined) as { supplierId: string; price: number; current: boolean }[];
  const best = [...usable].sort((a, b) => a.price - b.price)[0];
  const current = usable.find((p) => p.current);
  const perUnit = best && current ? current.price - best.price : 0;
  return { best: best?.supplierId, bestPrice: best?.price, currentPrice: current?.price, perUnit, ratio: current?.price ? perUnit / current.price : 0, annual: perUnit * volume };
}

const scoreCells = (ss: Supplier[]) => [
  { label: "Lead time", cells: ss.map((s) => ({ text: `${s.avgLeadDays} days` })) },
  { label: "On time", cells: ss.map((s) => ({ text: percent(s.onTimeRate) })) },
  { label: "Quality", cells: ss.map((s) => ({ text: percent(s.qualityScore), sub: "clean receipts" })) },
  { label: "Supplier status", cells: ss.map((s) => ({ text: SUPPLIER_STATUS[s.status].label, tone: SUPPLIER_STATUS[s.status].tone })) },
];

export async function loadCompare(repo: Repository, opts: { product?: string; category?: string }) {
  const today = repo.today();
  const [products, categories, suppliers, quotes, pos, lines] = await Promise.all([repo.products(), repo.categories(), repo.suppliers(), repo.quotations(), repo.purchaseOrders(), repo.purchaseOrderLines()]);
  const catmap = indexBy(categories, "id");
  const active = products.filter((p) => p.status === "active");
  const recentPo = new Set(pos.filter((p) => p.status !== "cancelled" && dayOffset(p.createdAt, today) >= -365).map((p) => p.id));
  const volume = (productId: string) => lines.filter((l) => l.productId === productId && recentPo.has(l.purchaseOrderId)).reduce((s, l) => s + l.quantity, 0);
  const carriers = (categoryId: string) => suppliers.filter((s) => s.categoryIds.includes(categoryId)).sort((a, b) => a.name.localeCompare(b.name));
  const head = (ss: Supplier[], best?: string, current?: (s: Supplier) => boolean) => ss.map((s) => ({ id: s.id, name: s.name, href: supplierHref(s.id), best: s.id === best, current: !!current?.(s) }));

  const category = !opts.product && opts.category ? categories.find((c) => c.id === opts.category) : undefined;
  // Default view: the product with the most competing quotes.
  const product: Product | undefined = category ? undefined : active.find((p) => p.id === opts.product)
    ?? [...active].sort((a, b) => carriers(b.categoryId).length - carriers(a.categoryId).length)[0];

  let view: { kind: "product" | "category"; title: string; sub: string; matrix: Matrix; saving?: { perUnit: string; ratio: string; annual: string; volume: string; positive: boolean } };
  if (product) {
    const ss = carriers(product.categoryId);
    const live = ss.map((s) => ({ s, ...liveQuote(quotes, s.id, product.id, today) }));
    const vol = volume(product.id);
    const bv = bestValue(live.map((x) => ({ supplierId: x.s.id, price: x.price, current: x.quote?.status === "accepted" })), vol);
    view = {
      kind: "product", title: product.name, sub: `${catmap.get(product.categoryId)?.name ?? ""} · list price ${money(product.unitCost)} · ${count(vol)} units ordered in 12 months`,
      matrix: {
        suppliers: head(ss, bv.best, (s) => live.find((x) => x.s.id === s.id)?.quote?.status === "accepted"),
        rows: [
          { label: "Unit price", cells: live.map((x) => (x.price !== undefined ? { text: money(x.price), sub: x.price === bv.bestPrice ? "Lowest" : bv.bestPrice ? `+${percent(x.price / bv.bestPrice - 1)}` : undefined } : { text: "—", sub: x.quote ? (x.expired ? "Quote expired" : QUOTE_STATUS[x.quote.status].label) : "Not quoted" })) },
          { label: "vs list price", cells: live.map((x) => ({ text: x.price !== undefined ? `${x.price <= product.unitCost ? "−" : "+"}${percent(Math.abs(x.price / product.unitCost - 1))}` : "—" })) },
          { label: "Quote", cells: live.map((x) => (x.quote ? { text: QUOTE_STATUS[x.quote.status].label, tone: QUOTE_STATUS[x.quote.status].tone } : { text: "None" })) },
          { label: "Valid until", cells: live.map((x) => ({ text: x.quote && x.quote.status !== "declined" ? shortDate(x.quote.validUntil) : "—", sub: x.expired ? "Expired" : undefined, tone: x.expired ? "red" as const : undefined })) },
          ...scoreCells(ss),
        ],
      },
      saving: bv.currentPrice !== undefined && bv.best ? {
        perUnit: money(Math.abs(bv.perUnit)), ratio: percent(Math.abs(bv.ratio)), annual: moneyCompact(Math.abs(bv.annual)), volume: count(vol), positive: bv.perUnit > 0,
      } : undefined,
    };
  } else {
    const cat = category!;
    const ss = carriers(cat.id);
    const items = active.filter((p) => p.categoryId === cat.id);
    const perSupplier = ss.map((s) => {
      const priced = items.map((p) => ({ p, price: liveQuote(quotes, s.id, p.id, today).price })).filter((x) => x.price !== undefined) as { p: Product; price: number }[];
      return { s, priced, index: priced.length ? priced.reduce((t, x) => t + x.price / x.p.unitCost, 0) / priced.length : undefined };
    });
    const cheapest = new Map<string, number>();
    for (const p of items) {
      const best = perSupplier.map((x) => ({ id: x.s.id, price: x.priced.find((y) => y.p.id === p.id)?.price })).filter((x) => x.price !== undefined).sort((a, b) => a.price! - b.price!)[0];
      if (best) cheapest.set(best.id, (cheapest.get(best.id) ?? 0) + 1);
    }
    const best = [...cheapest].sort((a, b) => b[1] - a[1])[0]?.[0];
    view = {
      kind: "category", title: cat.name, sub: `${items.length} active products · ${ss.length} suppliers`,
      matrix: {
        suppliers: head(ss, best, (s) => quotes.some((q) => q.supplierId === s.id && q.status === "accepted" && items.some((p) => p.id === q.productId))),
        rows: [
          { label: "Products priced", cells: perSupplier.map((x) => ({ text: `${x.priced.length} of ${items.length}` })) },
          { label: "Cheapest on", cells: perSupplier.map((x) => ({ text: `${cheapest.get(x.s.id) ?? 0} products` })) },
          { label: "Price vs list", cells: perSupplier.map((x) => ({ text: x.index === undefined ? "—" : `${x.index <= 1 ? "−" : "+"}${percent(Math.abs(x.index - 1))}`, sub: "average" })) },
          ...scoreCells(ss),
        ],
      },
    };
  }

  // Request quotation: suppliers that carry the product's category, are not blocked and have no open request for it.
  const eligible: Record<string, { id: string; name: string }[]> = {};
  for (const p of active) eligible[p.id] = carriers(p.categoryId).filter((s) => s.status !== "blocked" && !quotes.some((q) => q.supplierId === s.id && q.productId === p.id && q.status === "requested")).map((s) => ({ id: s.id, name: s.name }));

  return {
    view, productId: product?.id,
    products: active.map((p) => ({ id: p.id, label: p.name, hint: p.sku })),
    categories: categories.map((c) => ({ id: c.id, label: c.name })),
    eligible,
  };
}

export type CompareData = Awaited<ReturnType<typeof loadCompare>>;
