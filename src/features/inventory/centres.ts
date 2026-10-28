import type { Repository } from "@/lib/data/provider";
import type { Centre } from "@/domain/types";
import type { HeatCell } from "@/components/dashboard/inventory";
import type { Tone } from "@/components/ui/badge";
import type { Row } from "@/components/data/data-table";
import { CENTRE_TONES, indexBy, stockState, valuation } from "@/features/dashboards/shared";
import { count, money, moneyCompact, relative, shortDate } from "@/lib/format";
import { period } from "@/lib/data/seed";
import { consumedSince, coverLabel, daysOfCover, MOVEMENT_TYPE, signedQty, STATE_BADGE, stockKey } from "./stock";

export interface CentreCard {
  id: string; code: string; name: string; city: string; tone: Tone; cells: HeatCell[];
  stockValue: string; units: string; skus: number;
  mostValue: { id: string; title: string; sub: string; value: string; href: string }[];
}

/** Tone follows the centre's position in the full network list, so a centre keeps its colour on every page. */
const toneOf = (all: Centre[], id: string) => CENTRE_TONES[Math.max(0, all.findIndex((c) => c.id === id)) % CENTRE_TONES.length]!;

export async function loadCentreCards(repo: Repository) {
  const [centres, products, categories, balances] = await Promise.all([repo.centres(), repo.products(), repo.categories(), repo.balances()]);
  const pmap = indexBy(products, "id");
  const cards: CentreCard[] = centres.map((c) => {
    const rows = balances.filter((b) => b.centreId === c.id);
    return {
      id: c.id, code: c.code, name: c.name, city: c.city, tone: toneOf(centres, c.id),
      cells: rows.map((b) => { const p = pmap.get(b.productId)!; return { productId: p.id, name: p.name, categoryId: p.categoryId, onHand: b.onHand, state: stockState(b.onHand, p.reorderPoint) }; }),
      stockValue: moneyCompact(valuation(rows, pmap)),
      units: count(rows.reduce((s, b) => s + b.onHand, 0)),
      skus: rows.length,
      mostValue: rows.map((b) => ({ b, p: pmap.get(b.productId)!, v: b.onHand * pmap.get(b.productId)!.unitCost })).sort((a, b) => b.v - a.v).slice(0, 3)
        .map(({ b, p, v }) => ({ id: p.id, title: p.name, sub: `${count(b.onHand)} on hand`, value: moneyCompact(v), href: `/inventory/catalogue?q=${p.sku}` })),
    };
  });
  return { cards, categories: categories.map((c) => ({ id: c.id, name: c.name })) };
}

export async function loadCentreDetail(repo: Repository, centreId: string, allCentres: Centre[]) {
  const today = repo.today();
  const [centres, products, categories, uoms, balances, movements, counts] = await Promise.all([
    repo.centres(), repo.products(), repo.categories(), repo.uoms(), repo.balances(), repo.movements(), repo.counts(),
  ]);
  const centre = centres.find((c) => c.id === centreId);
  if (!centre) return null;
  const pmap = indexBy(products, "id");
  const catMap = indexBy(categories, "id");
  const umap = indexBy(uoms, "id");
  const rows = balances.filter((b) => b.centreId === centre.id);
  const mine = movements.filter((m) => m.centreId === centre.id);
  const used90 = consumedSince(mine, today, 90);

  const stock = rows.map((b) => {
    const p = pmap.get(b.productId)!;
    const state = stockState(b.onHand, p.reorderPoint);
    const cover = daysOfCover(b.onHand, used90.get(stockKey(centre.id, p.id)) ?? 0);
    return { b, p, state, cover };
  });
  const cells = (catId: string) => stock.filter((s) => s.p.categoryId === catId).map((s) => ({ productId: s.p.id, name: s.p.name, categoryId: catId, onHand: s.b.onHand, state: s.state }));
  const healthy = stock.filter((s) => s.state === "healthy").length;
  const thisPeriod = period(today);
  const countOf = (kind: "opening" | "closing") => counts.find((c) => c.centreId === centre.id && c.period === thisPeriod && c.kind === kind);

  return {
    centre: { id: centre.id, name: centre.name, city: centre.city, code: centre.code, tone: toneOf(allCentres, centre.id) },
    stats: {
      value: valuation(rows, pmap), units: rows.reduce((s, b) => s + b.onHand, 0), skus: rows.length, healthyRatio: rows.length ? healthy / rows.length : 0,
      low: stock.filter((s) => s.state === "low").length, critical: stock.filter((s) => s.state === "critical").length,
      shortCover: stock.filter((s) => s.cover !== null && s.cover < 14).length,
    },
    counts: { opening: countOf("opening")?.status ?? "not_started", closing: countOf("closing")?.status ?? "not_started", period: thisPeriod },
    heat: categories.map((c) => ({ id: c.id, name: c.name, cells: cells(c.id) })).filter((g) => g.cells.length > 0),
    table: [...stock].sort((a, b) => (a.cover ?? Infinity) - (b.cover ?? Infinity)).map(({ b, p, state, cover }): Row => ({
      id: p.id,
      product: { label: p.name, href: `/inventory/catalogue?q=${p.sku}` },
      sku: p.sku,
      category: catMap.get(p.categoryId)?.name ?? "—",
      onHand: b.onHand,
      uom: umap.get(p.uomId)?.code ?? p.uomId,
      reorder: p.reorderPoint,
      state: STATE_BADGE[state],
      cover: coverLabel(cover),
      value: b.onHand * p.unitCost,
    })),
    recent: [...mine].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8).map((m) => {
      const p = pmap.get(m.productId)!;
      const q = signedQty(m);
      return {
        id: m.id, title: p.name, sub: `${MOVEMENT_TYPE[m.type].label} · ${shortDate(m.occurredAt)} · ${relative(m.occurredAt, today)}`,
        value: `${q > 0 ? "+" : "−"}${count(Math.abs(q))}`, badge: MOVEMENT_TYPE[m.type], href: `/inventory/catalogue?q=${p.sku}`,
      };
    }),
    valueLabel: money(valuation(rows, pmap)),
  };
}
