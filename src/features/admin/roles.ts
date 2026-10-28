import { ROLES } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import { can, PERMISSIONS, ROLE_DEFINITIONS, type PermissionKey } from "@/lib/auth/permissions";
import { SOD_RULES } from "@/lib/auth/policy";

/** Plain-language versions of the policy rules; falls back to the rule's own reason for any rule added later. */
const SOD_PLAIN: Record<string, { title: string; body: string }> = {
  "purchasing-cannot-approve-requests": {
    title: "Buyers don't approve what they buy",
    body: "Purchasing officers can never approve a centre's request, even if someone later edits their role to include approval. The team that spends the money doesn't decide what gets ordered.",
  },
  "po-maker-cannot-authorise": {
    title: "Two people for every purchase order",
    body: "Whoever raises a purchase order cannot give it final authorisation — a second person must. If the system can't tell who raised it, authorisation is refused rather than assumed.",
  },
  "pay-only-approved-invoices": {
    title: "Pay only approved invoices",
    body: "A payment can only be recorded against an invoice that Finance has already approved after matching it to the order and the goods received.",
  },
};

export async function loadRoles(repo: Repository) {
  const users = (await repo.users()).filter((u) => u.status === "active");
  return {
    roles: ROLES.map((r) => {
      const d = ROLE_DEFINITIONS[r];
      return {
        role: r, label: d.label, description: d.description, scope: d.scope, permissionCount: d.permissions.length,
        users: users.filter((u) => u.roles.includes(r)).length,
        // Dashboard access is implied by the role; the rest are what the role can actually do.
        capabilities: (d.permissions as readonly PermissionKey[]).filter((p) => !p.startsWith("dashboard.")).map((p) => PERMISSIONS[p]),
      };
    }),
    sod: SOD_RULES.map((rule) => ({
      id: rule.id,
      title: SOD_PLAIN[rule.id]?.title ?? rule.reason,
      body: SOD_PLAIN[rule.id]?.body ?? rule.reason,
      enforced: rule.reason,
      permission: rule.permission,
      holders: ROLES.filter((r) => can(r, rule.permission)).map((r) => ROLE_DEFINITIONS[r].label),
      blocked: (rule.roles ?? []).map((r) => ROLE_DEFINITIONS[r].label),
    })),
  };
}
