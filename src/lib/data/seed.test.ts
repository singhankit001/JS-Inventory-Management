import { describe, expect, it } from "vitest";
import { buildSeed, period } from "./seed";

// Run the invariants on the real date and on awkward ones: month start, summer break, Diwali, year end.
const DATES = [new Date(), new Date(2026, 4, 1), new Date(2026, 5, 15), new Date(2026, 10, 9), new Date(2026, 11, 31)];

describe.each(DATES.map((d) => [d.toDateString(), d] as const))("seed on %s", (_, now) => {
  const s = buildSeed(now);
  const lineMap = new Map(s.purchaseOrderLines.map((l) => [l.id, l]));
  const linesOf = (poId: string) => s.purchaseOrderLines.filter((l) => l.purchaseOrderId === poId);
  const rLinesOf = new Map<string, typeof s.receiptLines>();
  for (const l of s.receiptLines) rLinesOf.set(l.receiptId, [...(rLinesOf.get(l.receiptId) ?? []), l]);
  const good = new Map<string, number>();
  for (const l of s.receiptLines) good.set(l.purchaseOrderLineId, (good.get(l.purchaseOrderLineId) ?? 0) + l.receivedQty - l.damagedQty);
  const owedOn = (poId: string) => linesOf(poId).reduce((t, l) => t + Math.max(0, l.quantity - (good.get(l.id) ?? 0)), 0);
  const off = (iso: string) => Math.round((new Date(new Date(iso).toDateString()).getTime() - s.today.getTime()) / 86_400_000);

  it("has the 11 published centres and keeps the demo accounts", () => {
    expect(s.centres).toHaveLength(11);
    expect(s.users.find((u) => u.id === "u-rcv")?.centreIds).toEqual(["c-bnr", "c-wkd"]);
    for (const c of s.centres) expect(s.users.some((u) => u.roles.includes("centre_leader") && u.centreIds.includes(c.id))).toBe(true);
  });

  it("PO totals equal the sum of their 1–6 lines, with variance against the contract price", () => {
    for (const po of s.purchaseOrders) {
      const lines = linesOf(po.id);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(6);
      expect(new Set(lines.map((l) => l.productId)).size).toBe(lines.length);
      expect(po.total).toBe(lines.reduce((t, l) => t + l.quantity * l.unitPrice, 0));
      for (const l of lines) expect(Number.isInteger(l.quantity) && l.quantity > 0).toBe(true);
      expect(po.raisedBy).toBe("u-po");
    }
    const items = new Map(s.requestItems.map((i) => [i.id, i]));
    for (const l of s.purchaseOrderLines.filter((x) => x.requestItemId)) {
      expect(items.get(l.requestItemId!)?.productId).toBe(l.productId);
      expect(items.get(l.requestItemId!)?.approvedQty).toBe(l.quantity);
    }
  });

  it("receipt totals equal their lines; discrepancy iff a line is short, over or damaged", () => {
    for (const r of s.receipts) {
      const lines = rLinesOf.get(r.id) ?? [];
      expect(lines.length).toBeGreaterThan(0);
      expect(r.orderedQty).toBe(lines.reduce((t, l) => t + l.orderedQty, 0));
      expect(r.receivedQty).toBe(lines.reduce((t, l) => t + l.receivedQty, 0));
      expect(r.damagedQty).toBe(lines.reduce((t, l) => t + l.damagedQty, 0));
      const issue = lines.some((l) => l.receivedQty !== l.orderedQty || l.damagedQty > 0);
      expect(r.status).toBe(issue ? "discrepancy" : "confirmed");
      for (const l of lines) {
        expect(lineMap.get(l.purchaseOrderLineId)?.purchaseOrderId).toBe(r.purchaseOrderId);
        expect(l.damagedQty).toBeLessThanOrEqual(l.receivedQty);
        expect(l.receivedQty).toBeLessThanOrEqual(l.orderedQty + Math.ceil(l.orderedQty * 0.1));
      }
      expect(off(r.receivedAt)).toBeLessThan(0);
    }
  });

  it("PO status follows what is still owed", () => {
    const received = new Set(s.receipts.map((r) => r.purchaseOrderId));
    for (const po of s.purchaseOrders) {
      if (po.status === "received") expect(owedOn(po.id)).toBe(0);
      if (po.status === "partially_received") expect(owedOn(po.id)).toBeGreaterThan(0);
      if (["received", "partially_received"].includes(po.status)) expect(received.has(po.id)).toBe(true);
      else expect(received.has(po.id)).toBe(false);
    }
  });

  it("balances equal opening + receipts − consumption ± adjustments and never go negative", () => {
    const running = new Map<string, number>();
    const sign = { receipt: 1, transfer_in: 1, adjustment: 1, consumption: -1, transfer_out: -1 } as const;
    for (const m of [...s.movements].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
      const key = `${m.centreId}:${m.productId}`;
      if (m.type !== "adjustment") expect(m.quantity).toBeGreaterThan(0);
      running.set(key, (running.get(key) ?? 0) + sign[m.type] * m.quantity);
      expect(running.get(key)).toBeGreaterThanOrEqual(0);
    }
    expect(s.balances).toHaveLength(s.centres.length * s.products.length);
    for (const b of s.balances) {
      expect(b.onHand).toBeGreaterThanOrEqual(0);
      expect(b.onHand).toBe(running.get(`${b.centreId}:${b.productId}`));
    }
  });

  it("receipt movements match receipt lines: product, good units and date", () => {
    const receipts = new Map(s.receipts.map((r) => [r.id, r]));
    const moves = s.movements.filter((m) => m.type === "receipt");
    for (const l of s.receiptLines) {
      const r = receipts.get(l.receiptId)!;
      const m = moves.filter((x) => x.reference === r.id && x.productId === l.productId);
      const goodQty = l.receivedQty - l.damagedQty;
      if (goodQty === 0) expect(m).toHaveLength(0);
      else expect(m).toEqual([expect.objectContaining({ centreId: r.centreId, quantity: goodQty, occurredAt: r.receivedAt })]);
    }
    expect(moves.length).toBe(s.receiptLines.filter((l) => l.receivedQty > l.damagedQty).length);
  });

  it("consumption dips in the May summer break", () => {
    const monthUnits = (m: number) => s.movements.filter((x) => x.type === "consumption" && new Date(x.occurredAt).getMonth() === m).reduce((t, x) => t + x.quantity, 0);
    if (monthUnits(4) && monthUnits(6)) expect(monthUnits(4)).toBeLessThan(monthUnits(6) * 0.5);
  });

  it("budgets: spent = good units received × PO price in the period; committed = still owed on authorised POs", () => {
    const receipts = new Map(s.receipts.map((r) => [r.id, r]));
    const spent = new Map<string, number>();
    for (const l of s.receiptLines) {
      const r = receipts.get(l.receiptId)!;
      const key = `${r.centreId}:${period(new Date(r.receivedAt))}`;
      spent.set(key, (spent.get(key) ?? 0) + (l.receivedQty - l.damagedQty) * lineMap.get(l.purchaseOrderLineId)!.unitPrice);
    }
    expect(s.budgets).toHaveLength(s.centres.length * 12);
    const thisPeriod = period(s.today);
    for (const b of s.budgets) {
      expect(b.spent).toBe(spent.get(`${b.centreId}:${b.period}`) ?? 0);
      const committed = s.purchaseOrders.filter((p) => p.centreId === b.centreId && (p.status === "issued" || p.status === "partially_received"))
        .reduce((t, p) => t + linesOf(p.id).reduce((u, l) => u + Math.max(0, l.quantity - (good.get(l.id) ?? 0)) * l.unitPrice, 0), 0);
      expect(b.committed).toBe(b.period === thisPeriod ? committed : 0);
    }
  });

  it("invoices match against PO and receipt lines; payments settle paid invoices", () => {
    const pos = new Map(s.purchaseOrders.map((p) => [p.id, p]));
    const received = new Set(s.receipts.map((r) => r.purchaseOrderId));
    for (const i of s.invoices) {
      const po = pos.get(i.purchaseOrderId)!;
      expect(["draft", "awaiting_authorisation"]).not.toContain(po.status);
      expect(i.centreId).toBe(po.centreId);
      expect(i.match === "unmatched").toBe(!received.has(po.id));
      if (i.match === "matched") {
        expect(i.amount).toBe(linesOf(po.id).reduce((t, l) => t + Math.max(l.quantity, good.get(l.id) ?? 0) * l.unitPrice, 0));
        expect(linesOf(po.id).every((l) => (good.get(l.id) ?? 0) >= l.quantity)).toBe(true);
      }
      if (po.status === "partially_received") expect(i.match).not.toBe("matched");
    }
    const paid = new Set(s.payments.map((p) => p.invoiceId));
    for (const i of s.invoices) expect(paid.has(i.id)).toBe(i.status === "paid");
    for (const p of s.payments) expect(off(p.paidAt)).toBeLessThan(0);
  });

  it("gives the receiving user deliveries due today and an overdue one", () => {
    const mine = s.purchaseOrders.filter((p) => p.status === "issued" && (p.centreId === "c-bnr" || p.centreId === "c-wkd"));
    expect(mine.filter((p) => off(p.expectedAt) === 0).length).toBeGreaterThan(0);
    expect(mine.filter((p) => off(p.expectedAt) < 0).length).toBeGreaterThan(0);
    expect(s.purchaseOrders.some((p) => p.status === "awaiting_authorisation")).toBe(true);
  });

  it("keeps per-user read state on notifications", () => {
    for (const n of s.notifications) expect(Array.isArray(n.readBy)).toBe(true);
    expect(s.notifications.some((n) => n.userId === "*" && n.readBy.length === 0)).toBe(true);
  });
});

it("is deterministic for a given day", () => {
  const a = buildSeed(new Date(2026, 9, 27)), b = buildSeed(new Date(2026, 9, 27, 18));
  expect(b.purchaseOrders).toEqual(a.purchaseOrders);
  expect(b.balances).toEqual(a.balances);
});
