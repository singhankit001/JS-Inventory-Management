"use server";

import type { CommandInput } from "@/domain/commands";
import type { User } from "@/domain/types";
import { demoCommand } from "@/lib/demo/command";
import { applyConfig } from "@/features/admin/config-store";
import { emailTaken, normaliseEmail, roleLabels, selfAdminRemoval, unknownCentres } from "@/features/admin/users";

// Users and centres are organisation-wide records: an empty resource means only "all"-scope actors may change them.
const ORG = {};

const centreNames = (store: { centres: { id: string; name: string }[] }, ids: string[]) =>
  ids.length ? ids.map((id) => store.centres.find((c) => c.id === id)?.name ?? id).join(", ") : "All centres";

export async function inviteUser(input: CommandInput<"inviteUser">) {
  return demoCommand("inviteUser", input,
    (cmd, store) => {
      if (emailTaken(store.users, cmd.email)) return { code: "conflict", error: `${normaliseEmail(cmd.email)} already belongs to an account.` };
      if (unknownCentres(store.centres, cmd.centreIds).length) return { code: "validation", error: "Choose centres from the list." };
      return { permission: "admin.users", resource: ORG };
    },
    (cmd, ctx) => {
      const user: User = { id: ctx.id("u"), name: cmd.name, email: normaliseEmail(cmd.email), roles: cmd.roles, centreIds: cmd.centreIds, status: "active", lastActiveAt: ctx.now };
      ctx.store.users.push(user);
      ctx.audit("invited user", `${user.name} · ${centreNames(ctx.store, user.centreIds)}`);
      return { message: `${user.name} invited as ${roleLabels(user.roles)}`, data: { id: user.id } };
    });
}

export async function assignRoles(input: CommandInput<"assignRoles">) {
  return demoCommand("assignRoles", input,
    (cmd, store, actor) => {
      const user = store.users.find((u) => u.id === cmd.userId);
      if (!user) return { code: "not_found", error: "That user no longer exists." };
      const self = selfAdminRemoval(actor.userId, user.id, user.roles, cmd.roles);
      if (self) return { code: "forbidden", error: self };
      if (unknownCentres(store.centres, cmd.centreIds).length) return { code: "validation", error: "Choose centres from the list." };
      return { permission: "admin.users", resource: ORG };
    },
    (cmd, ctx) => {
      const user = ctx.store.users.find((u) => u.id === cmd.userId)!;
      user.roles = [...new Set(cmd.roles)];
      user.centreIds = [...new Set(cmd.centreIds)];
      ctx.audit("changed role", `${user.name} → ${roleLabels(user.roles)} · ${centreNames(ctx.store, user.centreIds)}`);
      return { message: `${user.name}'s roles and centres updated` };
    });
}

export async function upsertCentre(input: CommandInput<"upsertCentre">) {
  return demoCommand("upsertCentre", input,
    (cmd, store) => {
      if (cmd.id && !store.centres.some((c) => c.id === cmd.id)) return { code: "not_found", error: "That centre no longer exists." };
      if (store.centres.some((c) => c.id !== cmd.id && c.code === cmd.code)) return { code: "conflict", error: `Centre code ${cmd.code} is already in use.` };
      return { permission: "admin.config", resource: ORG };
    },
    (cmd, ctx) => {
      const existing = cmd.id ? ctx.store.centres.find((c) => c.id === cmd.id) : undefined;
      const fields = { code: cmd.code, name: cmd.name, city: cmd.city, status: cmd.status, monthlyBudget: cmd.monthlyBudget };
      if (existing) Object.assign(existing, fields);
      else ctx.store.centres.push({ id: ctx.id("c"), ...fields });
      ctx.audit(existing ? "updated centre" : "added centre", `${cmd.name} · ${cmd.code}`, existing?.id);
      return { message: existing ? `${cmd.name} updated` : `${cmd.name} added` };
    });
}

export async function updateConfig(input: CommandInput<"updateConfig">) {
  return demoCommand("updateConfig", input,
    () => ({ permission: "admin.config", resource: ORG }),
    (cmd, ctx) => {
      const changed = applyConfig(cmd, ctx.actor.userId, ctx.now);
      if (!changed.length) return { code: "validation", error: "Nothing changed." };
      ctx.audit("updated configuration", changed.join(", "));
      return { message: `Updated ${changed.join(" and ")}` };
    });
}
