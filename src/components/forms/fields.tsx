"use client";

import { ChevronDown, Minus, Plus, Search, Upload } from "lucide-react";
import { useId, useMemo, useRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "h-10 w-full rounded-control border border-line-strong/80 bg-surface px-3.5 text-body text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-200 outline-none focus:border-focus focus:ring-4 focus:ring-focus/15 aria-[invalid=true]:border-red aria-[invalid=true]:ring-red/15 disabled:opacity-50";

/** Label + control + hint/error. Wires aria-describedby and aria-invalid for its child via render prop. */
export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; className?: string;
  children: (a11y: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-label font-medium text-ink-2">{label}</label>
      {children({ id, "aria-describedby": error || hint ? msgId : undefined, "aria-invalid": error ? true : undefined })}
      {(error || hint) && (
        <p id={msgId} role={error ? "alert" : undefined} className={cn("text-[12px]", error ? "text-red" : "text-ink-3")}>{error ?? hint}</p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function DateInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  // Native date input: full keyboard + screen-reader support and a platform picker on mobile.
  return <Input type="date" {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(control, "appearance-none pr-9", className)} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" />
    </div>
  );
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
      <input type="search" className={cn(control, "h-9 rounded-full pl-9.5")} {...props} />
    </div>
  );
}

export function QuantityInput({ value, onChange, min = 0, max = 99_999, id, ...a11y }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min));
  const step = "grid size-10 shrink-0 place-items-center text-ink-2 hover:bg-surface-2 disabled:opacity-40";
  return (
    <div className="flex h-10 w-full max-w-40 items-center overflow-hidden rounded-control border border-line-strong/80 bg-surface focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15">
      <button type="button" className={step} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease"><Minus className="size-4" /></button>
      <input
        id={id}
        inputMode="numeric"
        className="h-full w-full min-w-0 bg-transparent text-center text-body font-medium tabular outline-none"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value.replace(/\D/g, ""))))}
        {...a11y}
      />
      <button type="button" className={step} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Increase"><Plus className="size-4" /></button>
    </div>
  );
}

/** ARIA 1.2 combobox with list filtering and arrow-key navigation. */
export function Combobox<T extends { id: string; label: string; hint?: string }>({ options, value, onChange, placeholder = "Search…", id, ...a11y }: {
  options: T[]; value: string | undefined; onChange: (id: string) => void; placeholder?: string; id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())).slice(0, 50), [options, query]);
  const choose = (o: T | undefined) => {
    if (!o) return;
    onChange(o.id);
    setQuery("");
    setOpen(false);
  };
  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
        className={control}
        placeholder={selected?.label ?? placeholder}
        value={open ? query : selected?.label ?? ""}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open) { e.preventDefault(); choose(filtered[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        {...a11y}
      />
      {open && (
        <ul id={listId} role="listbox" className="animate-pop absolute z-40 mt-1.5 max-h-64 w-full overflow-y-auto rounded-[16px] border border-line bg-surface p-1 shadow-pop">
          {filtered.length === 0 && <li className="px-3 py-2 text-label text-ink-3">No matches</li>}
          {filtered.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={o.id === value}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center justify-between rounded-[10px] px-3 py-2 text-body", i === active && "bg-surface-2")}
            >
              <span>{o.label}</span>
              {o.hint && <span className="text-label text-ink-3">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FileDrop({ accept, onFiles, label = "Drop a file or browse", id, ...a11y }: {
  accept?: string; onFiles: (files: File[]) => void; label?: string; id?: string; "aria-describedby"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    setNames(files.map((f) => f.name));
    onFiles(files);
  };
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-tile border border-dashed border-line-strong px-4 py-6 text-center transition-colors", over && "border-focus bg-blue-soft/40")}
    >
      <Upload className="size-5 text-ink-3" />
      <span className="text-label text-ink-2">{names.length ? names.join(", ") : label}</span>
      <input ref={ref} id={id} type="file" accept={accept} className="sr-only" onChange={(e) => take(e.target.files)} {...a11y} />
    </label>
  );
}
