import type { TipInput } from "./validate";

export type Status = "RECEIVED" | "ASSIGNED" | "VERIFIED" | "REJECTED";
export interface Tip extends TipInput { id: string; status: Status; caseId?: string; rewardClaimed: boolean }
export interface CaseRef { id: string; category: string; geohash: string }

/** Persistence port. Production adapter: DynamoDB (KMS-encrypted, PITR on). */
export interface TipStore {
  hasCommitment(c: string): Promise<boolean>;
  openCases(): Promise<CaseRef[]>;
  putTip(t: Tip): Promise<void>;
  getTip(id: string): Promise<Tip | undefined>;
  setStatus(id: string, s: Status): Promise<void>;
  /** Atomic: flips rewardClaimed only if VERIFIED and unclaimed (DynamoDB conditional write). */
  claimIfEligible(id: string): Promise<boolean>;
  all(): Promise<Tip[]>;
}

export interface SapsGateway { forward(tip: Tip): Promise<void> } // mTLS + signed payload in prod
export interface VoucherProvider { issue(): Promise<string> } // voucher code, no phone/ID needed

export class InMemoryStore implements TipStore {
  tips = new Map<string, Tip>();
  constructor(private cases: CaseRef[] = []) {}
  async hasCommitment(c: string) { return [...this.tips.values()].some((t) => t.commitment === c); }
  async openCases() { return this.cases; }
  async putTip(t: Tip) { this.tips.set(t.id, t); }
  async getTip(id: string) { return this.tips.get(id); }
  async setStatus(id: string, s: Status) { const t = this.tips.get(id); if (t) t.status = s; }
  async claimIfEligible(id: string) {
    const t = this.tips.get(id);
    if (!t || t.status !== "VERIFIED" || t.rewardClaimed) return false;
    t.rewardClaimed = true;
    return true;
  }
  async all() { return [...this.tips.values()]; }
}
