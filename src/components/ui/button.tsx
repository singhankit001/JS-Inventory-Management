import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none transition-[background-color,color,box-shadow,transform] duration-200 ease-[var(--ease-out-3)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0";
const variants: Record<ButtonVariant, string> = {
  primary: "bg-pill text-pill-ink shadow-float hover:shadow-pop hover:-translate-y-px",
  secondary: "bg-surface text-ink border border-line-strong/70 shadow-card hover:bg-surface-2",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-3/70",
  danger: "bg-red text-white hover:brightness-110",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-label",
  md: "h-10 px-5 text-body",
};

/** Shared class builder so Links can look like buttons without a wrapper component. */
export const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) =>
  cn(base, variants[variant], sizes[size], className);

export function Button({
  variant = "secondary", size = "md", className, type = "button", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/** An action whose workflow ships in a later phase. Visibly disabled — never a fake button. */
export function PlannedAction({ label, phase = 2, icon }: { label: string; phase?: 2 | 3; icon?: React.ReactNode }) {
  return (
    <span
      className={buttonClass("secondary", "md", "cursor-not-allowed opacity-70")}
      aria-disabled="true"
      title={`${label} ships in Phase ${phase}`}
    >
      {icon}
      {label}
      <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px] font-semibold tracking-wide text-ink-3 uppercase">
        Phase {phase}
      </span>
    </span>
  );
}
