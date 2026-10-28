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
  /** Only implemented pages have a route. Detail routes use a `[id]` segment. */
  href?: string;
  /** Short label for the module sub-nav. */
  tab?: string;
  /** false for detail pages reached from a list, never from navigation. */
  nav?: false;
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
    description: "Role workspaces: one command view per job.",
    pages: [
      { slug: "executive", title: "Executive overview", summary: "Consolidated valuation, spend, approvals and insights.", permission: "dashboard.executive", status: "implemented", phase: 1, href: "/dashboards/executive", reads: ["balances", "budgets", "approvals", "purchaseOrders", "suppliers", "movements", "audit"] },
      { slug: "head-office", title: "Head Office command centre", summary: "Request reviews, budgets, POs, discrepancies and invoices.", permission: "dashboard.head_office", status: "implemented", phase: 1, href: "/dashboards/head-office", reads: ["requests", "requestItems", "approvals", "budgets", "purchaseOrders", "receipts", "invoices", "suppliers", "quotations", "products"] },
      { slug: "centre", title: "Centre leader dashboard", summary: "One centre's stock, request deadline, deliveries and alerts.", permission: "dashboard.centre", status: "implemented", phase: 1, href: "/dashboards/centre", reads: ["balances", "counts", "requests", "purchaseOrders", "receipts", "movements"] },
      { slug: "purchasing", title: "Purchasing workspace", summary: "Approved queue, quotations, POs and delays.", permission: "dashboard.purchasing", status: "implemented", phase: 1, href: "/dashboards/purchasing", reads: ["approvals", "quotations", "purchaseOrders", "suppliers"] },
      { slug: "finance", title: "Finance workspace", summary: "Payables, matching, variance and payments.", permission: "dashboard.finance", status: "implemented", phase: 1, href: "/dashboards/finance", reads: ["invoices", "payments", "budgets", "suppliers", "purchaseOrders"] },
      { slug: "receiving", title: "Receiving workspace", summary: "Today's deliveries and quantity verification.", permission: "dashboard.receiving", status: "implemented", phase: 1, href: "/dashboards/receiving", reads: ["purchaseOrders", "purchaseOrderLines", "receipts"] },
      { slug: "admin", title: "Administrator dashboard", summary: "Users, roles, catalogue and system status.", permission: "dashboard.admin", status: "implemented", phase: 1, href: "/dashboards/admin", reads: ["users", "centres", "products", "suppliers", "integrations", "audit"] },
    ],
  },
  {
    id: "inventory", label: "Inventory Management", short: "Inventory",
    description: "Stock across centres, the catalogue, counts, the movement ledger and alerts.",
    pages: [
      { slug: "overview", title: "Inventory overview", summary: "Network-wide stock value, health and category mix.", permission: "inventory.read", status: "implemented", phase: 1, href: "/inventory", tab: "Overview", reads: ["balances", "products", "categories", "centres"] },
      { slug: "centres", title: "Centre inventory", summary: "Per-centre stock with SKU health and movements.", permission: "inventory.read", status: "implemented", phase: 1, href: "/inventory/centres", tab: "Centres", reads: ["centres", "balances", "products", "movements"] },
      { slug: "catalogue", title: "Product catalogue", summary: "Products, categories, units and reorder points.", permission: "inventory.read", status: "implemented", phase: 1, href: "/inventory/catalogue", tab: "Catalogue", reads: ["products", "categories", "uoms", "quotations"] },
      { slug: "counts", title: "Stock counts & reconciliation", summary: "Opening and closing counts with variance to system stock.", permission: "inventory.read", status: "implemented", phase: 1, href: "/inventory/counts", tab: "Counts", reads: ["counts", "balances", "products"], writes: ["submitStockCount"] },
      { slug: "movements", title: "Stock movements ledger", summary: "Receipts, consumption, transfers and adjustments.", permission: "inventory.read", status: "implemented", phase: 1, href: "/inventory/movements", tab: "Movements", reads: ["movements", "products", "centres"] },
      { slug: "alerts", title: "Low stock & expiry alerts", summary: "Items under reorder point and nearing expiry.", permission: "inventory.read", status: "implemented", phase: 1, href: "/inventory/alerts", tab: "Alerts", reads: ["balances", "products", "movements"] },
    ],
  },
  {
    id: "requests", label: "Requests & AI Intake", short: "Requests",
    description: "Monthly and emergency requests, including audio and video intake.",
    pages: [
      { slug: "monthly", title: "Monthly requests", summary: "Request history and status per centre.", permission: "requests.read", status: "implemented", phase: 1, href: "/requests", tab: "Monthly", reads: ["requests", "requestItems", "centres"] },
      { slug: "new", title: "Create request", summary: "Build a request against historical consumption and budget.", permission: "requests.create", status: "implemented", phase: 1, href: "/requests/new", tab: "Create", reads: ["products", "movements", "budgets"], writes: ["saveDraftRequest", "submitRequest"] },
      { slug: "intake", title: "Audio & video intake", summary: "Record or upload a request; AI drafts the line items.", permission: "requests.create", status: "implemented", phase: 1, href: "/requests/intake", tab: "Audio & video", reads: ["aiJobs", "products"], writes: ["uploadMedia", "confirmAIDraft"] },
      { slug: "detail", title: "Request details & revisions", summary: "Line items, revision history and approval timeline.", permission: "requests.read", status: "implemented", phase: 1, href: "/requests/[id]", nav: false, reads: ["requests", "requestItems", "approvals", "audit"] },
      { slug: "emergency", title: "Emergency requests", summary: "Out-of-cycle requests with expedited approval.", permission: "requests.read", status: "implemented", phase: 1, href: "/requests/emergency", tab: "Emergency", reads: ["requests", "requestItems"], writes: ["raiseEmergency"] },
    ],
  },
  {
    id: "approvals", label: "Approvals & Budgets", short: "Approvals",
    description: "Head Office decisions, budgets and escalations.",
    pages: [
      { slug: "queue", title: "Approval queue", summary: "Requests, POs and prices waiting for a decision.", permission: "requests.approve", status: "implemented", phase: 1, href: "/approvals", tab: "Queue", reads: ["approvals", "requests", "purchaseOrders"] },
      { slug: "detail", title: "Approval detail", summary: "Line-level review with budget impact and decision.", permission: "requests.approve", status: "implemented", phase: 1, href: "/approvals/[id]", nav: false, reads: ["approvals", "requests", "requestItems", "budgets"], writes: ["decideApproval"] },
      { slug: "budgets", title: "Budgets & allocations", summary: "Monthly allocation, commitment and spend per centre.", permission: "budgets.read", status: "implemented", phase: 1, href: "/approvals/budgets", tab: "Budgets", reads: ["budgets", "centres"], writes: ["setBudget"] },
      { slug: "exceptions", title: "Exceptions & escalations", summary: "Over-budget, overdue and mismatched items needing attention.", permission: "budgets.read", status: "implemented", phase: 1, href: "/approvals/exceptions", tab: "Exceptions", reads: ["budgets", "approvals", "receipts", "invoices"] },
    ],
  },
  {
    id: "procurement", label: "Procurement & Suppliers", short: "Procurement",
    description: "Quotations, purchase orders and the supplier master.",
    pages: [
      { slug: "pipeline", title: "Procurement pipeline", summary: "Every order from approved request to receipt.", permission: "procurement.read", status: "implemented", phase: 1, href: "/procurement", tab: "Pipeline", reads: ["approvals", "quotations", "purchaseOrders"] },
      { slug: "orders", title: "Purchase orders", summary: "Raise, authorise and track purchase orders.", permission: "procurement.read", status: "implemented", phase: 1, href: "/procurement/orders", tab: "Orders", reads: ["purchaseOrders", "purchaseOrderLines"], writes: ["raisePO", "authorisePO"] },
      { slug: "suppliers", title: "Supplier directory", summary: "Supplier master, categories, terms and performance.", permission: "suppliers.read", status: "implemented", phase: 1, href: "/procurement/suppliers", tab: "Suppliers", reads: ["suppliers"], writes: ["upsertSupplier"] },
      { slug: "compare", title: "Supplier comparison", summary: "Price, lead time and quality side by side.", permission: "procurement.read", status: "implemented", phase: 1, href: "/procurement/compare", tab: "Compare", reads: ["quotations", "suppliers"], writes: ["requestQuotation"] },
      { slug: "history", title: "Purchasing history", summary: "Spend by supplier, category and month.", permission: "procurement.read", status: "implemented", phase: 1, href: "/procurement/history", tab: "History", reads: ["purchaseOrders", "purchaseOrderLines"] },
    ],
  },
  {
    id: "receiving", label: "Delivery & Receiving", short: "Receiving",
    description: "Expected deliveries, goods receipts and discrepancies.",
    pages: [
      { slug: "deliveries", title: "Expected deliveries", summary: "Calendar of incoming orders per centre.", permission: "receiving.read", status: "implemented", phase: 1, href: "/receiving/deliveries", tab: "Deliveries", reads: ["purchaseOrders"] },
      { slug: "receipts", title: "Goods receipt & verification", summary: "Item-level receipts against purchase order lines.", permission: "receiving.read", status: "implemented", phase: 1, href: "/receiving/receipts", tab: "Receipts", reads: ["receipts", "receiptLines"], writes: ["recordGoodsReceipt"] },
      { slug: "discrepancies", title: "Delivery discrepancies", summary: "Shortages, over-deliveries and damage by supplier.", permission: "receiving.read", status: "implemented", phase: 1, href: "/receiving/discrepancies", tab: "Discrepancies", reads: ["receipts", "receiptLines", "suppliers"] },
    ],
  },
  {
    id: "finance", label: "Finance & Invoices", short: "Finance",
    description: "Invoices, three-way matching, payments and reconciliation.",
    pages: [
      { slug: "invoices", title: "Invoice inbox", summary: "Incoming invoices with match status and ageing.", permission: "finance.read", status: "implemented", phase: 1, href: "/finance/invoices", tab: "Invoices", reads: ["invoices"] },
      { slug: "invoice", title: "Invoice detail & matching", summary: "Three-way match against PO and goods receipt lines.", permission: "finance.read", status: "implemented", phase: 1, href: "/finance/invoices/[id]", nav: false, reads: ["invoices", "purchaseOrderLines", "receiptLines"], writes: ["queryInvoice", "approveInvoice"] },
      { slug: "payments", title: "Payments & reconciliation", summary: "Payment runs, remittances and open exceptions.", permission: "finance.read", status: "implemented", phase: 1, href: "/finance/payments", tab: "Payments", reads: ["payments", "invoices"], writes: ["recordPayment"] },
    ],
  },
  {
    id: "analytics", label: "Analytics & Intelligence", short: "Analytics",
    description: "Consumption, forecasting, reports and AI insights.",
    pages: [
      { slug: "overview", title: "Analytics overview", summary: "Spend, consumption and centre comparison.", permission: "analytics.read", status: "implemented", phase: 1, href: "/analytics", tab: "Overview", reads: ["movements", "budgets", "centres"] },
      { slug: "consumption", title: "Consumption & forecasting", summary: "Usage trends by category and centre with a demand forecast.", permission: "analytics.read", status: "implemented", phase: 1, href: "/analytics/consumption", tab: "Consumption", reads: ["movements", "products"] },
      { slug: "reports", title: "Reports & exports", summary: "Prebuilt reports with CSV export.", permission: "analytics.read", status: "implemented", phase: 1, href: "/analytics/reports", tab: "Reports", reads: ["movements", "purchaseOrders", "invoices"] },
      { slug: "insights", title: "AI insights & assistant", summary: "Ten AI capabilities, their findings and the assistant.", permission: "analytics.read", status: "implemented", phase: 1, href: "/analytics/insights", tab: "AI insights", reads: ["aiJobs"] },
    ],
  },
  {
    id: "admin", label: "Administration", short: "Admin",
    description: "Centres, users, roles and configuration.",
    pages: [
      { slug: "users", title: "Centres & users", summary: "Centres, staff assignments and invitations.", permission: "admin.users", status: "implemented", phase: 1, href: "/admin/users", tab: "Centres & users", reads: ["users", "centres"], writes: ["inviteUser", "assignRoles", "upsertCentre"] },
      { slug: "roles", title: "Roles & permissions", summary: "What each role can do — generated from the code.", permission: "admin.users", status: "implemented", phase: 1, href: "/admin/roles", tab: "Roles", reads: [] },
      { slug: "configuration", title: "System configuration", summary: "Request windows, thresholds and approval rules.", permission: "admin.config", status: "implemented", phase: 1, href: "/admin/configuration", tab: "Configuration", reads: [], writes: ["updateConfig"] },
    ],
  },
  {
    id: "governance", label: "Governance & System", short: "Governance",
    description: "Audit trail, integrations and AI job health.",
    pages: [
      { slug: "audit", title: "Audit trail", summary: "Every state change, who made it and when.", permission: "audit.read", status: "implemented", phase: 1, href: "/governance/audit", tab: "Audit trail", reads: ["audit", "users"] },
      { slug: "integrations", title: "Integration & AI job health", summary: "Connections, AI job queue and failures.", permission: "admin.config", status: "implemented", phase: 1, href: "/governance/integrations", tab: "Integrations", reads: ["integrations", "aiJobs"] },
    ],
  },
];

export const visiblePages = (role: Role, group: ModuleGroup) => group.pages.filter((p) => can(role, p.permission));
/** Pages that appear in navigation (excludes detail routes). */
export const navPages = (role: Role, group: ModuleGroup) => visiblePages(role, group).filter((p) => p.nav !== false && p.href);
export const visibleModules = (role: Role) => MODULES.filter((g) => visiblePages(role, g).length > 0);
export const findModule = (id: string) => MODULES.find((g) => g.id === id);
