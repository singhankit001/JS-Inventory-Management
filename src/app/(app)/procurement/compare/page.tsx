import type { Metadata } from "next";
import Link from "next/link";
import { BadgeIndianRupee, Columns3, Send } from "lucide-react";
import { requirePermission, scopedRepository } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { loadCompare } from "@/features/procurement/compare";
import { ModulePageHeader } from "@/components/shell/module-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ParamSelect } from "@/components/procurement/param-select";
import { UrlDrawer } from "@/components/procurement/url-drawer";
import { RequestQuoteForm } from "@/components/procurement/request-quote-form";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Supplier comparison" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ centre?: string; product?: string; category?: string; request?: string }> }) {
  const session = await requirePermission("procurement.read");
  const sp = await searchParams;
  const { repo } = scopedRepository(session, sp.centre);
  const d = await loadCompare(repo, sp);
  const v = d.view;
  const canRequest = can(session.role, "procurement.manage");
  const m = v.matrix;
  const best = m.suppliers.find((s) => s.best);

  return (
    <>
      <ModulePageHeader role={session.role} module="procurement" active="compare" title="Supplier comparison"
        description="Price, lead time and delivery record side by side, from live quotations and our own receipts."
        aside={canRequest ? <Link href={`?${new URLSearchParams({ ...(d.productId ? { product: d.productId } : {}), request: "1" })}`} scroll={false} className={buttonClass("primary", "sm")}><Send />Request quotation</Link> : undefined} />

      <div className="stagger grid gap-4">
        <Card aria-label="What to compare">
          <div className="flex flex-wrap items-end gap-3">
            <ParamSelect param="product" label="Compare a product" options={d.products} allLabel={null} clears={["category"]} fallback={v.kind === "product" ? d.productId : undefined} />
            <span className="pb-2 text-label text-ink-3">or</span>
            <ParamSelect param="category" label="Compare a whole category" options={d.categories} allLabel={null} clears={["product"]} />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card aria-labelledby="matrix-h">
            <CardHeader id="matrix-h" icon={Columns3} title={v.title} subtitle={v.sub} />
            {m.suppliers.length === 0 ? <EmptyState title="No supplier carries this yet" body="Add one in the supplier directory." className="py-8" /> : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[30rem] border-separate border-spacing-0 text-left text-body">
                  <caption className="sr-only">{v.title}: suppliers compared{best ? `; best ${v.kind === "product" ? "price" : "value"}: ${best.name}` : ""}</caption>
                  <thead>
                    <tr>
                      <td className="w-32 border-b border-line" />
                      {m.suppliers.map((s) => (
                        <th key={s.id} scope="col" className={cn("border-b border-line px-3 pt-2 pb-3 align-bottom font-normal", s.best && "rounded-t-tile bg-surface-2")}>
                          <span className="mb-1.5 flex flex-wrap gap-1">
                            {s.best && <StatusBadge tone="green" dot>{v.kind === "product" ? "Best price" : "Best value"}</StatusBadge>}
                            {s.current && <StatusBadge>Current</StatusBadge>}
                          </span>
                          <Link href={s.href} className="text-label font-medium underline-offset-4 hover:underline">{s.name}</Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.rows.map((r, ri) => (
                      <tr key={r.label}>
                        <th scope="row" className="border-b border-line/60 py-2.5 pr-3 text-[12px] font-medium text-ink-3">{r.label}</th>
                        {r.cells.map((c, i) => (
                          <td key={m.suppliers[i]!.id} className={cn("border-b border-line/60 px-3 py-2.5 tabular", m.suppliers[i]!.best && "bg-surface-2", m.suppliers[i]!.best && ri === m.rows.length - 1 && "rounded-b-tile border-b-0")}>
                            {c.tone ? <StatusBadge tone={c.tone}>{c.text}</StatusBadge> : <span className={cn(ri === 0 && "font-medium")}>{c.text}</span>}
                            {c.sub && <span className="block text-[11.5px] text-ink-3">{c.sub}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card aria-label="Savings versus current supplier">
            <CardHeader icon={BadgeIndianRupee} title="Savings vs current" subtitle={v.kind === "product" ? "Best valid quote against the contract price" : "Pick a product to price a switch"} />
            {v.kind === "category" ? (
              <p className="text-body text-ink-2">{best ? <><b className="font-medium text-ink">{best.name}</b> is cheapest on the most products in {v.title}. Choose a product above to see the saving on its 12-month volume.</> : "No valid prices in this category yet."}</p>
            ) : !v.saving ? (
              <EmptyState title="Nothing to compare yet" body="There is no accepted contract price or no valid quote for this product." className="py-6" />
            ) : v.saving.positive ? (
              <div className="grid gap-3">
                <p className="text-body text-ink-2">Switching to <b className="font-medium text-ink">{best?.name}</b> would save <b className="font-medium text-ink tabular">{v.saving.perUnit}</b> per unit.</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Per unit" value={`${v.saving.perUnit} · ${v.saving.ratio}`} />
                  <StatTile label={`On ${v.saving.volume} units / 12 mo`} value={v.saving.annual} />
                </div>
                <p className="text-[12px] text-ink-3">Weigh it against lead time and delivery record before switching; prices from received quotes still need Head Office review.</p>
              </div>
            ) : (
              <p className="text-body text-ink-2">The current contract is already the lowest valid price for {v.title}.</p>
            )}
          </Card>
        </div>
      </div>

      {canRequest && sp.request && (
        <UrlDrawer param="request" dialog title="Request quotation" description="Asks each supplier for a price; replies appear as received quotes.">
          <RequestQuoteForm products={d.products} eligible={d.eligible} initial={d.productId} />
        </UrlDrawer>
      )}
    </>
  );
}
