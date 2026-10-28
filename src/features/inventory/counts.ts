import type { Repository } from "@/lib/data/provider";
import type { StockCount } from "@/domain/types";
import type { Machine } from "@/domain/workflows";
import type { Tone } from "@/components/ui/badge";
import type { Row } from "@/components/data/data-table";
import type { Step } from "@/components/ui/stepper";
import { indexBy, lastPeriods } from "@/features/dashboards/shared";
import { closingCountDue } from "@/features/dashboards/centre";
import { period } from "@/lib/data/seed";
import { count, money, monthLabel, shortDate } from "@/lib/format";
import { countVariances, isCountAdjustment, signedQty, stockKey } from "./stock";

/**
 * Stock count lifecycle. shortcut: lives here because domain/workflows has no stock-count machine yet; it uses the same
 * Machine/transition contract so it can move into domain/workflows unchanged.
 */
export const STOCK_COUNT: Machine<StockCount["status"], "submit"> = {
  name: "stock count",
  commands: { submit: { from: ["not_started", "in_progress"], to: "submitted", permission: "inventory.count" } },
};

export const COUNT_STATUS: Record<StockCount["status"], { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "blue" },
  submitted: { label: "Submitted", tone: "green" },
};

export interface CountFormCentre {
  centreId: string; centre: string; period: string; kind: StockCount["kind"];
  lines: { productId: string; name: string; sku: string; category: string; uom: string; system: number; unitCost: number }[];
}

