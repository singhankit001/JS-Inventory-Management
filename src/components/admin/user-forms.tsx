"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Pencil, Plus, UserPlus } from "lucide-react";
import { COMMANDS } from "@/domain/commands";
import { ROLES, type Centre, type Role } from "@/domain/types";
import { ROLE_DEFINITIONS } from "@/lib/auth/permissions";
import type { CentreOption, UserDetail } from "@/features/admin/users";
import { assignRoles, inviteUser, upsertCentre } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DrawerContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";
import { relative, shortDate } from "@/lib/format";

type Errors = Record<string, string>;
/** First message per top-level field, so the form can show each next to its control. */
const toErrors = (issues: readonly { path: readonly PropertyKey[]; message: string }[]): Errors => {
  const out: Errors = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
};

/** Removes one search param without a server round trip or scroll jump. */
function useDropParam() {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  return (key: string, extra?: Record<string, string>) => {
    const p = new URLSearchParams(params);
    p.delete(key);
    Object.entries(extra ?? {}).forEach(([k, v]) => p.set(k, v));
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };
}

const box = "rounded-tile border border-line bg-surface-2/60 p-2";
const check = "size-4 shrink-0 accent-ink";

function RolePicker({ value, onChange, lockAdmin, error }: { value: Role[]; onChange: (r: Role[]) => void; lockAdmin?: boolean; error?: string }) {
  return (
    <fieldset className="grid gap-1.5" aria-describedby={error ? "roles-err" : undefined}>
      <legend className="mb-1.5 text-label font-medium text-ink-2">Roles</legend>
      <div className={`${box} grid gap-0.5 sm:grid-cols-2`}>
        {ROLES.map((r) => {
          const d = ROLE_DEFINITIONS[r], locked = lockAdmin && r === "admin";
          return (
            <label key={r} className="flex cursor-pointer items-start gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface has-disabled:cursor-not-allowed">
              <input type="checkbox" className={`${check} mt-0.5`} checked={value.includes(r)} disabled={locked}
                onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
              <span className="min-w-0">
                <span className="block text-label text-ink">{d.label}</span>
                <span className="block text-[11.5px] text-ink-3">{locked ? "Your own admin role can't be removed" : d.scope === "centre" ? "Centre role — needs a centre" : "Organisation role"}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && <p id="roles-err" role="alert" className="text-[12px] text-red">{error}</p>}
    </fieldset>
  );
}

function CentrePicker({ centres, value, onChange, roles, error }: { centres: CentreOption[]; value: string[]; onChange: (ids: string[]) => void; roles: Role[]; error?: string }) {
  const centreRole = roles.some((r) => ROLE_DEFINITIONS[r].scope === "centre");
  return (
    <fieldset className="grid gap-1.5" aria-describedby="centres-msg">
      <legend className="mb-1.5 text-label font-medium text-ink-2">Centres <span className="font-normal text-ink-3 tabular">· {value.length ? `${value.length} selected` : "none"}</span></legend>
      <div className={`${box} grid max-h-52 gap-0.5 overflow-y-auto sm:grid-cols-2`}>
        {centres.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface">
            <input type="checkbox" className={check} checked={value.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} />
            <span className="min-w-0 truncate text-label text-ink">{c.name} <span className="text-ink-3">· {c.code}</span></span>
          </label>
        ))}
      </div>
      <p id="centres-msg" role={error ? "alert" : undefined} className={error ? "text-[12px] text-red" : "text-[12px] text-ink-3"}>
        {error ?? (centreRole ? "Centre roles need at least one centre." : "Leave empty for access to all centres.")}
      </p>
    </fieldset>
  );
}

export function InviteUserDialog({ centres }: { centres: CentreOption[] }) {
  const params = useSearchParams(), drop = useDropParam(), toast = useToast();
  const urlOpen = params.get("invite") === "1";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", roles: [] as Role[], centreIds: [] as string[] });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) { setErrors({}); if (urlOpen) drop("invite"); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = COMMANDS.inviteUser.safeParse(form);
    if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
    setErrors({});
    start(async () => {
      const res = await inviteUser(form);
      if (!res.ok) return void (res.code === "conflict" ? setErrors({ email: res.error }) : toast({ tone: "error", title: "Couldn't invite", body: res.error }));
      toast({ tone: "success", title: res.message });
      setOpen(false);
      setForm({ name: "", email: "", roles: [], centreIds: [] });
      drop("invite", res.data ? { user: res.data.id } : undefined);
    });
  };

  return (
    <Dialog open={open || urlOpen} onOpenChange={close}>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><UserPlus />Invite user</Button>
      <DialogContent title="Invite user" description="Creates the account in demo data (resets daily). No email is sent until notifications are connected." className="max-h-[86dvh] overflow-y-auto sm:w-[min(92vw,600px)]">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.name}>{(a) => <Input {...a} autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Work email" error={errors.email}>{(a) => <Input {...a} type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
          </div>
          <RolePicker value={form.roles} onChange={(roles) => setForm({ ...form, roles })} error={errors.roles} />
          <CentrePicker centres={centres} value={form.centreIds} roles={form.roles} onChange={(centreIds) => setForm({ ...form, centreIds })} error={errors.centreIds} />
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button>Cancel</Button></DialogClose>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Inviting…" : "Send invite"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({ user, centres, lockAdmin, onDone }: { user: UserDetail; centres: CentreOption[]; lockAdmin: boolean; onDone: () => void }) {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const [centreIds, setCentreIds] = useState<string[]>(user.centreIds);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();
  const dirty = roles.slice().sort().join() !== user.roles.slice().sort().join() || centreIds.slice().sort().join() !== user.centreIds.slice().sort().join();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { userId: user.id, roles, centreIds };
    const parsed = COMMANDS.assignRoles.safeParse(input);
    if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
    setErrors({});
    start(async () => {
      const res = await assignRoles(input);
      if (!res.ok) return void toast({ tone: "error", title: "Couldn't save", body: res.error });
      toast({ tone: "success", title: res.message });
      onDone();
    });
  };
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <RolePicker value={roles} onChange={setRoles} lockAdmin={lockAdmin} error={errors.roles} />
      <CentrePicker centres={centres} value={centreIds} roles={roles} onChange={setCentreIds} error={errors.centreIds} />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending || !dirty}>{pending ? "Saving…" : "Save changes"}</Button>
      </div>
    </form>
  );
}

