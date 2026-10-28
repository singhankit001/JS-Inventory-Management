// Client-safe helpers for the configuration form (config-store.ts is server-only).

export interface EditableConfig { opensOnDay: number; closesOnDay: number; criticalApprovalThreshold: number }
export type ConfigFormValues = Record<keyof EditableConfig, string>;

export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;

export const toForm = (c: EditableConfig): ConfigFormValues => ({ opensOnDay: String(c.opensOnDay), closesOnDay: String(c.closesOnDay), criticalApprovalThreshold: String(c.criticalApprovalThreshold / 100) });

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** Only changed sections go into the updateConfig patch, so saving one setting never overwrites another. Rupees → paise. */
export function configPatch(form: ConfigFormValues, saved: EditableConfig) {
  const opens = num(form.opensOnDay), closes = num(form.closesOnDay), critical = Math.round(num(form.criticalApprovalThreshold) * 100);
  return {
    ...(opens !== saved.opensOnDay || closes !== saved.closesOnDay ? { requestWindow: { opensOnDay: opens, closesOnDay: closes } } : {}),
    ...(critical !== saved.criticalApprovalThreshold ? { criticalApprovalThreshold: critical } : {}),
  };
}
