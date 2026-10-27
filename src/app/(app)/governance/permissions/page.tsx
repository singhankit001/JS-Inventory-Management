import type { Metadata } from "next";
import { Check, Minus, ShieldCheck } from "lucide-react";
import type { Role } from "@/domain/types";
import { requirePermission } from "@/lib/auth/session";
import { can, PERMISSIONS, ROLE_DEFINITIONS, type PermissionKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Permission matrix" };

const roles = Object.keys(ROLE_DEFINITIONS) as Role[];
const keys = Object.keys(PERMISSIONS) as PermissionKey[];
const prefix = (k: string) => k.split(".")[0]!;
const groups = [...new Set(keys.map(prefix))].map((g) => [g, keys.filter((k) => prefix(k) === g)] as const);

export default async function PermissionsPage() {
  await requirePermission("admin.users");
  return (
    <>
      <PageHeader crumbs={[{ label: "Jumpstart", href: "/" }, { label: "Governance", href: "/modules/governance" }, { label: "Permissions" }]} title="Permission matrix" />
      <Card aria-label="Role permission matrix">
        <CardHeader icon={ShieldCheck} title="What each role can do" subtitle="Generated from src/lib/auth/permissions.ts — the same table the server checks on every request" />
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-left text-body">
            <caption className="sr-only">Permissions by role. Rows are permissions, columns are roles.</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 border-b border-line bg-surface px-5 py-3 align-bottom text-[11.5px] font-medium text-ink-3 sm:px-6">Permission</th>
                {roles.map((r) => {
                  const d = ROLE_DEFINITIONS[r];
                  return (
                    <th key={r} scope="col" className="border-b border-line px-3 py-3 text-center align-bottom font-normal">
                      <span className="block text-label font-medium text-ink">{d.label}</span>
                      <StatusBadge className="mt-1">{d.scope === "organisation" ? "Organisation" : "Centre"}</StatusBadge>
                      <span className="mt-1 block text-[11px] text-ink-3 tabular">{d.permissions.length} permissions</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {groups.map(([group, rows]) => (
              <tbody key={group}>
                <tr>
                  <th scope="colgroup" colSpan={roles.length + 1} className="px-5 pt-5 pb-2 text-eyebrow font-medium tracking-[0.12em] text-ink-3 uppercase sm:px-6"><span className="sticky left-5 sm:left-6">{group}</span></th>
                </tr>
                {rows.map((k) => (
                  <tr key={k} className="group">
                    <th scope="row" className="sticky left-0 z-10 max-w-72 border-b border-line/60 bg-surface px-5 py-2.5 font-normal group-hover:bg-surface-2 sm:px-6">
                      <code className="text-label font-medium text-ink">{k}</code>
                      <span className="block text-[12px] text-ink-3">{PERMISSIONS[k]}</span>
                    </th>
                    {roles.map((r) => {
                      const ok = can(r, k);
                      return (
                        <td key={r} className="border-b border-line/60 px-3 py-2.5 text-center group-hover:bg-surface-2">
                          <span role="img" aria-label={`${ROLE_DEFINITIONS[r].label}: ${ok ? "allowed" : "not allowed"}`} className={ok ? "inline-grid size-6 place-items-center rounded-full bg-green-soft text-green" : "inline-grid size-6 place-items-center text-ink-3"}>
                            {ok ? <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Card>
    </>
  );
}
