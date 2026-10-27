import type { Paise } from "@/domain/types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("en-IN");
const pct = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 0 });

export const money = (p: Paise) => inr.format(p / 100);
export const moneyCompact = (p: Paise) => inrCompact.format(p / 100);
export const count = (n: number) => num.format(n);
export const percent = (ratio: number) => pct.format(ratio);

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const monthLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString("en-IN", { month: "short" });
};

export function relative(iso: string, now = new Date()) {
  const diff = (new Date(iso).getTime() - now.getTime()) / 86_400_000;
  const days = Math.round(diff);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
