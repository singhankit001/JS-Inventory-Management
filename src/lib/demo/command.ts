import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { COMMANDS, type CommandName } from "@/domain/commands";
import type { ID } from "@/domain/types";
import type { PermissionKey } from "@/lib/auth/permissions";
import { actorFromSession, authorize, type Actor, type Resource } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { demoStore } from "@/lib/data/provider";
import type { SeedData } from "@/lib/data/seed";
import type { CommandErrorCode } from "@/lib/services/contracts";

export type DemoResult<T = undefined> = { ok: true; message: string; data?: T } | { ok: false; code: CommandErrorCode; error: string };
type Fail = { error: string; code: CommandErrorCode };

export interface DemoContext {
  store: SeedData;
  actor: Actor;
  now: string;
  /** Unique id for a new demo record. */
  id(prefix: string): ID;
  audit(action: string, subject: string, centreId?: ID): void;
}

let seq = 0;

/**
 * Every Phase 1 demo write goes through here, in the same order a Phase 2 handler will:
 * validate (zod command schema) → load + decide permission/resource → authorize (policy: SoD, permission, centre
 * isolation) → run → audit → revalidate. Session and scope come from the signed cookie, never from the client.
 * shortcut: `run` mutates the in-memory demo store, which resets daily and on restart; Phase 2 swaps it for a
 * UnitOfWork transaction against Postgres without changing callers.
 */
export async function demoCommand<K extends CommandName, T = undefined>(
  name: K,
  input: unknown,
  load: (cmd: z.output<(typeof COMMANDS)[K]>, store: SeedData, actor: Actor) => { permission: PermissionKey; resource?: Resource } | Fail,
  run: (cmd: z.output<(typeof COMMANDS)[K]>, ctx: DemoContext) => { message: string; data?: T } | Fail,
): Promise<DemoResult<T>> {
  const session = await requireSession();
  const parsed = COMMANDS[name].safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation", error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const cmd = parsed.data as z.output<(typeof COMMANDS)[K]>;
  const store = demoStore();
  const actor = actorFromSession(session);
  const plan = load(cmd, store, actor);
  if ("error" in plan) return { ok: false, ...plan };
  const decision = authorize(actor, plan.permission, plan.resource);
  if (!decision.allowed) return { ok: false, code: "forbidden", error: decision.reason };
  const now = new Date().toISOString();
  const ctx: DemoContext = {
    store, actor, now,
    id: (prefix) => `${prefix}-demo-${Date.now().toString(36)}-${++seq}`,
    audit: (action, subject, centreId) => store.audit.unshift({ id: ctx.id("ae"), actorId: actor.userId, action, subject, centreId, occurredAt: now }),
  };
  const res = run(cmd, ctx);
  if ("error" in res) return { ok: false, ...res };
  revalidatePath("/", "layout");
  return { ok: true, message: `${res.message} · saved to demo data (resets daily)`, data: res.data };
}
