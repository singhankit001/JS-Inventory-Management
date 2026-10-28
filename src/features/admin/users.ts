import type { Centre, ID, Role, User } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import type { Tone } from "@/components/ui/badge";
import { ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import { indexBy } from "@/features/dashboards/shared";

// ---- Guards shared by the admin server actions (pure, so they are unit-tested) ----

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

/** Emails are unique regardless of case or stray spaces. */
export const emailTaken = (users: User[], email: string, exceptId?: ID) => users.some((u) => u.id !== exceptId && normaliseEmail(u.email) === normaliseEmail(email));

/** An administrator may not drop their own admin role: it would lock them out mid-session and could leave nobody able to undo it. */
export function selfAdminRemoval(actorId: ID, targetId: ID, current: readonly Role[], next: readonly Role[]): string | undefined {
  if (actorId === targetId && current.includes("admin") && !next.includes("admin")) return "You can't remove your own administrator role. Ask another administrator to do it.";
  return undefined;
}

export const unknownCentres = (centres: Centre[], ids: readonly ID[]) => ids.filter((id) => !centres.some((c) => c.id === id));

export const roleLabels = (roles: readonly Role[]) => roles.map((r) => ROLE_DEFINITIONS[r].label).join(", ");

// shortcut: User has no "invited" status, so demo-invited accounts are recognised by the demo id prefix; Phase 2 adds an invitation record.
export const isDemoInvite = (u: User) => u.id.startsWith("u-demo-");

// ---- Page loader ----

export interface UserDetail {
  id: ID; name: string; email: string; roles: Role[]; centreIds: ID[]; status: User["status"]; lastActiveAt: string; invited: boolean;
}
export interface CentreOption { id: ID; code: string; name: string; city: string }

export async function loadUsers(repo: Repository) {
  const [users, centres] = await Promise.all([repo.users(), repo.centres()]);
  const cmap = indexBy(centres, "id");
  const active = users.filter((u) => u.status === "active");
  const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows: sorted.map((u) => ({
      id: u.id,
      name: { label: u.name, href: `/admin/users?user=${u.id}` },
      email: u.email,
      roles: roleLabels(u.roles),
      centres: u.centreIds.length ? u.centreIds.map((id) => cmap.get(id)?.code ?? id).join(", ") : "All centres",
      status: isDemoInvite(u) ? { label: "Invited", tone: "blue" as Tone } : u.status === "active" ? { label: "Active", tone: "green" as Tone } : { label: "Suspended", tone: "red" as Tone },
      lastActive: u.lastActiveAt,
    })),
    details: sorted.map((u): UserDetail => ({ id: u.id, name: u.name, email: u.email, roles: u.roles, centreIds: u.centreIds, status: u.status, lastActiveAt: u.lastActiveAt, invited: isDemoInvite(u) })),
    centreOptions: [...centres].sort((a, b) => a.name.localeCompare(b.name)).map((c): CentreOption => ({ id: c.id, code: c.code, name: c.name, city: c.city })),
    centres: [...centres].sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
      const staff = active.filter((u) => u.centreIds.includes(c.id));
      const leader = staff.find((u) => u.roles.includes("centre_leader"));
      return { ...c, staff: staff.length, leader: leader ? { id: leader.id, name: leader.name } : undefined };
    }),
    counts: { users: users.length, active: active.length, suspended: users.length - active.length, centres: centres.length, activeCentres: centres.filter((c) => c.status === "active").length },
  };
}

export type CentreRow = Awaited<ReturnType<typeof loadUsers>>["centres"][number];
