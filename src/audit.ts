import { sha256 } from "./crypto";
import type { Tip } from "./store";

export type Role = "ANALYST" | "CASE_OFFICER" | "AUDITOR" | "SYSTEM";
export type Permission = "stats:read" | "tip:verify" | "audit:read";

/** Least privilege: each role gets only what it needs. No role can read tip plaintext here. */
const GRANTS: Record<Role, readonly Permission[]> = {
  ANALYST: ["stats:read"],
  CASE_OFFICER: ["tip:verify"],
  AUDITOR: ["audit:read"],
  SYSTEM: [],
};

export class Forbidden extends Error {}

export function authorize(role: Role, perm: Permission): void {
  if (!GRANTS[role]?.includes(perm)) throw new Forbidden("Forbidden");
}

export interface AuditEntry { seq: number; ts: string; actor: string; action: string; ref: string; prevHash: string; hash: string }

/** Append-only, hash-chained log: editing or deleting any entry breaks verify(). */
export class AuditLog {
  private entries: AuditEntry[] = [];

  append(actor: string, action: string, ref: string, now = new Date()): AuditEntry {
    const prevHash = this.entries.at(-1)?.hash ?? "GENESIS";
    const base = { seq: this.entries.length, ts: now.toISOString(), actor, action, ref, prevHash };
    const entry = { ...base, hash: sha256(JSON.stringify(base)) };
    this.entries.push(entry);
    return entry;
  }

  verify(entries: readonly AuditEntry[] = this.entries): boolean {
    let prev = "GENESIS";
    return entries.every((e, i) => {
      const { hash, ...base } = e;
      const ok = e.seq === i && e.prevHash === prev && sha256(JSON.stringify(base)) === hash;
      prev = hash;
      return ok;
    });
  }

  /** Reading the log is itself audited. */
  read(role: Role, actor: string): readonly AuditEntry[] {
    authorize(role, "audit:read");
    this.append(actor, "audit.read", "-");
    return [...this.entries];
  }
}

const K_MIN = 5; // k-anonymity: hide any cell smaller than 5

/** Aggregate stats only; small counts are suppressed so no single tip can be singled out. */
export function stats(role: Role, tips: readonly Tip[], log: AuditLog, actor: string): Record<string, number | "<5"> {
  authorize(role, "stats:read");
  const counts: Record<string, number> = {};
  for (const t of tips) counts[t.category] = (counts[t.category] ?? 0) + 1;
  log.append(actor, "stats.read", "-");
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v < K_MIN ? "<5" : v]));
}
