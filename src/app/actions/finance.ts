"use server";

import type { CommandInput } from "@/domain/commands";
import { INVOICE, transition } from "@/domain/workflows";
import type { SeedData } from "@/lib/data/seed";
import { demoCommand } from "@/lib/demo/command";
import { money } from "@/lib/format";

/** Loads an invoice in the caller's scope and asks the INVOICE machine whether `command` may run. */
const plan = (command: "query" | "approve") => (cmd: { invoiceId: string }, store: SeedData) => {
  const inv = store.invoices.find((i) => i.id === cmd.invoiceId);
  if (!inv) return { error: "Invoice not found.", code: "not_found" as const };
  const t = transition(INVOICE, inv.status, command, inv);
  if (!t.ok) return { error: t.reason, code: "invalid_transition" as const };
  return { permission: t.permission, resource: { centreId: inv.centreId, command, status: inv.status } };
};

export async function queryInvoice(input: CommandInput<"queryInvoice">) {
  return demoCommand("queryInvoice", input, plan("query"), (cmd, ctx) => {
    const inv = ctx.store.invoices.find((i) => i.id === cmd.invoiceId)!;
    const t = transition(INVOICE, inv.status, "query", inv);
    if (!t.ok) return { error: t.reason, code: "invalid_transition" };
    inv.status = t.to;
    ctx.audit("raised query", `${inv.number} · ${cmd.reason}`, inv.centreId);
    return { message: `${inv.number} put on query` };
  });
}

export async function approveInvoice(input: CommandInput<"approveInvoice">) {
  return demoCommand("approveInvoice", input, plan("approve"), (cmd, ctx) => {
    const inv = ctx.store.invoices.find((i) => i.id === cmd.invoiceId)!;
    const t = transition(INVOICE, inv.status, "approve", inv);
    if (!t.ok) return { error: t.reason, code: "invalid_transition" };
    inv.status = t.to;
    ctx.audit("approved invoice", `${inv.number} · ${money(inv.amount)}`, inv.centreId);
    return { message: `${inv.number} approved for payment` };
  });
}

export async function recordPayment(input: CommandInput<"recordPayment">) {
  return demoCommand(
    "recordPayment", input,
    (cmd, store) => {
      const inv = store.invoices.find((i) => i.id === cmd.invoiceId);
      if (!inv) return { error: "Invoice not found.", code: "not_found" };
      // Policy decides "only approved invoices can be paid" (SoD rule pay-only-approved-invoices) from the status.
      return { permission: "finance.manage", resource: { centreId: inv.centreId, command: "pay", status: inv.status } };
    },
    (cmd, ctx) => {
      const inv = ctx.store.invoices.find((i) => i.id === cmd.invoiceId)!;
      if (cmd.amount > inv.amount) return { error: `Payment exceeds the invoice (${money(inv.amount)}).`, code: "validation" };
      if (new Date(cmd.paidAt).getTime() > Date.now() + 86_400_000) return { error: "Payment date cannot be in the future.", code: "validation" };
      const t = transition(INVOICE, inv.status, "pay", inv);
      if (!t.ok) return { error: t.reason, code: "invalid_transition" };
      inv.status = t.to;
      ctx.store.payments.push({ id: ctx.id("pay"), invoiceId: inv.id, amount: cmd.amount, paidAt: cmd.paidAt, method: cmd.method });
      ctx.audit("recorded payment", `${inv.number} · ${money(cmd.amount)}`, inv.centreId);
      return { message: `${money(cmd.amount)} recorded against ${inv.number}${cmd.amount < inv.amount ? " (short of the billed amount — shows under reconciliation)" : ""}` };
    },
  );
}
