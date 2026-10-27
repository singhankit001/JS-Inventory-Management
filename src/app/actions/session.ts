"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ROLES } from "@/domain/types";
import { findUser } from "@/lib/data/provider";
import { clearSession, requireSession, writeSession } from "@/lib/auth/session";
import { DASHBOARD_PATH } from "@/lib/auth/permissions";

const signInSchema = z.object({ userId: z.string().min(1), next: z.string().optional() });

// shortcut: demo sign-in picks a seeded user with no password; Phase 2 replaces this with the identity provider.
export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({ userId: formData.get("userId"), next: formData.get("next") ?? undefined });
  if (!parsed.success) redirect("/login?error=invalid");
  const user = findUser(parsed.data.userId);
  if (!user || user.status !== "active" || !user.roles[0]) redirect("/login?error=invalid");
  const role = user.roles[0];
  await writeSession(user.id, role);
  // Only same-origin relative paths are accepted as a post-login destination.
  const next = parsed.data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : DASHBOARD_PATH[role]);
}

export async function switchWorkspace(role: string) {
  const session = await requireSession();
  const parsed = z.enum(ROLES).safeParse(role);
  if (!parsed.success || !session.user.roles.includes(parsed.data)) throw new Error("Role not assigned to this user");
  await writeSession(session.user.id, parsed.data);
  redirect(DASHBOARD_PATH[parsed.data]);
}

export async function signOut() {
  await clearSession();
  redirect("/login");
}
