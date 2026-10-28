import "server-only";
import type { z } from "zod";
import type { COMMANDS } from "@/domain/commands";
import type { ID, Paise } from "@/domain/types";

export interface SystemConfig {
  requestWindow: { opensOnDay: number; closesOnDay: number };
  /** Approvals above this are flagged critical (emergency requests always are). */
  criticalApprovalThreshold: Paise;
  /** Purchase orders above this wait for final authorisation. */
  poAuthorisationThreshold: Paise;
  /** Critical stock = on hand ≤ this fraction of the reorder point. */
  stockCriticalRatio: number;
}

/** Defaults equal the values hard-coded across the app today (see ENFORCED on the configuration page). */
export const DEFAULT_CONFIG: SystemConfig = {
  requestWindow: { opensOnDay: 1, closesOnDay: 25 },
  criticalApprovalThreshold: 60_000_00,
  poAuthorisationThreshold: 25_000_00,
  stockCriticalRatio: 0.5,
};

export type ConfigPatch = z.output<(typeof COMMANDS)["updateConfig"]>;

// shortcut: process memory, reset daily like the demo store; Phase 2 moves this to a config table.
let state: { day: string; config: SystemConfig; updatedAt?: string; updatedBy?: ID } = { day: "", config: DEFAULT_CONFIG };

function current() {
  const day = new Date().toDateString();
  if (state.day !== day) state = { day, config: structuredClone(DEFAULT_CONFIG) };
  return state;
}

export const getConfig = () => { const s = current(); return { config: s.config, updatedAt: s.updatedAt, updatedBy: s.updatedBy }; };

/** Merges a validated updateConfig patch. Returns the names of the settings that changed. */
export function applyConfig(patch: ConfigPatch, actorId: ID, now: string): string[] {
  const s = current();
  const changed: string[] = [];
  if (patch.requestWindow && JSON.stringify(patch.requestWindow) !== JSON.stringify(s.config.requestWindow)) changed.push("request window");
  if (patch.criticalApprovalThreshold !== undefined && patch.criticalApprovalThreshold !== s.config.criticalApprovalThreshold) changed.push("critical approval threshold");
  s.config = { ...s.config, ...patch };
  if (changed.length) Object.assign(s, { updatedAt: now, updatedBy: actorId });
  return changed;
}
