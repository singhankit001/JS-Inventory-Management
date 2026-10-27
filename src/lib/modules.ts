import type { Role } from "@/domain/types";
import type { Repository } from "@/lib/data/provider";
import { can, type PermissionKey } from "@/lib/auth/permissions";

/** Typed contract for every planned page. Phase 2+ implements against these, not against ad-hoc props. */
export interface PageContract {
  slug: string;
  title: string;
  summary: string;
  permission: PermissionKey;
  status: "implemented" | "planned";
  phase: 1 | 2 | 3;
  /** Only implemented pages have a route. */
  href?: string;
  /** Repository collections the page reads — the data contract for later phases. */
  reads: (keyof Omit<Repository, "mode" | "today">)[];
  /** Mutations the page will perform (server actions). */
  writes?: string[];
}

export interface ModuleGroup {
  id: string;
  label: string;
  short: string;
  description: string;
  pages: PageContract[];
}

export const MODULES: ModuleGroup[] = [
  {
    id: "operations", label: "Executive & Operations", short: "Operations",
    description: "Organisation-wide and centre-level command views.",
    pages: [
      { slug: "executive", title: "Executive dashboard", summary: "Consolidated valuation, spend, approvals and AI insights.", permission: "dashboard.executive", status: "implemented", phase: 1, href: "/dashboards/executive", reads: ["balances", "budgets", "approvals", "purchaseOrders", "suppliers", "movements", "audit"] },
      { slug: "head-office", title: "Head Office dashboard", summary: "Request reviews, budgets, POs, discrepancies and invoices.", permission: "dashboard.head_office", status: "implemented", phase: 1, href: "/dashboards/head-office", reads: ["requests", "requestItems", "approvals", "budgets", "purchaseOrders", "receipts", "invoices"] },
      { slug: "centre", title: "Centre dashboard", summary: "One centre's stock, request deadline, deliveries and alerts.", permission: "dashboard.centre", status: "implemented", phase: 1, href: "/dashboards/centre", reads: ["balances", "counts", "requests", "purchaseOrders", "receipts", "movements"] },
      { slug: "centres", title: "Centre directory", summary: "All centres with leaders, budgets and operational status.", permission: "inventory.read", status: "planned", phase: 2, reads: ["centres", "users", "budgets"] },
    ],
  },
  {
    id: "inventory", label: "Inventory Management", short: "Inventory",
    description: "Stock balances, movements, counts and the product catalogue.",
    pages: [
      { slug: "stock", title: "Stock balances", summary: "On-hand quantities per centre with reorder status.", permission: "inventory.read", status: "planned", phase: 2, reads: ["balances", "products", "categories"] },
      { slug: "movements", title: "Stock movements", summary: "Receipts, consumption, transfers and adjustments ledger.", permission: "inventory.read", status: "planned", phase: 2, reads: ["movements", "products"] },
      { slug: "counts", title: "Stock counts", summary: "Opening and closing monthly counts.", permission: "inventory.count", status: "planned", phase: 2, reads: ["counts", "balances"], writes: ["submitStockCount"] },
      { slug: "catalogue", title: "Product catalogue", summary: "Products, categories and units of measure.", permission: "inventory.read", status: "planned", phase: 2, reads: ["products", "categories", "uoms"] },
      { slug: "alerts", title: "Low-stock alerts", summary: "Items under reorder point across centres.", permission: "inventory.read", status: "planned", phase: 2, reads: ["balances", "products"] },
    ],
  },
  {
    id: "requests", label: "Requests & AI Intake", short: "Requests",
    description: "Monthly and emergency requests, including audio/video intake.",
    pages: [
      { slug: "monthly", title: "Monthly requests", summary: "Request history and status per centre.", permission: "requests.read", status: "planned", phase: 2, reads: ["requests", "requestItems"] },
      { slug: "new", title: "New monthly request", summary: "Build a request against historical consumption.", permission: "requests.create", status: "planned", phase: 2, reads: ["products", "movements", "budgets"], writes: ["saveDraftRequest", "submitRequest"] },
      { slug: "ai-intake", title: "Audio & video intake", summary: "Speak or record a request; AI drafts the line items.", permission: "requests.create", status: "planned", phase: 3, reads: ["aiJobs"], writes: ["uploadMedia", "confirmAIDraft"] },
      { slug: "emergency", title: "Emergency requests", summary: "Out-of-cycle requests with expedited approval.", permission: "requests.read", status: "planned", phase: 2, reads: ["requests"], writes: ["raiseEmergency"] },
    ],
  },
  {
    id: "approvals", label: "Approvals & Budgets", short: "Approvals",
    description: "Head Office review of requests and budgets.",
    pages: [
      { slug: "queue", title: "Approval queue", summary: "Approve, reject or return requests with line-level edits.", permission: "requests.approve", status: "planned", phase: 2, reads: ["approvals", "requests", "requestItems"], writes: ["decideApproval"] },
      { slug: "budgets", title: "Budgets", summary: "Monthly allocation, commitment and spend per centre.", permission: "budgets.read", status: "planned", phase: 2, reads: ["budgets", "centres"], writes: ["setBudget"] },
      { slug: "variance", title: "Budget variance", summary: "Planned versus actual by centre and category.", permission: "budgets.read", status: "planned", phase: 2, reads: ["budgets", "purchaseOrders"] },
    ],
  },
  {
    id: "procurement", label: "Procurement & Suppliers", short: "Procurement",
    description: "Quotations, purchase orders and the supplier master.",
    pages: [
      { slug: "dashboard", title: "Purchasing dashboard", summary: "Approved queue, quotations, POs and delays.", permission: "dashboard.purchasing", status: "implemented", phase: 1, href: "/dashboards/purchasing", reads: ["approvals", "quotations", "purchaseOrders", "suppliers"] },
      { slug: "quotations", title: "Quotations", summary: "Request and compare supplier quotations.", permission: "procurement.read", status: "planned", phase: 2, reads: ["quotations", "suppliers"], writes: ["requestQuotation"] },
      { slug: "orders", title: "Purchase orders", summary: "Raise, authorise and track purchase orders.", permission: "procurement.read", status: "planned", phase: 2, reads: ["purchaseOrders"], writes: ["raisePO", "authorisePO"] },
      { slug: "suppliers", title: "Suppliers", summary: "Supplier master, categories and terms.", permission: "suppliers.read", status: "planned", phase: 2, reads: ["suppliers"], writes: ["upsertSupplier"] },
      { slug: "compare", title: "Supplier comparison", summary: "Price, lead time and quality side by side.", permission: "procurement.read", status: "planned", phase: 2, reads: ["quotations", "suppliers"] },
    ],
  },
  {
    id: "receiving", label: "Delivery & Receiving", short: "Receiving",
    description: "Expected deliveries and goods receipts.",
    pages: [
      { slug: "dashboard", title: "Receiving dashboard", summary: "Today's deliveries and quantity verification.", permission: "dashboard.receiving", status: "implemented", phase: 1, href: "/dashboards/receiving", reads: ["purchaseOrders", "receipts"], writes: ["recordGoodsReceipt"] },
      { slug: "deliveries", title: "Expected deliveries", summary: "Calendar of incoming orders per centre.", permission: "receiving.read", status: "planned", phase: 2, reads: ["purchaseOrders"] },
      { slug: "receipts", title: "Goods receipts", summary: "Receipt history with photos and signatures.", permission: "receiving.read", status: "planned", phase: 2, reads: ["receipts"] },
      { slug: "discrepancies", title: "Discrepancies", summary: "Damage and shortage claims with suppliers.", permission: "receiving.read", status: "planned", phase: 2, reads: ["receipts", "suppliers"] },
    ],
  },
  {
    id: "finance", label: "Finance & Invoices", short: "Finance",
    description: "Invoices, matching, payments and reconciliation.",
    pages: [
      { slug: "dashboard", title: "Finance dashboard", summary: "Payables, matching, variance and payments.", permission: "dashboard.finance", status: "implemented", phase: 1, href: "/dashboards/finance", reads: ["invoices", "payments", "budgets"] },
      { slug: "invoices", title: "Invoices", summary: "Three-way match against PO and goods receipt.", permission: "finance.read", status: "planned", phase: 2, reads: ["invoices", "purchaseOrders", "receipts"], writes: ["queryInvoice", "approveInvoice"] },
      { slug: "payments", title: "Payments", summary: "Payment runs and remittance history.", permission: "finance.read", status: "planned", phase: 2, reads: ["payments"], writes: ["recordPayment"] },
      { slug: "reconciliation", title: "Reconciliation", summary: "Exceptions between invoices, receipts and payments.", permission: "finance.read", status: "planned", phase: 2, reads: ["invoices", "receipts", "payments"] },
    ],
  },
  {
    id: "analytics", label: "Analytics & Intelligence", short: "Analytics",
    description: "Consumption, comparisons and AI insights.",
    pages: [
      { slug: "consumption", title: "Consumption analytics", summary: "Usage trends by category, centre and season.", permission: "analytics.read", status: "planned", phase: 3, reads: ["movements", "products"] },
      { slug: "centres", title: "Centre comparison", summary: "Spend and consumption per child across centres.", permission: "analytics.read", status: "planned", phase: 3, reads: ["movements", "budgets", "centres"] },
      { slug: "suppliers", title: "Supplier performance", summary: "On-time, quality and price trends.", permission: "analytics.read", status: "planned", phase: 3, reads: ["suppliers", "purchaseOrders", "receipts"] },
      { slug: "insights", title: "AI insights", summary: "Generated management insights with sources.", permission: "analytics.read", status: "planned", phase: 3, reads: ["aiJobs"] },
    ],
  },
  {
    id: "admin", label: "Administration", short: "Admin",
    description: "Users, centres and configuration.",
    pages: [
      { slug: "dashboard", title: "Administrator dashboard", summary: "Users, roles, catalogue and system status.", permission: "dashboard.admin", status: "implemented", phase: 1, href: "/dashboards/admin", reads: ["users", "centres", "products", "suppliers", "integrations", "audit"] },
      { slug: "users", title: "Users & roles", summary: "Invite users and assign roles and centres.", permission: "admin.users", status: "planned", phase: 2, reads: ["users", "centres"], writes: ["inviteUser", "assignRoles"] },
      { slug: "centres", title: "Centre settings", summary: "Centre master data and budgets.", permission: "admin.config", status: "planned", phase: 2, reads: ["centres"], writes: ["upsertCentre"] },
      { slug: "configuration", title: "Configuration", summary: "Request windows, thresholds and approval rules.", permission: "admin.config", status: "planned", phase: 2, reads: [], writes: ["updateConfig"] },
    ],
  },
  {
    id: "governance", label: "Governance & System", short: "Governance",
    description: "Audit, permissions, integrations and the design system.",
    pages: [
      { slug: "audit", title: "Audit log", summary: "Every state change, who made it and when.", permission: "audit.read", status: "implemented", phase: 1, href: "/governance/audit", reads: ["audit", "users"] },
      { slug: "permissions", title: "Permission matrix", summary: "What each role can do — generated from the code.", permission: "admin.users", status: "implemented", phase: 1, href: "/governance/permissions", reads: [] },
      { slug: "integrations", title: "Integrations", summary: "Database, email, AI and accounting connections.", permission: "admin.config", status: "planned", phase: 2, reads: ["integrations"] },
      { slug: "notifications", title: "Notification rules", summary: "Who is told what, and when.", permission: "admin.config", status: "planned", phase: 2, reads: ["notifications"] },
      { slug: "design-system", title: "Design system", summary: "Live catalogue of every shared component.", permission: "dashboard.admin", status: "implemented", phase: 1, href: "/design-system", reads: [] },
    ],
  },
];

export const visiblePages = (role: Role, group: ModuleGroup) => group.pages.filter((p) => can(role, p.permission));
export const visibleModules = (role: Role) => MODULES.filter((g) => visiblePages(role, g).length > 0);
export const findModule = (id: string) => MODULES.find((g) => g.id === id);
