import { describe, expect, it, vi } from "vitest";
import type { User } from "@/domain/types";
import { COMMANDS } from "@/domain/commands";
import { emailTaken, selfAdminRemoval } from "./users";

vi.mock("server-only", () => ({}));

const user = (id: string, email: string): User => ({ id, name: id, email, roles: ["finance"], centreIds: [], status: "active", lastActiveAt: "2026-10-01T09:00:00Z" });
const users = [user("u-1", "finance@demo.jumpstart.local"), user("u-2", "ops@demo.jumpstart.local")];

describe("inviteUser duplicate email", () => {
  it("rejects an existing email regardless of case and spaces", () => {
    expect(emailTaken(users, "  Finance@Demo.Jumpstart.local ")).toBe(true);
  });
  it("accepts a new email, and ignores the user being edited", () => {
    expect(emailTaken(users, "new@demo.jumpstart.local")).toBe(false);
    expect(emailTaken(users, "ops@demo.jumpstart.local", "u-2")).toBe(false);
  });
});

describe("assignRoles self-admin guard", () => {
  it("blocks an admin removing their own admin role", () => {
    expect(selfAdminRemoval("u-adm", "u-adm", ["admin"], ["finance"])).toMatch(/can't remove your own administrator role/);
  });
  it("allows keeping admin, editing someone else, or a non-admin editing themselves", () => {
    expect(selfAdminRemoval("u-adm", "u-adm", ["admin"], ["admin", "finance"])).toBeUndefined();
    expect(selfAdminRemoval("u-adm", "u-2", ["admin"], ["finance"])).toBeUndefined();
    expect(selfAdminRemoval("u-1", "u-1", ["finance"], ["head_office"])).toBeUndefined();
  });
});

describe("role assignment schema", () => {
  it("requires a centre for centre-scoped roles", () => {
    const r = COMMANDS.assignRoles.safeParse({ userId: "u-1", roles: ["centre_leader"], centreIds: [] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["centreIds"]);
  });
  it("lets organisation roles have no centres (all centres)", () => {
    expect(COMMANDS.inviteUser.safeParse({ name: "A B", email: "a@b.in", roles: ["finance"], centreIds: [] }).success).toBe(true);
  });
});
