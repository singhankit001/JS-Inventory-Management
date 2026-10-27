import type { Role, RoleDefinition } from "@/domain/types";

/** Every operation the app can authorise. Keep in sync with docs/roles-permissions.md and db/policies.sql. */
export const PERMISSIONS = {
  "dashboard.executive": "View the CEO / Executive dashboard",
  "dashboard.head_office": "View the Head Office dashboard",
  "dashboard.centre": "View the Centre Leader dashboard",
  "dashboard.purchasing": "View the Purchasing dashboard",
  "dashboard.finance": "View the Finance & Accounts dashboard",
  "dashboard.receiving": "View the Receiving dashboard",
  "dashboard.admin": "View the System Administrator dashboard",

  "inventory.read": "View stock balances and movements",
  "inventory.count": "Record opening and closing stock counts",
  "requests.read": "View monthly requests",
  "requests.create": "Create and submit monthly requests",
  "requests.approve": "Approve, reject or return requests for revision",
  "budgets.read": "View budgets",
  "budgets.manage": "Set and change budgets",
  "procurement.read": "View purchase orders and quotations",
  "procurement.manage": "Request quotations and raise purchase orders",
  "procurement.authorise": "Give final authorisation to purchase orders",
  "suppliers.read": "View the supplier master",
  "suppliers.manage": "Create and edit suppliers",
  "receiving.read": "View deliveries and goods receipts",
  "receiving.record": "Record goods receipts, damage and shortages",
  "finance.read": "View invoices, payables and payments",
  "finance.manage": "Query, approve and pay invoices",
  "analytics.read": "View analytics and AI insights",
  "admin.users": "Manage users and role assignments",
  "admin.config": "Change system configuration",
  "audit.read": "Read the audit log",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition & { permissions: readonly PermissionKey[] }> = {
  ceo: {
    role: "ceo",
    label: "CEO / Executive",
    description: "Consolidated view of every authorised centre.",
    scope: "organisation",
    permissions: [
      "dashboard.executive", "inventory.read", "requests.read", "requests.approve", "budgets.read",
      "procurement.read", "procurement.authorise", "suppliers.read", "receiving.read", "finance.read",
      "analytics.read", "audit.read",
    ],
  },
  head_office: {
    role: "head_office",
    label: "Head Office",
    description: "Reviews requests, budgets, prices and deliveries across centres.",
    scope: "organisation",
    permissions: [
      "dashboard.head_office", "inventory.read", "requests.read", "requests.approve", "budgets.read",
      "budgets.manage", "procurement.read", "suppliers.read", "receiving.read", "finance.read", "analytics.read",
    ],
  },
  centre_leader: {
    role: "centre_leader",
    label: "Centre Leader",
    description: "Runs one centre: counts stock, raises requests, checks deliveries.",
    scope: "centre",
    permissions: [
      "dashboard.centre", "inventory.read", "inventory.count", "requests.read", "requests.create",
      "budgets.read", "receiving.read",
    ],
  },
  purchasing: {
    role: "purchasing",
    label: "Purchasing Officer",
    description: "Turns approved requests into quotations and purchase orders.",
    scope: "organisation",
    // Deliberately no requests.approve: purchasing cannot override Head Office approval.
    permissions: [
      "dashboard.purchasing", "requests.read", "procurement.read", "procurement.manage", "suppliers.read",
      "suppliers.manage", "receiving.read",
    ],
  },
  finance: {
    role: "finance",
    label: "Finance & Accounts",
    description: "Matches invoices, approves payables and tracks budget variance.",
    scope: "organisation",
    permissions: [
      "dashboard.finance", "budgets.read", "procurement.read", "suppliers.read", "finance.read",
      "finance.manage", "analytics.read",
    ],
  },
  receiving: {
    role: "receiving",
    label: "Receiving Staff",
    description: "Checks deliveries in at a centre.",
    scope: "centre",
    permissions: ["dashboard.receiving", "receiving.read", "receiving.record", "inventory.read"],
  },
  admin: {
    role: "admin",
    label: "System Administrator",
    description: "Users, roles, catalogue, configuration and audit.",
    scope: "organisation",
    // No finance.read: administrators manage the system, not the money.
    permissions: [
      "dashboard.admin", "inventory.read", "suppliers.read", "suppliers.manage", "admin.users",
      "admin.config", "audit.read",
    ],
  },
};

export const DASHBOARD_PATH: Record<Role, string> = {
  ceo: "/dashboards/executive",
  head_office: "/dashboards/head-office",
  centre_leader: "/dashboards/centre",
  purchasing: "/dashboards/purchasing",
  finance: "/dashboards/finance",
  receiving: "/dashboards/receiving",
  admin: "/dashboards/admin",
};

export function can(role: Role, permission: PermissionKey): boolean {
  return ROLE_DEFINITIONS[role].permissions.includes(permission);
}