/** Opened by `?user=<id>`; closing drops the param so back/forward and shared links behave. */
export function UserDrawer({ users, centres, selfId, canEdit }: { users: UserDetail[]; centres: CentreOption[]; selfId: string; canEdit: boolean }) {
  const params = useSearchParams(), drop = useDropParam();
  const user = users.find((u) => u.id === params.get("user"));
  const [editing, setEditing] = useState<string | null>(null);
  const cmap = new Map(centres.map((c) => [c.id, c]));
  const lockAdmin = !!user && user.id === selfId && user.roles.includes("admin");

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) { setEditing(null); drop("user"); } }}>
      {user && (
        <DrawerContent title={user.name} description={user.email}>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {user.invited ? <StatusBadge tone="blue" dot>Invited</StatusBadge> : user.status === "active" ? <StatusBadge tone="green" dot>Active</StatusBadge> : <StatusBadge tone="red" dot>Suspended</StatusBadge>}
            {user.id === selfId && <StatusBadge>You</StatusBadge>}
          </div>
          {editing === user.id ? (
            <AssignForm key={user.id} user={user} centres={centres} lockAdmin={lockAdmin} onDone={() => setEditing(null)} />
          ) : (
            <div className="grid gap-5">
              <section aria-labelledby="drawer-roles">
                <h3 id="drawer-roles" className="mb-2 text-eyebrow font-medium tracking-[0.12em] text-ink-3 uppercase">Roles</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {user.roles.map((r) => (
                    <li key={r} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-label text-ink ring-1 ring-line">
                      {ROLE_DEFINITIONS[r].label}<span className="text-[11px] text-ink-3">{ROLE_DEFINITIONS[r].scope === "centre" ? "centre" : "org"}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="drawer-centres">
                <h3 id="drawer-centres" className="mb-2 text-eyebrow font-medium tracking-[0.12em] text-ink-3 uppercase">Centre assignments</h3>
                {user.centreIds.length === 0 ? <p className="text-body text-ink-2">All centres (organisation-wide)</p> : (
                  <ul className="grid gap-1">
                    {user.centreIds.map((id) => {
                      const c = cmap.get(id);
                      return (
                        <li key={id}>
                          <Link href={`/inventory/centres/${id}`} className="flex items-center gap-2.5 rounded-[12px] px-2 py-2 hover:bg-surface-2">
                            <Building2 className="size-4 text-ink-3" aria-hidden />
                            <span className="flex-1 text-body text-ink">{c?.name ?? id}</span>
                            <span className="text-label text-ink-3">{c ? `${c.code} · ${c.city}` : ""}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Last active" value={user.invited ? "Not signed in yet" : relative(user.lastActiveAt)} />
                <StatTile label="Since" value={shortDate(user.lastActiveAt)} />
              </div>
              {canEdit && <Button variant="primary" onClick={() => setEditing(user.id)}><Pencil />Edit roles &amp; centres</Button>}
            </div>
          )}
        </DrawerContent>
      )}
    </Dialog>
  );
}

type CentreInput = Pick<Centre, "id" | "code" | "name" | "city" | "status" | "monthlyBudget">;

export function CentreDialog({ centre }: { centre?: CentreInput }) {
  const toast = useToast();
  const blank = { code: "", name: "", city: "", status: "active" as Centre["status"], rupees: "" };
  const initial = centre ? { code: centre.code, name: centre.name, city: centre.city, status: centre.status, rupees: String(centre.monthlyBudget / 100) } : blank;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { id: centre?.id, code: form.code.trim().toUpperCase(), name: form.name, city: form.city, status: form.status, monthlyBudget: form.rupees === "" ? NaN : Math.round(Number(form.rupees) * 100) };
    const parsed = COMMANDS.upsertCentre.safeParse(input);
    if (!parsed.success) {
      const errs = toErrors(parsed.error.issues);
      return setErrors({ ...errs, ...(errs.code && { code: "2–12 capital letters, digits or hyphens" }), ...(errs.monthlyBudget && { monthlyBudget: "Enter a whole rupee amount, 0 or more" }) });
    }
    setErrors({});
    start(async () => {
      const res = await upsertCentre(input);
      if (!res.ok) return void (res.code === "conflict" ? setErrors({ code: res.error }) : toast({ tone: "error", title: "Couldn't save centre", body: res.error }));
      toast({ tone: "success", title: res.message });
      setOpen(false);
      if (!centre) setForm(blank);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setErrors({}); setForm(initial); } }}>
      {centre
        ? <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Edit ${centre.name}`}><Pencil />Edit</Button>
        : <Button size="sm" onClick={() => setOpen(true)}><Plus />Add centre</Button>}
      <DialogContent title={centre ? `Edit ${centre.name}` : "Add centre"} description="Saved to demo data (resets daily).">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field label="Code" error={errors.code}>{(a) => <Input {...a} value={form.code} maxLength={12} className="uppercase" onChange={(e) => setForm({ ...form, code: e.target.value })} />}</Field>
            <Field label="Centre name" error={errors.name}>{(a) => <Input {...a} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" error={errors.city}>{(a) => <Input {...a} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />}</Field>
            <Field label="Status">{(a) => (
              <Select {...a} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Centre["status"] })}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </Select>
            )}</Field>
          </div>
          <Field label="Monthly budget (₹)" hint="Allocation per term month; Head Office can still adjust each month's budget." error={errors.monthlyBudget}>
            {(a) => <Input {...a} type="number" inputMode="numeric" min={0} step={1} value={form.rupees} onChange={(e) => setForm({ ...form, rupees: e.target.value })} />}
          </Field>
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button>Cancel</Button></DialogClose>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : centre ? "Save centre" : "Add centre"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
