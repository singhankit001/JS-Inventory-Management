"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { setBudget } from "@/app/actions/approvals";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";
import { money } from "@/lib/format";

export interface BudgetRow { id: string; name: string; allocated: number; spent: number; committed: number }
const MAX_RUPEES = 1_00_00_000; // ₹1 crore per centre per month — far above any real allocation, catches typos.

/** "Adjust allocation" for one centre and period (budgets.manage only; the action re-checks). */
export function BudgetDialog({ rows, period, periodLabel }: { rows: BudgetRow[]; period: string; periodLabel: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [centreId, setCentreId] = useState(rows[0]?.id ?? "");
  const row = rows.find((r) => r.id === centreId);
  const [amount, setAmount] = useState(row ? String(row.allocated / 100) : "");
  const [error, setError] = useState<string>();
  const rupees = Number(amount.replace(/[,\s₹]/g, ""));
  const used = row ? row.spent + row.committed : 0;
  const below = row && Number.isFinite(rupees) && rupees * 100 < used;

  const pick = (id: string) => { setCentreId(id); setAmount(String((rows.find((r) => r.id === id)?.allocated ?? 0) / 100)); setError(undefined); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = !amount.trim() || !Number.isInteger(rupees) ? "Enter whole rupees, e.g. 85000." : rupees <= 0 ? "The allocation must be above zero." : rupees > MAX_RUPEES ? `That is more than ${money(MAX_RUPEES * 100)} — check the number.` : undefined;
    setError(invalid);
    if (invalid) return;
    start(async () => {
      try {
        const res = await setBudget({ centreId, period, allocated: rupees * 100 });
        if (!res.ok) { setError(res.error); toast({ tone: "error", title: "Allocation not changed", body: res.error }); return; }
        toast({ tone: "success", title: "Allocation updated", body: res.message });
        setOpen(false);
      } catch { toast({ tone: "error", title: "Allocation not changed", body: "The server could not be reached. Try again." }); }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="primary"><SlidersHorizontal />Adjust allocation</Button></DialogTrigger>
      <DialogContent title={`Adjust allocation · ${periodLabel}`} description="Changes one centre's monthly budget. Saved to demo data (resets daily) and recorded in the audit trail.">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Centre">{(a) => <Select {...a} value={centreId} onChange={(e) => pick(e.target.value)}>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}</Field>
          <Field label="Allocation (₹)" error={error}
            hint={row ? (below ? `Below the ${money(used)} already spent and committed — the centre will show as over budget.` : `Now ${money(row.allocated)} · ${money(used)} spent and committed`) : undefined}>
            {(a) => <Input {...a} inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value); setError(undefined); }} className="tabular" />}
          </Field>
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button>Cancel</Button></DialogClose>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save allocation"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
