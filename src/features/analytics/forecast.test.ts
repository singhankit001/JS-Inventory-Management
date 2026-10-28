import { describe, expect, it } from "vitest";
import { fullMonth, seasonalForecast, seasonalIndex } from "./forecast";

describe("seasonalForecast", () => {
  it("returns the level with no band for a flat series", () => {
    expect(seasonalForecast(Array(12).fill(100))).toEqual({ spread: 0, points: [1, 2, 3].map((step) => ({ step, value: 100, low: 100, high: 100 })) });
  });
  it("averages the same month last year with its neighbours", () => {
    const h = [100, 200, 300, 400, 100, 100, 100, 100, 100, 100, 100, 100];
    const { points } = seasonalForecast(h);
    expect(points.map((p) => p.value)).toEqual([150, 200, 300]); // mean(100,200), mean(100,200,300), mean(200,300,400)
    expect(points.every((p) => p.low <= p.value && p.value <= p.high && p.low >= 0)).toBe(true);
  });
  it("needs 12 months", () => expect(() => seasonalForecast([1, 2, 3])).toThrow());
  it("scales month to date by elapsed days and indexes seasonality", () => {
    expect(fullMonth(100, new Date(2026, 9, 10))).toBe(310); // October has 31 days
    expect(seasonalIndex([50, 150])).toEqual([0.5, 1.5]);
  });
});
