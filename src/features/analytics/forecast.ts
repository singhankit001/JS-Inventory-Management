/**
 * Statistical demand forecast — deliberately simple so anyone can check it by hand. AI Demand Forecasting replaces it.
 *
 * Input: 12 monthly values, oldest first; the last one is the current month (already scaled to a full month).
 * Method (seasonal moving average): each future month = the mean of the same calendar month last year and its
 * neighbours (a 3-month centred window, clipped to the data we have). The 80% band is ±1.28σ of how far each month
 * sat from its own centred 3-month average, i.e. the month-to-month noise the smoothing cannot explain.
 */
export interface ForecastPoint { step: number; value: number; low: number; high: number }

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const window3 = (xs: number[], i: number) => xs.slice(Math.max(0, i - 1), Math.min(xs.length, i + 2));

export function seasonalForecast(history: number[], horizon = 3): { points: ForecastPoint[]; spread: number } {
  if (history.length < 12) throw new Error("seasonalForecast needs 12 months of history");
  const h = history.slice(-12);
  const residuals = h.map((v, i) => v - mean(window3(h, i)));
  const spread = 1.28 * Math.sqrt(mean(residuals.map((r) => r * r)));
  const points = Array.from({ length: horizon }, (_, k) => {
    // Step k+1 lands 12 months after index k (index 11 is "this month").
    const value = Math.round(mean(window3(h, k)));
    return { step: k + 1, value, low: Math.max(0, Math.round(value - spread)), high: Math.round(value + spread) };
  });
  return { points, spread: Math.round(spread) };
}

/** Scales a month-to-date figure to a full month by elapsed days, so the current month compares with full months. */
export const fullMonth = (monthToDate: number, today: Date) =>
  Math.round(monthToDate * new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() / today.getDate());

/** Seasonal index per calendar position: value ÷ the 12-month mean (1 = an average month). */
export const seasonalIndex = (history: number[]) => { const m = mean(history) || 1; return history.map((v) => v / m); };
