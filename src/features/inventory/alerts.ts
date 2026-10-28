import type { Repository } from "@/lib/data/provider";
import { indexBy, lowStock } from "@/features/dashboards/shared";
import { consumedSince, coverLabel, daysOfCover, STATE_BADGE, stockKey, suggestedReorder } from "./stock";

export async function loadAlerts(repo: Repository) {
  const today = repo.today();
  const [centres, products, uoms, balances, movements] = await Promise.all([repo.centres(), repo.products(), repo.uoms(), repo.balances(), repo.movements()]);
  const pmap = indexBy(products, "id"), umap = indexBy(uoms, "id");
  const used90 = consumedSince(movements, today, 90);

  const items = lowStock(balances, pmap).map(({ balance: b, product: p, state }) => {
    const cover = daysOfCover(b.onHand, used90.get(stockKey(b.centreId, p.id)) ?? 0);
    const reorder = suggestedReorder(b.onHand, p.reorderPoint);
    return {
      id: `${b.centreId}-${p.id}`, centreId: b.centreId, productId: p.id, sku: p.sku, name: p.name, uom: umap.get(p.uomId)?.code ?? p.uomId,
      onHand: b.onHand, reorderPoint: p.reorderPoint, state, badge: STATE_BADGE[state], cover, coverLabel: coverLabel(cover),
      reorder, reorderValue: reorder * p.unitCost,
    };
  });

  const groups = centres.map((c) => ({ id: c.id, name: c.name, city: c.city, items: items.filter((i) => i.centreId === c.id) }))
    .filter((g) => g.items.length > 0)
    // Centres with the most critical lines first, then the most lines.
    .sort((a, b) => b.items.filter((i) => i.state === "critical").length - a.items.filter((i) => i.state === "critical").length || b.items.length - a.items.length);

  const covers = items.map((i) => i.cover).filter((c): c is number => c !== null);
  return {
    groups,
    critical: items.filter((i) => i.state === "critical").length,
    low: items.filter((i) => i.state === "low").length,
    reorderValue: items.reduce((s, i) => s + i.reorderValue, 0),
    reorderUnits: items.reduce((s, i) => s + i.reorder, 0),
    shortestCover: covers.length ? Math.min(...covers) : null,
    centresAffected: groups.length,
    centreCount: centres.length,
  };
}