export async function loadCounts(repo: Repository, canCount: boolean) {
  const today = repo.today();
  const thisPeriod = period(today);
  const [centres, products, categories, uoms, balances, movements, counts, users] = await Promise.all([
    repo.centres(), repo.products(), repo.categories(), repo.uoms(), repo.balances(), repo.movements(), repo.counts(), repo.users(),
  ]);
  const pmap = indexBy(products, "id"), cats = indexBy(categories, "id"), units = indexBy(uoms, "id"), cmap = indexBy(centres, "id");
  const onHand = new Map(balances.map((b) => [stockKey(b.centreId, b.productId), b.onHand]));
  const current = counts.filter((c) => c.period === thisPeriod);
  const find = (centreId: string, kind: StockCount["kind"]) => current.find((c) => c.centreId === centreId && c.kind === kind);

  const variances = countVariances(movements, onHand).sort((a, b) => b.movement.occurredAt.localeCompare(a.movement.occurredAt));
  // Count adjustments are referenced count-<CODE>-<YYYY-MM>; the period is the month that was counted.
  const periodOf = (ref: string) => ref.slice(-7);
  const thisMonth = variances.filter((v) => periodOf(v.movement.reference!) === thisPeriod);

  const statusRows = centres.map((c) => {
    const o = find(c.id, "opening"), cl = find(c.id, "closing");
    const mine = thisMonth.filter((v) => v.movement.centreId === c.id);
    return {
      id: c.id,
      name: c.name,
      opening: COUNT_STATUS[o?.status ?? "not_started"],
      closing: COUNT_STATUS[cl?.status ?? "not_started"],
      submitted: cl?.submittedAt ?? o?.submittedAt ?? null,
      lines: mine.length,
      variance: mine.reduce((s, v) => s + v.variance * (pmap.get(v.movement.productId)?.unitCost ?? 0), 0),
    };
  });

  // Reconciliation per centre and month, at unit cost: opening + receipts − consumption ± count discrepancy = closing.
  // Every figure is rebuilt from the movement ledger, so it agrees with on-hand stock and the variance history.
  const cost = (productId: string) => pmap.get(productId)?.unitCost ?? 0;
  const leaderOf = (centreId: string) => users.find((u) => u.roles.includes("centre_leader") && u.centreIds.includes(centreId))?.name ?? null;
  const reconPeriods = lastPeriods(today, 3);
  // Parse each timestamp once and bucket by centre: the ledger holds tens of thousands of movements.
  const time = new Map(movements.map((m) => [m.id, new Date(m.occurredAt).getTime()]));
  const byCentre = new Map<string, typeof movements>();
  for (const m of movements) (byCentre.get(m.centreId) ?? byCentre.set(m.centreId, []).get(m.centreId)!).push(m);
  const reconRows: Row[] = centres.flatMap((c) => {
    const moves = byCentre.get(c.id) ?? [];
    const nowValue = balances.filter((b) => b.centreId === c.id).reduce((s, b) => s + b.onHand * cost(b.productId), 0);
    return reconPeriods.map((per) => {
      const [y, mo] = per.split("-").map(Number);
      const start = new Date(y!, mo! - 1, 1).getTime(), end = new Date(y!, mo!, 1).getTime();
      const at = (m: { id: string }) => time.get(m.id)!;
      const value = (m: (typeof moves)[number]) => signedQty(m) * cost(m.productId);
      const inP = moves.filter((m) => at(m) >= start && at(m) < end);
      const opening = nowValue - moves.filter((m) => at(m) >= start).reduce((s, m) => s + value(m), 0);
      const receipts = inP.filter((m) => m.type === "receipt" || m.type === "transfer_in").reduce((s, m) => s + value(m), 0);
      const consumption = -inP.filter((m) => m.type === "consumption" || m.type === "transfer_out").reduce((s, m) => s + value(m), 0);
      const adjustments = inP.filter(isCountAdjustment);
      const discrepancy = adjustments.reduce((s, m) => s + value(m), 0);
      const isCurrent = per === thisPeriod;
      const closingCount = isCurrent ? find(c.id, "closing") : undefined;
      const closed = !isCurrent || closingCount?.status === "submitted";
      const status = !isCurrent
        ? { label: adjustments.length ? "Reconciled" : "Verified · no variance", tone: "green" as Tone }
        : COUNT_STATUS[closingCount?.status ?? "not_started"];
      const lastAt = [...inP.map((m) => m.occurredAt), closingCount?.submittedAt, isCurrent ? find(c.id, "opening")?.submittedAt : undefined].filter(Boolean).sort().at(-1) ?? null;
      return {
        id: `${c.id}-${per}`,
        centre: { label: c.name, href: `/inventory/centres/${c.id}` },
        period: `${monthLabel(per)} ${per.slice(0, 4)}`,
        opening, receipts,
        closing: closed ? opening + inP.reduce((s, m) => s + value(m), 0) : null,
        consumption, discrepancy: closed ? discrepancy : null,
        submittedBy: closed || closingCount?.status === "in_progress" ? leaderOf(c.id) : null,
        status, updated: lastAt,
      };
    });
  }).sort((a, b) => String(b.id).slice(-7).localeCompare(String(a.id).slice(-7)));

  const n = centres.length;
  const openingDone = centres.filter((c) => find(c.id, "opening")?.status === "submitted").length;
  const closingDone = centres.filter((c) => find(c.id, "closing")?.status === "submitted").length;
  const closingStarted = centres.filter((c) => find(c.id, "closing")?.status === "in_progress").length;
  const due = closingCountDue(today);
  const single = n === 1 ? centres[0] : undefined;
  const stepState = (done: number, started = 0): Step["state"] => (done === n ? "done" : done > 0 || started > 0 ? "current" : "upcoming");
  const steps: Step[] = [
    { label: "Opening count", state: stepState(openingDone), detail: single ? COUNT_STATUS[find(single.id, "opening")?.status ?? "not_started"].label : `${openingDone} of ${n} submitted`, at: single && find(single.id, "opening")?.submittedAt ? shortDate(find(single.id, "opening")!.submittedAt!) : undefined },
    { label: "Closing count", state: stepState(closingDone, closingStarted), detail: single ? COUNT_STATUS[find(single.id, "closing")?.status ?? "not_started"].label : `${closingDone} submitted · ${closingStarted} in progress`, at: `Due ${shortDate(due.toISOString())}` },
    { label: "Variances posted", state: stepState(closingDone), detail: `${thisMonth.length} adjustment${thisMonth.length === 1 ? "" : "s"} this month` },
  ];

  const varianceRows: Row[] = variances.map((v) => {
    const p = pmap.get(v.movement.productId)!;
    return {
      id: v.movement.id,
      period: monthLabel(periodOf(v.movement.reference!)) + " " + periodOf(v.movement.reference!).slice(0, 4),
      centre: { label: cmap.get(v.movement.centreId)?.name ?? v.movement.centreId, href: `/inventory/centres/${v.movement.centreId}` },
      product: { label: p.name, href: `/inventory/catalogue?q=${p.sku}` },
      system: v.system,
      counted: v.counted,
      variance: v.variance,
      value: v.variance * p.unitCost,
    };
  });

  // Forms only for centres where this user may count and a count for this month is still open (opening before closing).
  const forms: CountFormCentre[] = canCount ? centres.flatMap((c) => {
    const open = (["opening", "closing"] as const).map((k) => find(c.id, k)).find((x) => x && x.status !== "submitted");
    if (!open) return [];
    return [{
      centreId: c.id, centre: c.name, period: thisPeriod, kind: open.kind,
      lines: balances.filter((b) => b.centreId === c.id).map((b) => {
        const p = pmap.get(b.productId)!;
        return { productId: p.id, name: p.name, sku: p.sku, category: cats.get(p.categoryId)?.name ?? "—", uom: units.get(p.uomId)?.code ?? p.uomId, system: b.onHand, unitCost: p.unitCost };
      }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    }];
  }) : [];

  const netValue = thisMonth.reduce((s, v) => s + v.variance * (pmap.get(v.movement.productId)?.unitCost ?? 0), 0);
  return {
    period: thisPeriod, periodLabel: `${monthLabel(thisPeriod)} ${thisPeriod.slice(0, 4)}`, due: shortDate(due.toISOString()),
    steps, statusRows, varianceRows, reconRows, forms,
    progress: { openingDone, closingDone, closingStarted, n },
    summary: { lines: thisMonth.length, units: thisMonth.reduce((s, v) => s + v.variance, 0), value: netValue, valueLabel: money(netValue), shrinkLines: count(variances.filter((v) => v.variance < 0).length) },
  };
}
