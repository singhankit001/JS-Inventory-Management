import type { Repository } from "@/lib/data/provider";
import { lastPeriods } from "@/features/dashboards/shared";
import { period } from "@/lib/data/seed";
import { monthLabel, moneyCompact } from "@/lib/format";
import { budgetFor, periodLabel } from "@/features/requests/logic";

export async function loadBudgets(repo: Repository, periodParam?: string) {
  const today = repo.today();
  const [centres, budgets] = await Promise.all([repo.centres(), repo.budgets()]);
  const current = period(today);
  const history = lastPeriods(today, 12);
  const periods = [...history, period(new Date(today.getFullYear(), today.getMonth() + 1, 1))];
  const active = periods.includes(periodParam ?? "") ? periodParam! : current;

  const rows = centres.map((c) => {
    const b = budgetFor(budgets, c, active);
    const used = b.spent + b.committed, left = b.allocated - used;
    return {
      id: c.id, name: c.name, city: c.city, ...b, left, over: left < 0,
      utilisation: b.allocated ? used / b.allocated : 0, spentPct: b.allocated ? b.spent / b.allocated : 0, committedPct: b.allocated ? b.committed / b.allocated : 0,
      detail: `${moneyCompact(b.spent)} spent · ${moneyCompact(b.committed)} committed of ${moneyCompact(b.allocated)}`,
      leftLabel: left >= 0 ? `${moneyCompact(left)} left` : `${moneyCompact(-left)} over`,
    };
  }).sort((a, b) => b.utilisation - a.utilisation);

  const sum = (k: "allocated" | "spent" | "committed") => rows.reduce((s, r) => s + r[k], 0);
  const trend = history.map((p) => {
    const rs = centres.map((c) => budgetFor(budgets, c, p));
    return { label: monthLabel(p), a: rs.reduce((s, b) => s + b.spent + b.committed, 0), b: rs.reduce((s, b) => s + b.allocated, 0) };
  });

  return {
    active, current, label: periodLabel(active),
    // Past months are closed: allocations can only change for this month and next.
    editable: active >= current,
    periods: [...periods].reverse().map((p) => ({ key: p, label: periodLabel(p) })),
    rows,
    totals: { allocated: sum("allocated"), spent: sum("spent"), committed: sum("committed"), over: rows.filter((r) => r.over).length },
    spark: trend.map((t) => (t.b ? t.a / t.b : 0)),
    trend,
  };
}
