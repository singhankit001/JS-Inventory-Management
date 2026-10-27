import { describe, expect, it } from "vitest";
import { ageingBucket } from "./finance";

describe("ageingBucket", () => {
  const today = new Date(2026, 9, 27);
  const at = (offset: number, hour = 10) => new Date(2026, 9, 27 + offset, hour).toISOString();
  it("buckets by whole calendar days past due", () => {
    expect(ageingBucket(at(0, 18), today)).toBe("current"); // due later today
    expect(ageingBucket(at(5), today)).toBe("current");
    expect(ageingBucket(at(-1), today)).toBe("d30");
    expect(ageingBucket(at(-30), today)).toBe("d30");
    expect(ageingBucket(at(-31), today)).toBe("d60");
    expect(ageingBucket(at(-60), today)).toBe("d60");
    expect(ageingBucket(at(-61), today)).toBe("d60plus");
  });
});
