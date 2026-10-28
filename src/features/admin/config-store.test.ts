import { describe, expect, it, vi } from "vitest";
import { COMMANDS } from "@/domain/commands";
import { applyConfig, DEFAULT_CONFIG, getConfig } from "./config-store";
import { configPatch, ordinal, toForm } from "./config";

vi.mock("server-only", () => ({}));

const saved = { opensOnDay: 1, closesOnDay: 25, criticalApprovalThreshold: 60_000_00 };

describe("config validation", () => {
  it("rejects a window that closes before it opens, or days past the 28th", () => {
    expect(COMMANDS.updateConfig.safeParse({ requestWindow: { opensOnDay: 25, closesOnDay: 5 } }).error?.issues[0]?.message).toBe("The window must open before it closes");
    expect(COMMANDS.updateConfig.safeParse({ requestWindow: { opensOnDay: 1, closesOnDay: 31 } }).success).toBe(false);
  });
  it("rejects an empty patch and fractional paise", () => {
    expect(COMMANDS.updateConfig.safeParse({}).success).toBe(false);
    expect(COMMANDS.updateConfig.safeParse({ criticalApprovalThreshold: 10.5 }).success).toBe(false);
  });
  it("builds a patch of only the changed sections, in paise", () => {
    expect(configPatch(toForm(saved), saved)).toEqual({});
    expect(configPatch({ ...toForm(saved), criticalApprovalThreshold: "75000" }, saved)).toEqual({ criticalApprovalThreshold: 75_000_00 });
    expect(configPatch({ ...toForm(saved), closesOnDay: "" }, saved).requestWindow?.closesOnDay).toBeNaN();
  });
  it("formats ordinals", () => {
    expect([1, 2, 3, 11, 12, 21, 25].map(ordinal)).toEqual(["1st", "2nd", "3rd", "11th", "12th", "21st", "25th"]);
  });
});

describe("config store", () => {
  it("defaults to the values hard-coded in the app and merges a patch", () => {
    expect(getConfig().config).toEqual(DEFAULT_CONFIG);
    expect(applyConfig({ criticalApprovalThreshold: 75_000_00 }, "u-adm", "2026-10-28T10:00:00Z")).toEqual(["critical approval threshold"]);
    expect(getConfig()).toMatchObject({ config: { criticalApprovalThreshold: 75_000_00, requestWindow: { closesOnDay: 25 } }, updatedBy: "u-adm" });
    expect(applyConfig({ criticalApprovalThreshold: 75_000_00 }, "u-adm", "2026-10-28T10:01:00Z")).toEqual([]);
  });
});
