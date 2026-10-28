"use client";

import { useState, useTransition } from "react";
import { CalendarRange, RotateCcw, Save, Scale } from "lucide-react";
import { COMMANDS } from "@/domain/commands";
import { updateConfig } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";
import { configPatch, ordinal, toForm, type ConfigFormValues as Form, type EditableConfig } from "@/features/admin/config";

export function ConfigForm({ saved, defaults }: { saved: EditableConfig; defaults: EditableConfig }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(saved));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const patch = configPatch(form, saved);
  const dirty = Object.keys(patch).length > 0;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = COMMANDS.updateConfig.safeParse(patch);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const key = i.path[0] === "requestWindow" ? "requestWindow" : String(i.path[0] ?? "form");
        out[key] ??= key === "criticalApprovalThreshold" ? "Enter a whole rupee amount, 0 or more" : key === "requestWindow" && i.path.length > 1 ? "Use a day between 1 and 28" : i.message;
      }
      return setErrors(out);
    }
    setErrors({});
    start(async () => {
      const res = await updateConfig(patch);
      if (!res.ok) return void toast({ tone: "error", title: "Couldn't save configuration", body: res.error });
      toast({ tone: "success", title: res.message });
    });
  };
  const opens = Number(form.opensOnDay), closes = Number(form.closesOnDay);

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-label="System configuration">
      <Card aria-labelledby="cfg-window">
        <CardHeader id="cfg-window" icon={CalendarRange} title="Request window" subtitle={`Default: opens on the ${ordinal(defaults.opensOnDay)}, due on the ${ordinal(defaults.closesOnDay)}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens on day" hint="1–28 of each month">
            {(a) => <Input {...a} type="number" inputMode="numeric" min={1} max={28} value={form.opensOnDay} onChange={set("opensOnDay")} aria-invalid={!!errors.requestWindow || undefined} />}
          </Field>
          <Field label="Deadline day" hint="Centre leaders see a countdown to this day">
            {(a) => <Input {...a} type="number" inputMode="numeric" min={1} max={28} value={form.closesOnDay} onChange={set("closesOnDay")} aria-invalid={!!errors.requestWindow || undefined} />}
          </Field>
        </div>
        {errors.requestWindow
          ? <p role="alert" className="mt-3 text-[12px] text-red">{errors.requestWindow}</p>
          : form.opensOnDay && form.closesOnDay && Number.isInteger(opens) && Number.isInteger(closes) && opens < closes && <p className="mt-3 text-label text-ink-3">Requests for next month open on the {ordinal(opens)} and are due by the {ordinal(closes)}.</p>}
      </Card>

      <Card aria-labelledby="cfg-approvals">
        <CardHeader id="cfg-approvals" icon={Scale} title="Approval thresholds" subtitle="Amounts in rupees" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Critical approval above (₹)" hint={`Flags the approval red in every queue. Default ₹${(defaults.criticalApprovalThreshold / 100).toLocaleString("en-IN")}`} error={errors.criticalApprovalThreshold}>
            {(a) => <Input {...a} type="number" inputMode="numeric" min={0} step={1} value={form.criticalApprovalThreshold} onChange={set("criticalApprovalThreshold")} />}
          </Field>
          <div className="grid content-start gap-1.5">
            <span className="text-label font-medium text-ink-2">PO authorisation above (₹)</span>
            <p className="flex h-10 items-center gap-2 rounded-control bg-surface-2 px-3.5 text-body text-ink-2 tabular">25,000 <StatusBadge>Read-only</StatusBadge></p>
            <p className="text-[12px] text-ink-3">Not in the updateConfig command yet, so it can&apos;t be saved.</p>
          </div>
        </div>
      </Card>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-end gap-2 rounded-card border border-line bg-surface/90 p-3 shadow-float backdrop-blur-xl lg:bottom-4">
        <span className="mr-auto pl-2 text-label text-ink-3" aria-live="polite">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <Button disabled={!dirty || pending} onClick={() => { setForm(toForm(saved)); setErrors({}); }}><RotateCcw />Reset</Button>
        <Button type="submit" variant="primary" disabled={!dirty || pending}><Save />{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
