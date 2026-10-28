// Pure stock math shared by the inventory pages (and the stock-count handler). No I/O: easy to test.
import type { StockMovement } from "@/domain/types";
import type { Tone } from "@/components/ui/badge";

export const MOVEMENT_TYPE: Record<StockMovement["type"], { label: string; tone: Tone }> = {
  receipt: { label: "Receipt", tone: "green" },
  consumption: { label: "Consumption", tone: "blue" },
  transfer_in: { label: "Transfer in", tone: "violet" },
  transfer_out: { label: "Transfer out", tone: "violet" },
  adjustment: { label: "Adjustment", tone: "amber" },
};

export const STATE_BADGE = {
  healthy: { label: "Healthy", tone: "green" },
  low: { label: "Low", tone: "amber" },
  critical: { label: "Critical", tone: "red" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

/** Effect of a movement on stock on hand: consumption and transfers out are stored as positive quantities. */
export const signedQty = (m: Pick<StockMovement, "type" | "quantity">) =>
  m.type === "consumption" || m.type === "transfer_out" ? -m.quantity : m.quantity;

export const stockKey = (centreId: string, productId: string) => `${centreId}:${productId}`;

/** Units consumed per centre:product over the `days` before `today` (inclusive of today). */
export function consumedSince(movements: StockMovement[], today: Date, days = 90) {
  const from = new Date(today.getTime() - days * 86_400_000).toISOString();
  const out = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== "consumption" || m.occurredAt < from) continue;
    const k = stockKey(m.centreId, m.productId);
    out.set(k, (out.get(k) ?? 0) + m.quantity);
  }
  return out;
}

/** Days the stock lasts at the average daily use of the window. null = no use in the window (cover is open-ended). */
export function daysOfCover(onHand: number, consumed: number, windowDays = 90): number | null {
  if (consumed <= 0) return null;
  return Math.floor(onHand / (consumed / windowDays));
}

/** Units to order to bring stock back up to twice the reorder point. */
export const suggestedReorder = (onHand: number, reorderPoint: number) => Math.max(0, 2 * reorderPoint - onHand);

export const coverLabel = (d: number | null) => (d === null ? "No recent use" : d >= 365 ? "1 yr+" : `${d} d`);

/** Count adjustments carry `count-<CENTRE CODE>-<YYYY-MM>` as their reference (seed and submitStockCount). */
export const countReference = (centreCode: string, period: string) => `count-${centreCode}-${period}`;
export const isCountAdjustment = (m: Pick<StockMovement, "type" | "reference">) => m.type === "adjustment" && !!m.reference?.startsWith("count-");

export interface CountVariance { movement: StockMovement; system: number; counted: number; variance: number }

/**
 * System vs counted quantity for each count adjustment, rebuilt from today's balance: counted = on hand now minus
 * every later movement of that SKU; system = counted minus the adjustment itself.
 */
export function countVariances(movements: StockMovement[], onHand: Map<string, number>): CountVariance[] {
  const byKey = new Map<string, StockMovement[]>();
  for (const m of movements) {
    const k = stockKey(m.centreId, m.productId);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(m);
  }
  return movements.filter(isCountAdjustment).map((adj) => {
    const later = (byKey.get(stockKey(adj.centreId, adj.productId)) ?? []).filter((m) => m.occurredAt > adj.occurredAt);
    const counted = (onHand.get(stockKey(adj.centreId, adj.productId)) ?? 0) - later.reduce((s, m) => s + signedQty(m), 0);
    return { movement: adj, system: counted - adj.quantity, counted, variance: adj.quantity };
  });
}
