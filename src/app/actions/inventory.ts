"use server";

import { demoCommand } from "@/lib/demo/command";
import type { CommandInput } from "@/domain/commands";
import { transition } from "@/domain/workflows";
import { STOCK_COUNT } from "@/features/inventory/counts";
import { countReference } from "@/features/inventory/stock";
import { count, money } from "@/lib/format";

/**
 * Submit an opening or closing stock count. Every SKU held at the centre must be counted; each difference from the system
 * balance is written as an adjustment movement (referenced count-<CODE>-<period>), the balance is set to the counted
 * quantity, and the count moves to submitted via the STOCK_COUNT machine.
 */
export async function submitStockCount(input: CommandInput<"submitStockCount">) {
  return demoCommand("submitStockCount", input, (cmd, store) => {
    const centre = store.centres.find((c) => c.id === cmd.centreId);
    if (!centre) return { code: "not_found", error: "That centre does not exist." };
    const sc = store.counts.find((c) => c.centreId === cmd.centreId && c.period === cmd.period && c.kind === cmd.kind);
    if (!sc) return { code: "not_found", error: `There is no ${cmd.kind} count for ${centre.name} in ${cmd.period}.` };
    const t = transition(STOCK_COUNT, sc.status, "submit");
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    return { permission: t.permission, resource: { centreId: centre.id, status: sc.status } };
  }, (cmd, ctx) => {
    const { store, now } = ctx;
    const centre = store.centres.find((c) => c.id === cmd.centreId)!;
    const sc = store.counts.find((c) => c.centreId === cmd.centreId && c.period === cmd.period && c.kind === cmd.kind)!;
    const t = transition(STOCK_COUNT, sc.status, "submit");
    if (!t.ok) return { code: "invalid_transition", error: t.reason };

    const held = store.balances.filter((b) => b.centreId === centre.id);
    const counted = new Map(cmd.lines.map((l) => [l.productId, l.onHand]));
    if (cmd.lines.some((l) => !held.some((b) => b.productId === l.productId))) return { code: "validation", error: `A counted product is not stocked at ${centre.name}.` };
    const missing = held.filter((b) => !counted.has(b.productId)).length;
    if (missing) return { code: "validation", error: `Count every product — ${missing} line${missing === 1 ? " is" : "s are"} missing. Enter 0 for items you could not find.` };

    let lines = 0, units = 0, value = 0;
    for (const b of held) {
      const diff = counted.get(b.productId)! - b.onHand;
      if (diff === 0) continue;
      const cost = store.products.find((p) => p.id === b.productId)?.unitCost ?? 0;
      store.movements.push({ id: ctx.id("mv"), centreId: centre.id, productId: b.productId, type: "adjustment", quantity: diff, occurredAt: now, reference: countReference(centre.code, cmd.period) });
      b.onHand += diff;
      b.updatedAt = now;
      lines++; units += diff; value += diff * cost;
    }
    sc.status = t.to;
    sc.submittedAt = now;

    const summary = lines ? `${lines} variance${lines === 1 ? "" : "s"} (${units > 0 ? "+" : ""}${count(units)} units, ${value < 0 ? "−" : ""}${money(Math.abs(value))})` : "no variances";
    ctx.audit(`submitted ${cmd.kind} count`, `${centre.name} ${cmd.period} · ${summary}`, centre.id);
    return { message: `${centre.name} ${cmd.kind} count submitted with ${summary}`, data: { lines, units, value } };
  });
}
