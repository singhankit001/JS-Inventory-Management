"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { markNotificationsRead } from "@/lib/data/provider";

const idsSchema = z.array(z.string().min(1).max(64)).max(200).optional();

/** Marks the signed-in user's notifications read (all when ids is omitted). The user always comes from the session. */
export async function markRead(ids?: string[]): Promise<{ ok: boolean; changed: number }> {
  const session = await requireSession();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, changed: 0 };
  const changed = markNotificationsRead(session.user.id, parsed.data);
  if (changed) revalidatePath("/", "layout");
  return { ok: true, changed };
}
