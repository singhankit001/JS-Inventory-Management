import type { ID, Role } from "@/domain/types";
import type { CentreScope } from "@/lib/data/provider";
import { INVOICE } from "@/domain/workflows";
import { can, PERMISSIONS, type PermissionKey } from "./permissions";
import type { Session } from "./session";

/** Who is acting. Built only from the signed session, never from client input. */
export interface Actor {
  userId: ID;
  role: Role;
  scope: CentreScope;
}

export const actorFromSession = (s: Session): Actor => ({ userId: s.user.id, role: s.role, scope: s.scope });

/** The loaded record being acted on. Omit it only for a permission-only check (e.g. before loading). */
export interface Resource {
  /** Undefined = organisation-wide record, which only "all"-scope actors may touch (mirrors the seed provider's reads). */
  centreId?: ID;
  /** Who created/raised the subject, for maker–checker rules. */
  makerId?: ID;
  /** Workflow command being run (see domain/workflows), for rules that only apply to one command. */
  command?: string;
  status?: string;
}

export type Decision =
  | { allowed: true }
  | { allowed: false; code: "missing_permission" | "out_of_scope" | "separation_of_duties"; reason: string };

interface SodRule {
  id: string;
  permission: PermissionKey;
  command?: string;
  /** Roles that may never use this permission, even if a later role edit grants it. */
  roles?: readonly Role[];
  /** The record's maker may not also act (fails closed when the maker is unknown). */
  makerChecker?: true;
  /** Statuses the record must be in (fails closed when the status is unknown). */
  statuses?: readonly string[];
  reason: string;
}

/** Separation-of-duties rules. Checked before the permission so the denial names the specific rule. */
export const SOD_RULES: readonly SodRule[] = [
  { id: "purchasing-cannot-approve-requests", permission: "requests.approve", roles: ["purchasing"], reason: "Purchasing cannot approve requests it will then order." },
  { id: "po-maker-cannot-authorise", permission: "procurement.authorise", makerChecker: true, reason: "The person who raised a purchase order cannot authorise it." },
  { id: "pay-only-approved-invoices", permission: "finance.manage", command: "pay", statuses: INVOICE.commands.pay.from, reason: "Only approved invoices can be paid." },
];

function violates(rule: SodRule, actor: Actor, r: Resource | undefined): boolean {
  if (rule.roles?.includes(actor.role)) return true;
  if (!r || (rule.command && rule.command !== r.command)) return false;
  if (rule.makerChecker && (!r.makerId || r.makerId === actor.userId)) return true;
  return !!rule.statuses && (!r.status || !rule.statuses.includes(r.status));
}

export function authorize(actor: Actor, permission: PermissionKey, resource?: Resource): Decision {
  const sod = SOD_RULES.find((rule) => rule.permission === permission && violates(rule, actor, resource));
  if (sod) return { allowed: false, code: "separation_of_duties", reason: sod.reason };
  if (!can(actor.role, permission)) return { allowed: false, code: "missing_permission", reason: `Your role may not: ${PERMISSIONS[permission].toLowerCase()}.` };
  if (resource && actor.scope !== "all" && (!resource.centreId || !actor.scope.includes(resource.centreId))) {
    return { allowed: false, code: "out_of_scope", reason: "That record belongs to a centre outside your assignment." };
  }
  return { allowed: true };
}
