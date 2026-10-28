"use server";

import { demoCommand } from "@/lib/demo/command";
import type { CommandInput } from "@/domain/commands";
import type { PurchaseOrder, PurchaseOrderLine, Supplier } from "@/domain/types";
import { APPROVAL, PURCHASE_ORDER, transition } from "@/domain/workflows";
import { PO_ACTIONS, poTotals, referencePrice, type PoAction } from "@/features/procurement/shared";
import { period } from "@/lib/data/seed";
import { money } from "@/lib/format";

/** Raise a PO and submit it for authorisation. Unit prices may differ from contract; the difference is kept as price variance. */
export async function raisePO(input: CommandInput<"raisePO">) {
  return demoCommand("raisePO", input, (cmd, store) => {
    const supplier = store.suppliers.find((s) => s.id === cmd.supplierId);
    if (!supplier) return { code: "not_found", error: "That supplier does not exist." };
    if (supplier.status !== "approved") return { code: "conflict", error: `${supplier.name} is ${supplier.status}; only approved suppliers can receive orders.` };
    if (!store.centres.some((c) => c.id === cmd.centreId)) return { code: "not_found", error: "That centre does not exist." };
    for (const l of cmd.lines) {
      const p = store.products.find((x) => x.id === l.productId);
      if (!p) return { code: "not_found", error: "A line refers to a product that does not exist." };
      if (!supplier.categoryIds.includes(p.categoryId)) return { code: "validation", error: `${supplier.name} does not supply ${p.name}.` };
    }
    return { permission: "procurement.manage", resource: { centreId: cmd.centreId } };
  }, (cmd, ctx) => {
    const { store, actor, now } = ctx;
    const listPrice = (id: string) => store.products.find((p) => p.id === id)!.unitCost;
    const { total, variance } = poTotals(cmd.lines.map((l) => ({ ...l, refPrice: referencePrice(store.quotations, cmd.supplierId, l.productId, listPrice(l.productId)) })));
    const submitted = transition(PURCHASE_ORDER, "draft", "submit");
    if (!submitted.ok) return { code: "invalid_transition", error: submitted.reason };
    const po: PurchaseOrder = {
      id: ctx.id("po"), number: `PO-${2400 + store.purchaseOrders.length}`, supplierId: cmd.supplierId, centreId: cmd.centreId, status: submitted.to,
      total, expectedAt: new Date(`${cmd.expectedAt}T10:00:00`).toISOString(), createdAt: now, raisedBy: actor.userId, priceVariance: variance,
    };
    const lines: PurchaseOrderLine[] = cmd.lines.map((l, i) => ({ id: `${po.id}-l${i + 1}`, purchaseOrderId: po.id, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, ...(l.requestItemId ? { requestItemId: l.requestItemId } : {}) }));
    store.purchaseOrders.push(po);
    store.purchaseOrderLines.push(...lines);
    store.approvals.push({ id: ctx.id("ap"), subjectType: "purchase_order", subjectId: po.id, centreId: po.centreId, stage: "final", status: "pending", amount: total, critical: total > 60_000_00, requestedAt: now });
    ctx.audit("raised purchase order", `${po.number} · ${money(total)}`, po.centreId);
    return { message: `${po.number} raised for ${money(total)} and sent for authorisation`, data: { id: po.id } };
  });
}

