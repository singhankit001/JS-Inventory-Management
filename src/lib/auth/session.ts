import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect, forbidden } from "next/navigation";
import { z } from "zod";
import type { Centre, Role, User } from "@/domain/types";
import { ROLES } from "@/domain/types";
import { allCentres, findUser, getRepository, type CentreScope, type Repository } from "@/lib/data/provider";
import { can, ROLE_DEFINITIONS, type PermissionKey } from "./permissions";

export const SESSION_COOKIE = "jis_session";
const MAX_AGE_S = 60 * 60 * 12;

const payloadSchema = z.object({ uid: z.string().min(1), role: z.enum(ROLES), exp: z.number() });
type Payload = z.infer<typeof payloadSchema>;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (≥32 chars) is required in production");
  }
  return "dev-only-insecure-session-secret-change-me";
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function encodeSession(p: Payload): string {
  const data = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(token: string | undefined, now = Date.now()): Payload | null {
  if (!token) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(data, "base64url").toString()));
    return parsed.success && parsed.data.exp > now ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeSession(uid: string, role: Role) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession({ uid, role, exp: Date.now() + MAX_AGE_S * 1000 }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_S,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export interface Session {
  user: User;
  /** Active workspace. Always one of user.roles. */
  role: Role;
  /** Centres this session may read. */
  scope: CentreScope;
  centres: Centre[];
}

/** Centre scope comes from the role's scope AND the user's assignments, never from the client. */
export function scopeFor(user: User, role: Role): CentreScope {
  if (ROLE_DEFINITIONS[role].scope === "organisation" && user.centreIds.length === 0) return "all";
  return user.centreIds;
}

export async function getSession(): Promise<Session | null> {
  const p = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!p) return null;
  const user = findUser(p.uid);
  if (!user || user.status !== "active" || !user.roles.includes(p.role)) return null;
  const scope = scopeFor(user, p.role);
  const centres = allCentres().filter((c) => scope === "all" || scope.includes(c.id));
  return { user, role: p.role, scope, centres };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Server-side gate for pages and actions. Renders app/forbidden.tsx on failure. */
export async function requirePermission(permission: PermissionKey): Promise<Session> {
  const s = await requireSession();
  if (!can(s.role, permission)) forbidden();
  return s;
}

/**
 * Narrows the session scope to one centre picked in the UI (?centre=).
 * An out-of-scope centre is ignored rather than trusted.
 */
export function scopedRepository(session: Session, centreParam?: string): { repo: Repository; centre?: Centre } {
  const centre = centreParam ? session.centres.find((c) => c.id === centreParam) : undefined;
  return { repo: getRepository(centre ? [centre.id] : session.scope), centre };
}
