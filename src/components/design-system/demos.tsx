"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, PlannedAction, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { PillGroup } from "@/components/ui/pill-group";
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Combobox, Field, FileDrop, Input, QuantityInput, SearchInput, Select } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";

/** Remounts its children so CSS enter animations and count-ups play again. */
export function Replay({ label, children }: { label: string; children: React.ReactNode }) {
  const [n, setN] = useState(0);
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setN(n + 1)} aria-label={`Replay ${label} animations`}><RotateCcw />Replay</Button>
      </div>
      <div key={n}>{children}</div>
    </div>
  );
}

const variants: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const sizes: ButtonSize[] = ["sm", "md"];

export function ButtonDemo() {
  const toast = useToast();
  return (
    <div className="grid gap-3">
      {sizes.map((s) => (
        <div key={s} className="flex flex-wrap items-center gap-2">
          <span className="w-8 text-label text-ink-3">{s}</span>
          {variants.map((v) => <Button key={v} variant={v} size={s} onClick={() => toast({ tone: "info", title: `${v} · ${s} pressed` })}>{v[0]!.toUpperCase() + v.slice(1)}</Button>)}
          <Button size={s} disabled>Disabled</Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2"><span className="w-8 text-label text-ink-3">later</span><PlannedAction label="Raise purchase order" /><PlannedAction label="AI intake" phase={3} /></div>
    </div>
  );
}

const views = [{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }, { key: "year", label: "Year" }];

export function SegmentedDemo() {
  const [active, setActive] = useState("week");
  return (
    <div className="grid gap-3">
      <PillGroup ariaLabel="Sample period" items={views} activeKey={active} onSelect={setActive} />
      <p className="text-label text-ink-3" aria-live="polite">Selected: <b className="font-medium text-ink">{views.find((v) => v.key === active)?.label}</b> · arrow keys move between tabs</p>
    </div>
  );
}

const products = [
  { id: "p1", label: "Crayons (12 pack)", hint: "Art" },
  { id: "p2", label: "Hand wash 500 ml", hint: "Hygiene" },
  { id: "p3", label: "Building blocks (100)", hint: "Play" },
  { id: "p4", label: "First-aid refill kit", hint: "Safety" },
];

export function FormDemo() {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(12);
  const [product, setProduct] = useState<string>();
  const [query, setQuery] = useState("");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Request title" hint="Shown to Head Office" error={name.length > 0 && name.length < 3 ? "Use at least 3 characters" : undefined}>
        {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} placeholder="November top-up" />}
      </Field>
      <Field label="Category">
        {(a) => <Select {...a} defaultValue="art"><option value="art">Art & craft</option><option value="hygiene">Hygiene</option><option value="play">Play</option></Select>}
      </Field>
      <Field label="Product" hint="Type to filter, arrow keys to choose">
        {(a) => <Combobox {...a} options={products} value={product} onChange={setProduct} />}
      </Field>
      <Field label="Quantity">
        {(a) => <QuantityInput {...a} value={qty} onChange={setQty} />}
      </Field>
      <Field label="Search">
        {(a) => <SearchInput {...a} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />}
      </Field>
      <Field label="Delivery note" hint="Files stay in your browser — nothing is uploaded">
        {(a) => <FileDrop {...a} accept="image/*,application/pdf" onFiles={() => {}} />}
      </Field>
    </div>
  );
}

export function DialogDemo() {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger asChild><Button variant="primary" size="sm">Open dialog</Button></DialogTrigger>
        <DialogContent title="Sample dialog" description="Focus is trapped here; Escape or the close button returns it to the trigger.">
          <div className="flex justify-end"><DialogClose asChild><Button size="sm">Close</Button></DialogClose></div>
        </DialogContent>
      </Dialog>
      <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>Confirm dialog</Button>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Reject this request?" body="Sample only — nothing is changed." confirmLabel="Reject" destructive onConfirm={() => toast({ tone: "error", title: "Request rejected", body: "Sample toast — no data changed." })} />
      <Button size="sm" onClick={() => toast({ tone: "success", title: "Receipt recorded", body: "Sample success toast." })}>Success toast</Button>
      <Button size="sm" onClick={() => toast({ tone: "info", title: "Count due Friday", body: "Sample info toast." })}>Info toast</Button>
    </div>
  );
}