/** Authorise (issue), return to draft, or resubmit a PO — PURCHASE_ORDER transitions; SoD stops the raiser authorising. */
export async function decidePO(input: CommandInput<"authorisePO">, command: PoAction) {
  return demoCommand("authorisePO", input, (cmd, store) => {
    if (!(PO_ACTIONS as readonly string[]).includes(command)) return { code: "validation", error: "Unknown purchase order action." };
    const po = store.purchaseOrders.find((p) => p.id === cmd.purchaseOrderId);
    if (!po) return { code: "not_found", error: "That purchase order does not exist." };
    const t = transition(PURCHASE_ORDER, po.status, command);
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    return { permission: t.permission, resource: { centreId: po.centreId, makerId: po.raisedBy, command, status: po.status } };
  }, (cmd, ctx) => {
    const { store, actor, now } = ctx;
    const po = store.purchaseOrders.find((p) => p.id === cmd.purchaseOrderId)!;
    const t = transition(PURCHASE_ORDER, po.status, command);
    if (!t.ok) return { code: "invalid_transition", error: t.reason };
    po.status = t.to;
    // Keep the approval queue in step: an authorised PO settles its pending approval; a resubmitted one opens a new one.
    const pending = store.approvals.find((a) => a.subjectType === "purchase_order" && a.subjectId === po.id && a.status === "pending");
    if (pending && command !== "submit") {
      const a = transition(APPROVAL, pending.status, command === "authorise" ? "approve" : "requestRevision", pending);
      if (a.ok) Object.assign(pending, { status: a.to, decidedBy: actor.userId, decidedAt: now });
    }
    if (command === "submit" && !pending) store.approvals.push({ id: ctx.id("ap"), subjectType: "purchase_order", subjectId: po.id, centreId: po.centreId, stage: "final", status: "pending", amount: po.total, critical: po.total > 60_000_00, requestedAt: now });
    // Issued orders commit budget until received (recordReceipt moves it to spent).
    if (command === "authorise") {
      const b = store.budgets.find((x) => x.centreId === po.centreId && x.period === period(new Date()));
      if (b) b.committed += po.total;
    }
    const verb = { authorise: "authorised", returnToDraft: "returned to draft", submit: "submitted for authorisation" }[command];
    ctx.audit(`${verb} purchase order`, po.number, po.centreId);
    return { message: `${po.number} ${verb}` };
  });
}

export async function upsertSupplier(input: CommandInput<"upsertSupplier">) {
  return demoCommand("upsertSupplier", input, (cmd, store) => {
    if (cmd.id && !store.suppliers.some((s) => s.id === cmd.id)) return { code: "not_found", error: "That supplier does not exist." };
    if (store.suppliers.some((s) => s.id !== cmd.id && s.name.toLowerCase() === cmd.name.toLowerCase())) return { code: "conflict", error: `A supplier called ${cmd.name} already exists.` };
    if (!cmd.categoryIds.length) return { code: "validation", error: "Pick at least one category." };
    if (cmd.categoryIds.some((c) => !store.categories.some((x) => x.id === c))) return { code: "validation", error: "Unknown category." };
    return { permission: "suppliers.manage" };
  }, (cmd, ctx) => {
    const existing = ctx.store.suppliers.find((s) => s.id === cmd.id);
    const fields = { name: cmd.name, categoryIds: [...new Set(cmd.categoryIds)], status: cmd.status, avgLeadDays: cmd.avgLeadDays };
    if (existing) Object.assign(existing, fields);
    // New suppliers have no delivery history yet; scores fill in from receipts.
    else ctx.store.suppliers.push({ id: ctx.id("s"), onTimeRate: 0, qualityScore: 0, ...fields } satisfies Supplier);
    ctx.audit(existing ? "updated supplier" : "added supplier", cmd.name);
    return { message: `${cmd.name} ${existing ? "updated" : "added"}` };
  });
}

export async function requestQuotation(input: CommandInput<"requestQuotation">) {
  return demoCommand("requestQuotation", input, (cmd, store) => {
    const p = store.products.find((x) => x.id === cmd.productId);
    if (!p) return { code: "not_found", error: "That product does not exist." };
    for (const id of cmd.supplierIds) {
      const s = store.suppliers.find((x) => x.id === id);
      if (!s) return { code: "not_found", error: "That supplier does not exist." };
      if (s.status === "blocked") return { code: "conflict", error: `${s.name} is blocked.` };
      if (!s.categoryIds.includes(p.categoryId)) return { code: "validation", error: `${s.name} does not supply this category.` };
      if (store.quotations.some((q) => q.supplierId === id && q.productId === p.id && q.status === "requested")) return { code: "conflict", error: `${s.name} already has an open request for ${p.name}.` };
    }
    return { permission: "procurement.manage" };
  }, (cmd, ctx) => {
    const p = ctx.store.products.find((x) => x.id === cmd.productId)!;
    const validUntil = new Date(Date.now() + 14 * 86_400_000).toISOString();
    // unitPrice stays 0 until the supplier replies; "requested" quotes are never used as prices.
    for (const supplierId of cmd.supplierIds) ctx.store.quotations.push({ id: ctx.id("q"), supplierId, productId: p.id, unitPrice: 0, validUntil, status: "requested" });
    ctx.audit("requested quotation", `${p.name} · ${cmd.supplierIds.length} supplier${cmd.supplierIds.length === 1 ? "" : "s"}`);
    return { message: `Quotation requested from ${cmd.supplierIds.length} supplier${cmd.supplierIds.length === 1 ? "" : "s"} for ${p.name}` };
  });
}
