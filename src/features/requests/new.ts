import type { Repository } from "@/lib/data/provider";
import type { Centre, MonthlyRequest } from "@/domain/types";
import { REQUEST_STATUS, indexBy, outstandingByLine } from "@/features/dashboards/shared";
import { REQUEST_DEADLINE_DAY } from "@/features/dashboards/centre";
import { period } from "@/lib/data/seed";
import { avgMonthlyUse, budgetFor, periodLabel, suggestedQty, type BudgetFigures } from "./logic";

export interface WizardProduct {
  id: string; name: string; sku: string; uom: string; categoryId: string; unitCost: number;
  onHand: number; onOrder: number; avgUse: number; reorderPoint: number; suggested: number;
}
const OPEN_PO = ["draft", "awaiting_authorisation", "issued", "partially_received"];

/** Catalogue with each product's stock, open orders, 3-month use and suggested quantity at one centre. Pantry runs on its own fortnightly cycle. */
export async function centreProducts(repo: Repository, centreId: string) {
  const [products, categories, uoms, balances, movements, pos, poLines, receiptLines] = await Promise.all([
    repo.products(), repo.categories(), repo.uoms(), repo.balances(), repo.movements(), repo.purchaseOrders(), repo.purchaseOrderLines(), repo.receiptLines(),
  ]);
  const uom = indexBy(uoms, "id");
  const open = new Set(pos.filter((p) => p.centreId === centreId && OPEN_PO.includes(p.status)).map((p) => p.id));
  const lines = poLines.filter((l) => open.has(l.purchaseOrderId));
  const owed = outstandingByLine(lines, receiptLines);
  const onOrder = new Map<string, number>();
  for (const l of lines) onOrder.set(l.productId, (onOrder.get(l.productId) ?? 0) + owed.get(l.id)!);
  const use = avgMonthlyUse(movements.filter((m) => m.centreId === centreId), repo.today());
  const list: WizardProduct[] = products.filter((p) => p.status === "active" && p.categoryId !== "cat-pan").map((p) => {
    const onHand = balances.find((b) => b.centreId === centreId && b.productId === p.id)?.onHand ?? 0;
    const avgUse = Math.round((use.get(`${centreId}:${p.id}`) ?? 0) * 10) / 10;
    return {
      id: p.id, name: p.name, sku: p.sku, uom: uom.get(p.uomId)?.code ?? "", categoryId: p.categoryId, unitCost: p.unitCost,
      onHand, onOrder: onOrder.get(p.id) ?? 0, avgUse, reorderPoint: p.reorderPoint, suggested: suggestedQty(avgUse, onHand, onOrder.get(p.id) ?? 0, p.reorderPoint),
    };
  });
  return { products: list, categories: categories.filter((c) => list.some((p) => p.categoryId === c.id)).map((c) => ({ id: c.id, name: c.name })) };
}

export type NewRequestState =
  | { kind: "blocked"; title: string; body: string; actions: { label: string; href: string }[] }
  | {
    kind: "form"; centre: Pick<Centre, "id" | "name">; centres: { id: string; name: string }[]; period: string; periodLabel: string;
    periods: { key: string; label: string; taken?: string }[]; edit?: { id: string; status: MonthlyRequest["status"] };
    initial: Record<string, number>; budget: BudgetFigures; deadline: string;
  } & Awaited<ReturnType<typeof centreProducts>>;

export async function loadNewRequest(repo: Repository, q: { centre?: string; period?: string; edit?: string }): Promise<NewRequestState> {
  const today = repo.today();
  const [centres, requests, items, budgets] = await Promise.all([repo.centres(), repo.requests(), repo.requestItems(), repo.budgets()]);
  const edit = q.edit ? requests.find((r) => r.id === q.edit) : undefined;
  if (q.edit && !edit) return { kind: "blocked", title: "Request not found", body: "It may belong to a centre outside your assignment.", actions: [{ label: "Monthly requests", href: "/requests" }] };
  if (edit && edit.status !== "draft" && edit.status !== "revision_requested") {
    return { kind: "blocked", title: `This request is ${REQUEST_STATUS[edit.status].label.toLowerCase()}`, body: "Only drafts and requests returned for revision can be edited.", actions: [{ label: "Open request", href: `/requests/${edit.id}` }] };
  }
  const centre = centres.find((c) => c.id === (edit?.centreId ?? q.centre)) ?? centres[0];
  if (!centre) return { kind: "blocked", title: "No centre assigned", body: "Ask an administrator to assign you to a centre.", actions: [] };

  const routine = (p: string) => requests.find((r) => r.centreId === centre.id && r.period === p && r.priority === "routine");
  const options = [period(today), period(new Date(today.getFullYear(), today.getMonth() + 1, 1))];
  const chosen = edit?.period ?? (options.includes(q.period ?? "") ? q.period! : options.find((p) => !routine(p)) ?? options[0]!);
  const taken = !edit && routine(chosen);
  if (taken) {
    const open = taken.status === "draft" || taken.status === "revision_requested";
    const other = options.find((p) => !routine(p));
    return {
      kind: "blocked", title: `${centre.name} already has a ${periodLabel(chosen)} request`,
      body: `One routine request per centre per month. This one is ${REQUEST_STATUS[taken.status].label.toLowerCase()}${open ? " — continue it instead of starting again." : "; use an emergency request for anything urgent."}`,
      actions: [
        open ? { label: "Continue that request", href: `/requests/new?edit=${taken.id}` } : { label: "Open that request", href: `/requests/${taken.id}` },
        ...(other ? [{ label: `Plan ${periodLabel(other)} instead`, href: `/requests/new?centre=${centre.id}&period=${other}` }] : []),
        { label: "Emergency request", href: "/requests/emergency" },
      ],
    };
  }

  const catalogue = await centreProducts(repo, centre.id);
  const initial = edit
    ? Object.fromEntries(items.filter((i) => i.requestId === edit.id).map((i) => [i.productId, i.proposedQty]))
    : {};
  const due = new Date(Number(chosen.slice(0, 4)), Number(chosen.slice(5)) - 1, REQUEST_DEADLINE_DAY);
  return {
    kind: "form", ...catalogue, centre: { id: centre.id, name: centre.name }, centres: centres.map((c) => ({ id: c.id, name: c.name })),
    period: chosen, periodLabel: periodLabel(chosen), edit: edit && { id: edit.id, status: edit.status },
    periods: options.map((p) => ({ key: p, label: periodLabel(p), taken: routine(p) && routine(p)!.id !== edit?.id ? REQUEST_STATUS[routine(p)!.status].label : undefined })),
    initial, budget: budgetFor(budgets, centre, chosen), deadline: due.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  };
}
