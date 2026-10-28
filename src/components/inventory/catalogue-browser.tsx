"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DataTable, type Column, type Row } from "@/components/data/data-table";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import { Eyebrow, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Sparkline } from "@/components/charts/svg";
import { count } from "@/lib/format";
import type { ProductDetail } from "@/features/inventory/catalogue";

const columns: Column[] = [
  { key: "sku", header: "SKU", hideBelow: "sm" },
  { key: "name", header: "Product", kind: "link" },
  { key: "category", header: "Category", hideBelow: "md" },
  { key: "uom", header: "Unit", hideBelow: "lg" },
  { key: "unitCost", header: "Unit cost", kind: "money", align: "right" },
  { key: "reorder", header: "Reorder at", kind: "count", align: "right", hideBelow: "md" },
  { key: "status", header: "Status", kind: "badge", hideBelow: "sm" },
  { key: "bestQuote", header: "Best quote", kind: "money", align: "right", hideBelow: "lg" },
];

/** Catalogue table + product drawer. `?product=<id>` opens the drawer (shareable); in-page clicks open it without a round trip. */
export function CatalogueBrowser({ rows, details }: { rows: Row[]; details: ProductDetail[] }) {
  const params = useSearchParams();
  const [openId, setOpenId] = useState(() => params.get("product") ?? undefined);
  const p = details.find((d) => d.id === openId);

  const setProduct = (id?: string) => {
    setOpenId(id);
    const q = new URLSearchParams(window.location.search);
    if (id) q.set("product", id); else q.delete("product");
    window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
  };
  // Product names are real links (new tab, no JS); a plain click opens the drawer in place and keeps search and filters.
  const onClickCapture = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="product="]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setProduct(new URL(a.href).searchParams.get("product") ?? undefined);
  };

  return (
    <div onClickCapture={onClickCapture}>
      <DataTable columns={columns} rows={rows} label="Product catalogue" filters={[{ key: "category", label: "category" }, { key: "status", label: "status" }]}
        pageSize={12} exportName="product-catalogue" emptyTitle="No products in the catalogue" />
      <Dialog open={!!p} onOpenChange={(o) => !o && setProduct(undefined)}>
        {p && (
          <DrawerContent title={p.name} description={`${p.sku} · ${p.category} · ${p.uom}`}>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Unit cost" value={p.unitCost} />
              <StatTile label="Reorder at" value={p.reorderPoint} />
              <StatTile label="On hand" value={count(p.totalOnHand)} />
            </div>

            <section aria-label="Consumption trend" className="mt-5 rounded-tile bg-surface-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div><Eyebrow>Consumption · 12 months</Eyebrow><p className="mt-1 text-label text-ink-2">{p.usageLabel}</p></div>
                <Sparkline data={p.usage} tone="blue" label={`${p.name} units used per month`} />
              </div>
            </section>

            <Eyebrow className="mt-6 mb-2">Stock across centres · {p.centresBelow} at or below reorder</Eyebrow>
            {p.stock.length === 0 ? <EmptyState title="Not stocked in your centres" className="py-6" /> : (
              <ul className="grid gap-1" aria-label={`${p.name} stock by centre`}>
                {p.stock.map((s) => (
                  <li key={s.centreId} className="flex items-center gap-3 rounded-[12px] px-2 py-1.5 hover:bg-surface-2">
                    <Link href={`/inventory/centres/${s.centreId}`} className="min-w-0 flex-1 truncate text-body underline-offset-4 hover:underline">{s.centre}</Link>
                    <span className="text-body font-medium tabular">{count(s.onHand)}</span>
                    <StatusBadge tone={s.state.tone} dot className="w-[84px] justify-center">{s.state.label}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}

            <Eyebrow className="mt-6 mb-2">Supplier quotations</Eyebrow>
            {p.quotes.length === 0 ? <EmptyState title="No quotations yet" body="Purchasing can request quotes from Supplier comparison." className="py-6" /> : (
              <ul className="grid gap-2" aria-label={`${p.name} quotations`}>
                {p.quotes.map((q) => (
                  <li key={q.id} className="flex items-center gap-3 rounded-tile bg-surface-2 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/procurement/suppliers?supplier=${q.supplierId}`} className="block truncate text-body font-medium underline-offset-4 hover:underline">{q.supplier}</Link>
                      <p className="text-[12px] text-ink-3">{q.expired ? "Expired" : "Valid until"} {q.validUntil}</p>
                    </div>
                    <span className="text-body font-medium tabular">{q.price}</span>
                    <StatusBadge tone={q.status.tone}>{q.status.label}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/inventory/movements?q=${encodeURIComponent(p.name)}`} className="text-label text-ink-2 underline-offset-4 hover:text-ink hover:underline">Movements for this product ›</Link>
              <Link href={`/procurement/compare?q=${p.sku}`} className="ml-auto text-label text-ink-2 underline-offset-4 hover:text-ink hover:underline">Compare suppliers ›</Link>
            </div>
          </DrawerContent>
        )}
      </Dialog>
    </div>
  );
}
