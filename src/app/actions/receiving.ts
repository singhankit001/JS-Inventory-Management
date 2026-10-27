"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { recordReceipt } from "@/lib/data/provider";
import { RECEIPT_STATUS } from "@/features/dashboards/receiving";

const receiptSchema = z.object({
  purchaseOrderId: z.string().min(1, "Choose a purchase order"),
  receivedQty: z.number().int().min(0).max(99_999),
  damagedQty: z.number().int().min(0).max(99_999),
}).refine((d) => d.damagedQty <= d.receivedQty, { message: "Damaged units cannot exceed units received", path: ["damagedQty"] });

export type ReceiptResult = { ok: true; title: string; body: string } | { ok: false; error: string };

export async function recordGoodsReceipt(input: z.input<typeof receiptSchema>): Promise<ReceiptResult> {
  const session = await requirePermission("receiving.record");
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the quantities and try again." };
  // Scope comes from the signed session, never from the client.
  const res = recordReceipt(session.scope, { ...parsed.data, actorId: session.user.id });
  if (!res.ok) return res;
  revalidatePath("/", "layout");
  const { receipt, po } = res;
  return {
    ok: true,
    title: `${po.number} recorded · ${RECEIPT_STATUS[receipt.status].label}`,
    body: `${receipt.receivedQty} of ${receipt.orderedQty} units received${receipt.damagedQty ? `, ${receipt.damagedQty} damaged` : ""}. Saved to demo data, which resets daily.`,
  };
}
