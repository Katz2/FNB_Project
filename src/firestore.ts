import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { CaseRef, Status, Tip, TipStore } from "./store";

/**
 * Firestore adapter (demo/showcase store; production target is DynamoDB behind the same TipStore port).
 * Uses Application Default Credentials: on Cloud Run this is the service's own identity, so no key file exists.
 * Collections: tips/{id}, commitments/{commitment} (dedupe), cases/{id}.
 * Security rules deny all direct client access; only this server (Admin SDK) reads or writes.
 */
export class FirestoreStore implements TipStore {
  private db: Firestore;

  constructor(db?: Firestore) {
    if (db) { this.db = db; return; }
    if (!getApps().length) initializeApp();
    this.db = getFirestore();
    this.db.settings({ ignoreUndefinedProperties: true });
  }

  async hasCommitment(c: string): Promise<boolean> {
    return (await this.db.collection("commitments").doc(c).get()).exists;
  }

  async openCases(): Promise<CaseRef[]> {
    const snap = await this.db.collection("cases").get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CaseRef, "id">) }));
  }

  /** Demo helper: make sure sample cases exist so auto-assignment can be shown. */
  async ensureCases(cases: readonly CaseRef[]): Promise<void> {
    await Promise.all(cases.map(({ id, ...rest }) => this.db.collection("cases").doc(id).set(rest, { merge: true })));
  }

  /** Atomic: the commitment doc is created in the same batch, so a duplicate fails instead of overwriting. */
  async putTip(t: Tip): Promise<void> {
    const batch = this.db.batch();
    batch.create(this.db.collection("commitments").doc(t.commitment), { tipId: t.id });
    batch.create(this.db.collection("tips").doc(t.id), { ...t });
    await batch.commit();
  }

  async getTip(id: string): Promise<Tip | undefined> {
    const d = await this.db.collection("tips").doc(id).get();
    return d.exists ? (d.data() as Tip) : undefined;
  }

  async setStatus(id: string, s: Status): Promise<void> {
    await this.db.collection("tips").doc(id).update({ status: s });
  }

  /** Transactional check-and-set: two simultaneous claims cannot both succeed. */
  async claimIfEligible(id: string): Promise<boolean> {
    const ref = this.db.collection("tips").doc(id);
    return this.db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      const t = d.data() as Tip | undefined;
      if (!t || t.status !== "VERIFIED" || t.rewardClaimed) return false;
      tx.update(ref, { rewardClaimed: true });
      return true;
    });
  }

  /** Fine for demo volumes; production uses aggregation queries or a stats table. */
  async all(): Promise<Tip[]> {
    return (await this.db.collection("tips").get()).docs.map((d) => d.data() as Tip);
  }
}
